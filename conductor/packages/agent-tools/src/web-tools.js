/**
 * WEB TOOLS — `web_search` and `fetch_url`, gated by `CONDUCTOR_WEB=live`.
 *
 * Mirrors Conductor's honest-simulation ethos: locally both return
 * clearly-labelled simulated results (zero network, deterministic, demo-safe).
 * On a Vercel deployment they default to LIVE; set `CONDUCTOR_WEB=off` to force
 * simulation, or `CONDUCTOR_WEB=live` to opt in anywhere. When live:
 *   - web_search uses Tavily when `TAVILY_API_KEY` is set, else a keyless
 *     DuckDuckGo Instant-Answer fallback.
 *   - fetch_url GETs the page and strips HTML to text (with a basic SSRF guard
 *     that refuses private/loopback hosts).
 *
 * Each function returns the executor result contract: `{ ok, output }` /
 * `{ ok: false, error }`.
 */

const ok = (output, extra = {}) => ({ ok: true, output, ...extra });
const fail = (error) => ({ ok: false, error: String(error?.message || error) });

const FETCH_TIMEOUT_MS = 10_000;
const MAX_TEXT = 8000;

export function webEnabled(env = process.env) {
  const flag = String(env.CONDUCTOR_WEB || '').toLowerCase()
  if (flag === 'live' || flag === 'on' || flag === '1' || flag === 'true') return true
  if (flag === 'off' || flag === '0' || flag === 'false') return false
  // Default: auto-enable real web research on a Vercel deployment ONLY when a
  // reliable search backend (Tavily) is configured. The keyless DuckDuckGo
  // fallback is heavily rate-limited (returns 403s), so without a key we keep
  // simulating — with a hint to set TAVILY_API_KEY — instead of erroring every
  // turn. Force the keyless path anywhere with CONDUCTOR_WEB=live.
  return !!((env.VERCEL || env.VERCEL_ENV) && env.TAVILY_API_KEY)
}

function withTimeout(ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, done: () => clearTimeout(t) };
}

// Refuse private / loopback / link-local hosts (basic SSRF guard).
function isBlockedHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (/^127\./.test(h) || h === '::1' || h === '0.0.0.0') return true;
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (h.endsWith('.internal') || h.endsWith('.local')) return true;
  return false;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatResults(query, results) {
  if (!results.length) return ok(`No results for "${query}".`, { results: [] });
  const lines = results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${(r.snippet || '').slice(0, 200)}`);
  return ok(`Search results for "${query}":\n\n${lines.join('\n\n')}`, { results });
}

async function tavilySearch(query, max, apiKey) {
  const { signal, done } = withTimeout(FETCH_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, query, max_results: max }),
      signal,
    });
    if (!res.ok) throw new Error(`tavily ${res.status}`);
    const data = await res.json();
    const results = (data.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.content }));
    return formatResults(query, results);
  } finally {
    done();
  }
}

async function duckDuckGoSearch(query, max) {
  const { signal, done } = withTimeout(FETCH_TIMEOUT_MS);
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`;
    const res = await fetch(url, { signal, headers: { 'user-agent': 'Conductor/1.0' } });
    if (!res.ok) throw new Error(`duckduckgo ${res.status}`);
    const data = await res.json();
    const results = [];
    if (data.AbstractText) {
      results.push({ title: data.Heading || query, url: data.AbstractURL || '', snippet: data.AbstractText });
    }
    const walk = (topics) => {
      for (const t of topics || []) {
        if (results.length >= max) break;
        if (t.Topics) walk(t.Topics);
        else if (t.Text) results.push({ title: t.Text.split(' - ')[0], url: t.FirstURL || '', snippet: t.Text });
      }
    };
    walk(data.RelatedTopics);
    return formatResults(query, results.slice(0, max));
  } finally {
    done();
  }
}

function simulatedSearch(query, max) {
  const rows = Array.from({ length: Math.min(max, 3) }, (_, i) => ({
    title: `[simulated] Result ${i + 1} for "${query}"`,
    url: `https://example.com/${encodeURIComponent(query)}/${i + 1}`,
    snippet: 'Simulated locally. Real web is on by default in production; set TAVILY_API_KEY for higher-quality results (or CONDUCTOR_WEB=live to go live anywhere).',
  }));
  return formatResults(query, rows);
}

export async function webSearch({ query, max_results } = {}, env = process.env) {
  const q = String(query ?? '').trim();
  if (!q) return fail('empty query');
  const max = Math.max(1, Math.min(10, Number(max_results) || 5));
  if (!webEnabled(env)) return simulatedSearch(q, max);
  try {
    if (env.TAVILY_API_KEY) return await tavilySearch(q, max, env.TAVILY_API_KEY);
    return await duckDuckGoSearch(q, max);
  } catch (err) {
    return fail(`web search failed: ${err?.message || err}`);
  }
}

export async function fetchUrl({ url } = {}, env = process.env) {
  const raw = String(url ?? '').trim();
  if (!raw) return fail('empty url');
  if (!webEnabled(env)) {
    return ok(`[simulated] would fetch ${raw}\n(set CONDUCTOR_WEB=live to fetch real pages)`);
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return fail('invalid url');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fail('only http(s) urls are allowed');
  if (isBlockedHost(parsed.hostname)) return fail(`refused to fetch private/loopback host: ${parsed.hostname}`);
  const { signal, done } = withTimeout(FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(parsed.toString(), { signal, headers: { 'user-agent': 'Conductor/1.0' }, redirect: 'follow' });
    const ct = res.headers.get('content-type') || '';
    const body = await res.text();
    const text = ct.includes('html') ? stripHtml(body) : body.trim();
    return ok(`${res.status} ${parsed.hostname} — ${text.slice(0, MAX_TEXT)}`, { status: res.status, url: parsed.toString() });
  } catch (err) {
    return fail(`fetch failed: ${err?.message || err}`);
  } finally {
    done();
  }
}

/** Dispatch a web tool by name, or return null if it isn't a web tool. */
export async function runWebTool(name, args = {}, env = process.env) {
  if (name === 'web_search') return webSearch(args, env);
  if (name === 'fetch_url') return fetchUrl(args, env);
  return null;
}
