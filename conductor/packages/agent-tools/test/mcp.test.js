import { test } from 'node:test';
import assert from 'node:assert/strict';
import { McpHttpClient, registerMcpTools, parseMcpConfig, ToolRegistry, SimulatedExecutor } from '../src/index.js';

// A JSON-RPC-over-HTTP MCP server stub. `handlers` maps method -> result (or fn).
// Mimics the Response shape the client reads: ok, headers.get, text().
function mockFetch(handlers, { sse = false, fail = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, method: body.method, params: body.params, id: body.id });
    if (fail) throw new Error('connection refused');
    if (body.id == null) {
      // notification → empty 200
      return { ok: true, headers: { get: () => null }, text: async () => '' };
    }
    const h = handlers[body.method];
    const result = typeof h === 'function' ? h(body.params) : h;
    const msg = { jsonrpc: '2.0', id: body.id, result };
    const text = sse ? `event: message\ndata: ${JSON.stringify(msg)}\n\n` : JSON.stringify(msg);
    const headers = {
      get: (k) => {
        const key = k.toLowerCase();
        if (key === 'mcp-session-id') return 'sess-1';
        if (key === 'content-type') return sse ? 'text/event-stream' : 'application/json';
        return null;
      },
    };
    return { ok: true, headers, text: async () => text };
  };
  return { fetchImpl, calls };
}

const TOOLS_RESULT = {
  tools: [
    { name: 'echo', description: 'echo back', inputSchema: { type: 'object', properties: { msg: { type: 'string' } } } },
  ],
};

test('parseMcpConfig handles JSON-array, URL-list, and empty', () => {
  assert.deepEqual(parseMcpConfig({ CONDUCTOR_MCP: '' }), []);
  const json = parseMcpConfig({ CONDUCTOR_MCP: '[{"name":"gh","url":"https://x/mcp"}]' });
  assert.equal(json[0].name, 'gh');
  assert.equal(json[0].url, 'https://x/mcp');
  const list = parseMcpConfig({ CONDUCTOR_MCP: 'https://a/mcp, https://b/mcp' });
  assert.equal(list.length, 2);
  assert.equal(list[1].url, 'https://b/mcp');
});

test('client initializes (capturing session id) and lists tools', async () => {
  const { fetchImpl, calls } = mockFetch({
    initialize: { serverInfo: { name: 's' }, capabilities: {} },
    'tools/list': TOOLS_RESULT,
  });
  const client = new McpHttpClient({ name: 's', url: 'https://x/mcp', fetchImpl });
  await client.initialize();
  assert.equal(client.sessionId, 'sess-1');
  // initialize → initialized notification → (later) tools/list
  assert.equal(calls[0].method, 'initialize');
  assert.equal(calls[1].method, 'notifications/initialized');
  const tools = await client.listTools();
  assert.equal(tools[0].name, 'echo');
});

test('callTool returns text output, and flags isError', async () => {
  const ok = mockFetch({ 'tools/call': { content: [{ type: 'text', text: 'hello' }] } });
  const c1 = new McpHttpClient({ name: 's', url: 'u', fetchImpl: ok.fetchImpl });
  assert.deepEqual(await c1.callTool('echo', { msg: 'hi' }), { ok: true, output: 'hello' });

  const bad = mockFetch({ 'tools/call': { content: [{ type: 'text', text: 'boom' }], isError: true } });
  const c2 = new McpHttpClient({ name: 's', url: 'u', fetchImpl: bad.fetchImpl });
  assert.deepEqual(await c2.callTool('echo', {}), { ok: false, error: 'boom' });
});

test('registerMcpTools namespaces tools and dispatches via the registry', async () => {
  const { fetchImpl } = mockFetch({
    initialize: { capabilities: {} },
    'tools/list': TOOLS_RESULT,
    'tools/call': (p) => ({ content: [{ type: 'text', text: `got:${p.arguments.msg}` }] }),
  });
  const registry = new ToolRegistry({ executor: new SimulatedExecutor() });
  const { registered, errors } = await registerMcpTools(registry, { CONDUCTOR_MCP: '[{"name":"demo","url":"u"}]' }, { fetchImpl });
  assert.deepEqual(errors, []);
  assert.deepEqual(registered, ['demo__echo']);
  assert.ok(registry.list().some((t) => t.name === 'demo__echo'));
  // The registry routes the namespaced call to the MCP server's tools/call.
  const r = await registry.run('demo__echo', { msg: 'yo' });
  assert.deepEqual(r, { ok: true, output: 'got:yo' });
});

test('a server that fails to connect is skipped, not fatal', async () => {
  const { fetchImpl } = mockFetch({}, { fail: true });
  const registry = new ToolRegistry({ executor: new SimulatedExecutor() });
  const { registered, errors } = await registerMcpTools(registry, { CONDUCTOR_MCP: 'https://down/mcp' }, { fetchImpl });
  assert.deepEqual(registered, []);
  assert.equal(errors.length, 1);
  // built-in tools still dispatch fine
  const r = await registry.run('calculator', { expression: '2+2' });
  assert.equal(r.ok, true);
});

test('SSE-framed responses are parsed', async () => {
  const { fetchImpl } = mockFetch({ initialize: { capabilities: {} }, 'tools/list': TOOLS_RESULT }, { sse: true });
  const client = new McpHttpClient({ name: 's', url: 'u', fetchImpl });
  await client.initialize();
  const tools = await client.listTools();
  assert.equal(tools[0].name, 'echo');
});
