import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { ToolRegistry, SimulatedExecutor, LocalSandboxExecutor, VercelSandboxExecutor, getExecutor, runTool, TOOL_NAMES } from '../src/index.js';

// A fake Vercel Sandbox that records calls — lets us test the executor's
// command/file mapping and lifecycle without provisioning a real microVM.
function fakeSandbox() {
  const sb = {
    files: new Map(),
    commands: [],
    stopped: false,
    async writeFiles(list) {
      for (const f of list) sb.files.set(f.path, Buffer.from(f.content).toString());
    },
    async runCommand(cmd, args = []) {
      sb.commands.push([cmd, ...args].join(' '));
      if (cmd === 'cat') {
        const p = args[0];
        return sb.files.has(p)
          ? { exitCode: 0, stdout: async () => sb.files.get(p), stderr: async () => '' }
          : { exitCode: 1, stdout: async () => '', stderr: async () => 'no such file' };
      }
      if (cmd === 'ls') return { exitCode: 0, stdout: async () => [...sb.files.keys()].join('\n'), stderr: async () => '' };
      // sh -c <script>
      return { exitCode: 0, stdout: async () => `ran: ${args[args.length - 1]}`, stderr: async () => '' };
    },
    async stop() {
      sb.stopped = true;
    },
  };
  return sb;
}

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

test('getExecutor selects the backend from CONDUCTOR_SANDBOX', () => {
  assert.equal(getExecutor({}).kind, 'simulated');
  assert.equal(getExecutor({ CONDUCTOR_SANDBOX: 'local' }).kind, 'local');
  assert.equal(getExecutor({ CONDUCTOR_SANDBOX: 'vercel' }).kind, 'vercel');
});

test('vercel sandbox executor maps tools to the microVM and is created lazily', async () => {
  const sb = fakeSandbox();
  let created = 0;
  const ex = new VercelSandboxExecutor({ createSandbox: () => { created++; return sb; } });

  // Pure/web tools never spin up a microVM.
  const calc = await ex.execute('calculator', { expression: '6*7' });
  assert.equal(calc.value, 42);
  assert.equal(created, 0, 'no sandbox for pure tools');

  // First sandbox-backed op creates exactly one VM; later ops reuse it.
  const w = await ex.execute('write_file', { path: 'note.txt', content: 'sandboxed' });
  assert.equal(w.ok, true);
  assert.equal(created, 1);
  const ls = await ex.execute('list_files', {});
  assert.ok(ls.output.includes('note.txt'));
  const rd = await ex.execute('read_file', { path: 'note.txt' });
  assert.equal(rd.output, 'sandboxed');
  const run = await ex.execute('run_command', { command: 'echo hi && whoami' });
  assert.equal(run.ok, true);
  assert.match(run.output, /ran: echo hi && whoami/);
  assert.equal(created, 1, 'one microVM reused across the turn');

  // run_command goes through a real shell (no allowlist — the VM is isolated).
  assert.ok(sb.commands.some((c) => c.startsWith('sh -c')));

  await ex.dispose();
  assert.equal(sb.stopped, true, 'dispose stops the microVM');
});

test('vercel sandbox dispose is a no-op when no VM was ever created', async () => {
  const ex = new VercelSandboxExecutor({ createSandbox: () => { throw new Error('should not be called'); } });
  await ex.dispose(); // must not throw
});

test('vercel sandbox surfaces a clear error when the SDK is unavailable', async () => {
  const ex = new VercelSandboxExecutor({ createSandbox: () => { throw new Error('boom'); } });
  const r = await ex.execute('run_command', { command: 'ls' });
  assert.equal(r.ok, false);
  assert.match(r.error, /Vercel Sandbox unavailable/);
});

test('runTool convenience uses the simulated executor by default', async () => {
  const r = await runTool('run_command', { command: 'node --version' }, {});
  assert.equal(r.ok, true);
  assert.match(r.output, /simulated/);
});
