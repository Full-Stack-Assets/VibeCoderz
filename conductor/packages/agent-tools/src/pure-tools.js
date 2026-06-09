/**
 * PURE TOOLS — side-effect-free compute shared by every executor.
 *
 * `calculator`, `current_time`, and `analyze_data` touch no network or disk, so
 * they run for real even in simulation mode (there is nothing to "simulate" —
 * the answer is deterministic from the inputs). Each returns the executor result
 * contract: `{ ok: true, output }` or `{ ok: false, error }`.
 */

const ok = (output, extra = {}) => ({ ok: true, output, ...extra });
const fail = (error) => ({ ok: false, error: String(error?.message || error) });

/** Safe arithmetic evaluator — a strict character allowlist, then evaluate. */
export function calculator({ expression } = {}) {
  const expr = String(expression ?? '').trim();
  if (!expr) return fail('empty expression');
  if (expr.length > 200) return fail('expression too long');
  if (!/^[0-9+\-*/%.()\s]+$/.test(expr)) {
    return fail('only numbers and + - * / % ( ) are allowed');
  }
  try {
    // eslint-disable-next-line no-new-func
    const value = Function(`"use strict"; return (${expr});`)();
    if (typeof value !== 'number' || !Number.isFinite(value)) return fail('not a finite number');
    return ok(String(value), { value });
  } catch (err) {
    return fail(err);
  }
}

/** Current date/time, UTC by default or a given IANA timezone. */
export function currentTime({ timezone } = {}) {
  const now = new Date();
  try {
    if (timezone) {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        dateStyle: 'full',
        timeStyle: 'long',
      });
      return ok(`${fmt.format(now)} (${timezone})`, { iso: now.toISOString() });
    }
  } catch {
    /* invalid tz → fall through to UTC */
  }
  return ok(`${now.toUTCString()} (UTC) · ${now.toISOString()}`, { iso: now.toISOString() });
}

// --- data analysis ---------------------------------------------------------

const MAX_ROWS = 5000;

function detectFormat(text) {
  const t = text.trim();
  if (t.startsWith('[') || t.startsWith('{')) return 'json';
  const head = t.split('\n')[0] || '';
  if ((head.match(/\t/g) || []).length > (head.match(/,/g) || []).length) return 'tsv';
  return 'csv';
}

function splitDelimited(text, delim) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { columns: [], rows: [] };
  const columns = lines[0].split(delim).map((c) => c.trim());
  const rows = lines.slice(1, MAX_ROWS + 1).map((line) => {
    const cells = line.split(delim);
    const row = {};
    columns.forEach((c, i) => (row[c] = (cells[i] ?? '').trim()));
    return row;
  });
  return { columns, rows };
}

function asRows(data, format) {
  const fmt = !format || format === 'auto' ? detectFormat(data) : format;
  if (fmt === 'json') {
    const parsed = JSON.parse(data);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const columns = [...new Set(arr.flatMap((o) => (o && typeof o === 'object' ? Object.keys(o) : [])))];
    return { fmt, columns, rows: arr.slice(0, MAX_ROWS) };
  }
  const delim = fmt === 'tsv' ? '\t' : ',';
  return { fmt, ...splitDelimited(data, delim) };
}

function numericStats(values) {
  const nums = values
    .map((v) => (typeof v === 'number' ? v : Number(String(v).replace(/[$,%\s]/g, ''))))
    .filter((n) => Number.isFinite(n));
  if (nums.length === 0) return null;
  nums.sort((a, b) => a - b);
  const sum = nums.reduce((a, b) => a + b, 0);
  const mid = Math.floor(nums.length / 2);
  const median = nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  const round = (n) => Number(n.toFixed(4));
  return { count: nums.length, min: round(nums[0]), max: round(nums[nums.length - 1]), mean: round(sum / nums.length), median: round(median) };
}

/** Parse a dataset and report shape + per-column numeric statistics. */
export function analyzeData({ data, format } = {}) {
  const text = String(data ?? '');
  if (!text.trim()) return fail('no data provided');
  try {
    const { fmt, columns, rows } = asRows(text, format);
    if (rows.length === 0) return fail('no rows found');

    const lines = [`Parsed ${rows.length} row${rows.length > 1 ? 's' : ''} × ${columns.length} column${columns.length > 1 ? 's' : ''} (${fmt}).`];
    const colStats = {};
    for (const col of columns.slice(0, 50)) {
      const stats = numericStats(rows.map((r) => r[col]));
      if (stats) {
        colStats[col] = stats;
        lines.push(`- ${col}: n=${stats.count}, min=${stats.min}, max=${stats.max}, mean=${stats.mean}, median=${stats.median}`);
      } else {
        const sample = [...new Set(rows.map((r) => String(r[col] ?? '')).filter(Boolean))].slice(0, 3);
        lines.push(`- ${col}: text (${sample.length ? `e.g. ${sample.join(', ')}` : 'empty'})`);
      }
    }
    return ok(lines.join('\n'), { rows: rows.length, columns, stats: colStats });
  } catch (err) {
    return fail(`could not parse data: ${err?.message || err}`);
  }
}

/** Dispatch a pure tool by name, or return null if it isn't a pure tool. */
export function runPureTool(name, args = {}) {
  switch (name) {
    case 'calculator':
      return calculator(args);
    case 'current_time':
      return currentTime(args);
    case 'analyze_data':
      return analyzeData(args);
    default:
      return null;
  }
}
