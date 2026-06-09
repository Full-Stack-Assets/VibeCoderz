/**
 * EXECUTORS — pluggable backends that actually run a tool call.
 *
 * Two implementations behind one interface (`execute(name, args)`):
 *   - SimulatedExecutor : deterministic, no side effects. The zero-config
 *     default, matching Conductor's simulation-mode ethos.
 *   - LocalSandboxExecutor : runs in an isolated temp working directory with
 *     path-traversal guards and a command allowlist. Opt-in via env.
 *
 * The interface is intentionally the same shape a Vercel Sandbox / remote
 * executor would implement, so swapping in `@vercel/sandbox` is a backend
 * change, not a call-site change.
 */

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ok = (output, extra = {}) => ({ ok: true, output, ...extra });
const fail = (error) => ({ ok: false, error: String(error?.message || error) });

export class SimulatedExecutor {
  constructor() {
    this.kind = 'simulated';
    this.files = new Map();
  }

  async execute(name, args = {}) {
    switch (name) {
      case 'run_command':
        return ok(
          `[simulated] $ ${args.command}\n` +
            `(no sandbox configured — set CONDUCTOR_SANDBOX=local to run for real)`
        );
      case 'write_file':
        this.files.set(args.path, args.content ?? '');
        return ok(`[simulated] wrote ${(args.content ?? '').length} bytes to ${args.path}`);
      case 'read_file':
        return this.files.has(args.path)
          ? ok(this.files.get(args.path))
          : fail(`no such file: ${args.path}`);
      case 'list_files':
        return ok([...this.files.keys()].join('\n') || '(empty)');
      default:
        return fail(`unknown tool: ${name}`);
    }
  }
}

// Commands the local sandbox is allowed to run (leading binary must match).
const COMMAND_ALLOWLIST = new Set([
  'node', 'npm', 'npx', 'pnpm', 'ls', 'cat', 'echo', 'pwd', 'mkdir', 'touch',
  'head', 'tail', 'wc', 'grep', 'find', 'true', 'env', 'date',
]);

export class LocalSandboxExecutor {
  constructor({ root, timeoutMs = 10_000 } = {}) {
    this.kind = 'local';
    this.root = root || path.join(os.tmpdir(), `conductor-sandbox-${process.pid}`);
    this.timeoutMs = timeoutMs;
    this._ready = fs.mkdir(this.root, { recursive: true });
  }

  // Resolve a sandbox-relative path and refuse anything escaping the root.
  _resolve(rel = '.') {
    const abs = path.resolve(this.root, rel);
    if (abs !== this.root && !abs.startsWith(this.root + path.sep)) {
      throw new Error(`path escapes sandbox: ${rel}`);
    }
    return abs;
  }

  async execute(name, args = {}) {
    await this._ready;
    try {
      switch (name) {
        case 'write_file': {
          const abs = this._resolve(args.path);
          await fs.mkdir(path.dirname(abs), { recursive: true });
          await fs.writeFile(abs, args.content ?? '');
          return ok(`wrote ${(args.content ?? '').length} bytes to ${args.path}`, { path: args.path });
        }
        case 'read_file': {
          const abs = this._resolve(args.path);
          return ok(await fs.readFile(abs, 'utf8'));
        }
        case 'list_files': {
          const abs = this._resolve(args.dir || '.');
          const entries = await fs.readdir(abs, { withFileTypes: true });
          return ok(entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join('\n') || '(empty)');
        }
        case 'run_command':
          return await this._run(args.command || '');
        default:
          return fail(`unknown tool: ${name}`);
      }
    } catch (err) {
      return fail(err);
    }
  }

  _run(command) {
    const bin = command.trim().split(/\s+/)[0];
    if (!COMMAND_ALLOWLIST.has(bin)) {
      return Promise.resolve(fail(`command not allowed: "${bin}" (allowlist: ${[...COMMAND_ALLOWLIST].join(', ')})`));
    }
    return new Promise((resolve) => {
      const child = spawn('/bin/sh', ['-c', command], { cwd: this.root, timeout: this.timeoutMs });
      let out = '';
      let err = '';
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (err += d));
      child.on('error', (e) => resolve(fail(e)));
      child.on('close', (code) => {
        const text = (out + (err ? `\n[stderr]\n${err}` : '')).trim();
        resolve(code === 0 ? ok(text, { exitCode: code }) : { ok: false, error: `exit ${code}`, output: text, exitCode: code });
      });
    });
  }
}

/** Select an executor from the environment. Default: simulated (zero-config). */
export function getExecutor(env = process.env) {
  if ((env.CONDUCTOR_SANDBOX || 'simulated').toLowerCase() === 'local') {
    return new LocalSandboxExecutor();
  }
  return new SimulatedExecutor();
}
