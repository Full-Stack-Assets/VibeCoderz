/**
 * MCP CLIENT — connect to remote Model Context Protocol servers and expose their
 * tools through the same `ToolRegistry` dispatch surface as the built-in tools.
 *
 * Transport is **Streamable HTTP** (JSON-RPC 2.0 over a single POST endpoint),
 * the only MCP transport that fits a serverless deployment — stdio servers need
 * a long-lived child process Vercel can't host. Dependency-free (fetch only),
 * and `fetchImpl` is injectable so the client is unit-testable with no network.
 *
 * Flow per server: initialize → notifications/initialized → tools/list, then
 * each remote tool is registered as `<server>__<tool>` with a handler that calls
 * tools/call. A server that fails to connect is skipped (logged), never fatal —
 * the agent keeps its built-in tools.
 *
 * Configure with CONDUCTOR_MCP: a JSON array of { name, url, headers? }, or a
 * comma/whitespace-separated list of URLs.
 */

const PROTOCOL_VERSION = '2025-06-18';
const sanitize = (s) => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '_');

// Provider tool-name limit is 64 chars. Keep long `<server>__<tool>` names under
// it, staying unique via a short deterministic hash suffix. Only the registry
// key / schema name is capped — the handler still calls the original tool name.
function capName(name) {
  if (name.length <= 64) return name;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) | 0;
  const suffix = `_${(h >>> 0).toString(36)}`;
  return name.slice(0, 64 - suffix.length) + suffix;
}

/** Parse configured MCP servers from the environment. Returns [] when unset. */
export function parseMcpConfig(env = process.env) {
  const raw = (env.CONDUCTOR_MCP || '').trim();
  if (!raw) return [];
  // JSON array form: [{ "name": "...", "url": "...", "headers": {...} }, ...]
  if (raw.startsWith('[')) {
    try {
      const arr = JSON.parse(raw);
      return (Array.isArray(arr) ? arr : [])
        .filter((s) => s && s.url)
        .map((s, i) => ({ name: sanitize(s.name || `mcp${i}`), url: String(s.url), headers: s.headers || {} }));
    } catch {
      return [];
    }
  }
  // URL-list form: "https://a/mcp, https://b/mcp"
  return raw
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((url, i) => ({ name: `mcp${i}`, url, headers: {} }));
}

/** Join MCP `content` blocks (the tools/call result) into a single text string. */
function contentToText(content) {
  if (!Array.isArray(content)) return String(content ?? '');
  return content
    .map((b) => (b?.type === 'text' ? String(b.text ?? '') : JSON.stringify(b)))
    .join('\n');
}

export class McpHttpClient {
  constructor({ name, url, headers = {}, fetchImpl } = {}) {
    this.name = name;
    this.url = url;
    this.headers = headers;
    this.fetch = fetchImpl || globalThis.fetch;
    this.sessionId = null;
    this._id = 0;
  }

  // One JSON-RPC call over Streamable HTTP. Notifications expect no response.
  async _rpc(method, params, { notification = false } = {}) {
    const body = notification
      ? { jsonrpc: '2.0', method, params }
      : { jsonrpc: '2.0', id: ++this._id, method, params };
    const res = await this.fetch(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Streamable HTTP servers may answer with JSON or an SSE stream.
        accept: 'application/json, text/event-stream',
        ...(this.sessionId ? { 'mcp-session-id': this.sessionId } : {}),
        ...this.headers,
      },
      body: JSON.stringify(body),
    });
    // Capture the session id the server assigns on initialize.
    const sid = res.headers?.get?.('mcp-session-id');
    if (sid) this.sessionId = sid;
    if (notification) return null;
    if (!res.ok) throw new Error(`${this.name} ${method}: HTTP ${res.status} ${await safeText(res)}`);

    const ct = res.headers?.get?.('content-type') || '';
    const text = await res.text();
    const msg = ct.includes('text/event-stream') ? parseSseForId(text, body.id) : JSON.parse(text);
    if (msg?.error) throw new Error(`${this.name} ${method}: ${msg.error.message || JSON.stringify(msg.error)}`);
    return msg?.result;
  }

  async initialize() {
    const result = await this._rpc('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'conductor', version: '1.0.0' },
    });
    // Per spec the client confirms the handshake before issuing requests.
    await this._rpc('notifications/initialized', {}, { notification: true }).catch(() => {});
    return result;
  }

  async listTools() {
    const result = await this._rpc('tools/list', {});
    return Array.isArray(result?.tools) ? result.tools : [];
  }

  async callTool(name, args = {}) {
    try {
      const result = await this._rpc('tools/call', { name, arguments: args });
      const output = contentToText(result?.content);
      if (result?.isError) return { ok: false, error: output || 'tool error' };
      return { ok: true, output };
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  }
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

// Pull the JSON-RPC message matching `id` out of an SSE response body.
function parseSseForId(text, id) {
  let fallback = null;
  for (const block of String(text).split(/\n\n/)) {
    for (const line of block.split('\n')) {
      if (!line.startsWith('data:')) continue;
      try {
        const msg = JSON.parse(line.slice(5).trim());
        if (msg && msg.id === id) return msg;
        if (msg && fallback == null) fallback = msg;
      } catch {
        /* skip non-JSON data lines */
      }
    }
  }
  return fallback;
}

/**
 * Connect to every configured MCP server and register its tools into `registry`,
 * namespaced `<server>__<tool>`. Returns { registered, errors } for logging.
 * Never throws: a server that fails to connect is skipped.
 */
export async function registerMcpTools(registry, env = process.env, { fetchImpl } = {}) {
  const servers = parseMcpConfig(env);
  const registered = [];
  const errors = [];
  for (const cfg of servers) {
    const client = new McpHttpClient({ ...cfg, fetchImpl });
    try {
      await client.initialize();
      const tools = await client.listTools();
      for (const t of tools) {
        if (!t?.name) continue;
        const localName = capName(`${cfg.name}__${sanitize(t.name)}`);
        registry.register(
          {
            name: localName,
            description: t.description || `MCP tool ${t.name} on ${cfg.name}`,
            parameters: t.inputSchema || { type: 'object', properties: {} },
          },
          (args) => client.callTool(t.name, args)
        );
        registered.push(localName);
      }
    } catch (err) {
      errors.push({ server: cfg.name, error: String(err?.message || err) });
    }
  }
  return { registered, errors };
}
