import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { ToolRegistry, SimulatedExecutor, LocalSandboxExecutor, runTool, TOOL_NAMES } from '../src/index.js';

test('exposes the expected tool surface', () => {
  assert.deepEqual(
    [...TOOL_NAMES].sort(),
    [
      'analyze_data', 'calculator', 'current_time', 'fetch_url', 'list_files',
      'read_file', 'run_command', 'web_search', 'write_file',
    ].sort()
  );
});

test('simulated executor writes and reads without side effects', async () => {
  const reg = new ToolRegistry({ executor: new SimulatedExecutor() });
  const w = await reg.run('write_file', { path: 'a.txt', content: 'hello' });
  assert.equal(w.ok, true);
  const r = await reg.run('read_file', { path: 'a.txt' });
  assert.equal(r.output, 'hello');
});

test('local sandbox executes a real allowlisted command and persists files', async () => {
  const root = path.join(os.tmpdir(), `conductor-test-${Date.now()}`);
  const ex = new LocalSandboxExecutor({ root });
  const w = await ex.execute('write_file', { path: 'note.txt', content: 'sandboxed' });
  assert.equal(w.ok, true);
  const ls = await ex.execute('list_files', {});
  assert.ok(ls.output.includes('note.txt'));
  const run = await ex.execute('run_command', { command: 'cat note.txt' });
  assert.equal(run.ok, true);
  assert.equal(run.output, 'sandboxed');
});

test('local sandbox blocks path traversal', async () => {
  const ex = new LocalSandboxExecutor({ root: path.join(os.tmpdir(), `conductor-test-${Date.now()}-b`) });
  const r = await ex.execute('write_file', { path: '../escape.txt', content: 'x' });
  assert.equal(r.ok, false);
  assert.match(r.error, /escapes sandbox/);
});

test('local sandbox blocks non-allowlisted commands', async () => {
  const ex = new LocalSandboxExecutor({ root: path.join(os.tmpdir(), `conductor-test-${Date.now()}-c`) });
  const r = await ex.execute('run_command', { command: 'rm -rf /' });
  assert.equal(r.ok, false);
  assert.match(r.error, /not allowed/);
});

test('registry dispatches an MCP-style registered tool', async () => {
  const reg = new ToolRegistry({ executor: new SimulatedExecutor() });
  reg.register({ name: 'mcp_echo', description: 'echo', parameters: { type: 'object', properties: {} } }, async (a) => ({ ok: true, output: a.msg }));
  const r = await reg.run('mcp_echo', { msg: 'via mcp' });
  assert.equal(r.output, 'via mcp');
  assert.ok(reg.list().some((t) => t.name === 'mcp_echo'));
});

test('runTool convenience uses the simulated executor by default', async () => {
  const r = await runTool('run_command', { command: 'node --version' }, {});
  assert.equal(r.ok, true);
  assert.match(r.output, /simulated/);
});
