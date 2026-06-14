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
import { runPureTool } from './pure-tools.js';
import { runWebTool } from './web-tools.js';

const ok = (output, extra = {}) => ({ ok: true, output, ...extra });
const fail = (error) => ({ ok: false, error: String(error?.message || error) });

// Tools that behave identically regardless of executor: pure compute (always
// real) and web tools (real when CONDUCTOR_WEB=live, simulated otherwise).
// Returns a result, or null when `name` isn't a shared tool.
async function runSharedTool(name, args) {
  const pure = runPureTool(name, args);
  if (pure) return pure;
  return runWebTool(name, args);
}

export class SimulatedExecutor {
  constructor() {
    this.kind = 'simulated';
    this.files = new Map();
  }

  async execute(name, args = {}) {
    const shared = await runSharedTool(name, args);
    if (shared) return shared;
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
      const shared = await runSharedTool(name, args);
      if (shared) return shared;
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

// Read a CommandFinished stream field (`stdout`/`stderr`), which the SDK
// exposes as an async method but could be a plain string — tolerate both.
async function readCmdStream(cmd, field) {
  const v = cmd?.[field];
  if (typeof v === 'function') return String((await v.call(cmd)) ?? '');
  return String(v ?? '');
}

/**
 * VercelSandboxExecutor — runs tool calls inside an isolated, ephemeral Vercel
 * Sandbox microVM. Unlike LocalSandboxExecutor (which runs in THIS process,
 * next to the app's secrets), the microVM has no access to STRIPE_SECRET_KEY,
 * DATABASE_URL, gateway creds, etc., so arbitrary commands are safe — no binary
 * allowlist needed. The VM is created lazily on the first command/file op,
 * reused for the turn, and stopped via dispose(); it also auto-expires after
 * `timeoutMs`. Authenticated automatically on Vercel via the OIDC token (or
 * VERCEL_TOKEN/TEAM/PROJECT off-platform).
 *
 * `createSandbox` is a test seam; in production it dynamically imports
 * `@vercel/sandbox` (optional dep) so the package works without it installed.
 */
export class VercelSandboxExecutor {
  constructor({ timeoutMs = 5 * 60_000, createSandbox } = {}) {
    this.kind = 'vercel';
    this.timeoutMs = timeoutMs;
    this._create = createSandbox || null;
    this._sandbox = null; // a Promise<Sandbox>, created on first use
  }

  _sandboxPromise() {
    if (!this._sandbox) {
      this._sandbox = (async () => {
        if (this._create) return this._create();
        const mod = await import('@vercel/sandbox');
        const Sandbox = mod.Sandbox ?? mod.default?.Sandbox ?? mod.default;
        if (!Sandbox?.create) throw new Error('@vercel/sandbox: Sandbox.create not found');
        return Sandbox.create({ timeout: this.timeoutMs });
      })().catch((err) => {
        this._sandbox = null; // let a later call retry instead of caching the failure
        throw new Error(
          `Vercel Sandbox unavailable (${err?.message || err}). Ensure @vercel/sandbox ` +
            `is installed and the app runs on Vercel (or set VERCEL_TOKEN/VERCEL_TEAM_ID/VERCEL_PROJECT_ID).`
        );
      });
    }
    return this._sandbox;
  }

  async execute(name, args = {}) {
    // Pure + web tools are identical across executors and need no microVM.
    const shared = await runSharedTool(name, args);
    if (shared) return shared;
    try {
      const sandbox = await this._sandboxPromise();
      switch (name) {
        case 'write_file': {
          const content = args.content ?? '';
          await sandbox.writeFiles([{ path: args.path, content: Buffer.from(content) }]);
          return ok(`wrote ${content.length} bytes to ${args.path}`, { path: args.path });
        }
        case 'read_file': {
          const r = await sandbox.runCommand('cat', [String(args.path ?? '')]);
          if (r.exitCode !== 0) return fail(`no such file: ${args.path}`);
          return ok(await readCmdStream(r, 'stdout'));
        }
        case 'list_files': {
          const r = await sandbox.runCommand('ls', ['-1A', String(args.dir || '.')]);
          return ok((await readCmdStream(r, 'stdout')).trim() || '(empty)');
        }
        case 'run_command': {
          const cmd = String(args.command || '').trim();
          if (!cmd) return fail('empty command');
          const r = await sandbox.runCommand('sh', ['-c', cmd]);
          const out = (await readCmdStream(r, 'stdout')).trim();
          const err = (await readCmdStream(r, 'stderr')).trim();
          const text = (out + (err ? `\n[stderr]\n${err}` : '')).trim();
          return r.exitCode === 0
            ? ok(text, { exitCode: r.exitCode })
            : { ok: false, error: `exit ${r.exitCode}`, output: text, exitCode: r.exitCode };
        }
        default:
          return fail(`unknown tool: ${name}`);
      }
    } catch (err) {
      return fail(err);
    }
  }

  // Stop the microVM after the turn. Best-effort: it also auto-expires.
  async dispose() {
    if (!this._sandbox) return;
    const pending = this._sandbox;
    this._sandbox = null;
    try {
      const sandbox = await pending;
      await sandbox.stop?.();
    } catch {
      /* already gone / never created — nothing to clean up */
    }
  }
}

/**
 * Select an executor from the environment.
 *
 * On a Vercel deployment we default to the REAL Vercel Sandbox: the `@vercel/
 * sandbox` dep is bundled and auth is automatic via OIDC, so agent tool calls
 * actually run instead of returning simulated stubs (mirrors the web tools'
 * auto-live-in-production behavior). Off-platform stays simulated for zero-config
 * local dev. Override explicitly anywhere with CONDUCTOR_SANDBOX=vercel|local|
 * simulated.
 */
export function getExecutor(env = process.env) {
  const onVercel = !!(env.VERCEL || env.VERCEL_ENV);
  const mode = (env.CONDUCTOR_SANDBOX || (onVercel ? 'vercel' : 'simulated')).toLowerCase();
  if (mode === 'vercel') return new VercelSandboxExecutor();
  if (mode === 'local') return new LocalSandboxExecutor();
  return new SimulatedExecutor();
}
