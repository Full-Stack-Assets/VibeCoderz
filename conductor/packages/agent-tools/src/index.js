/**
 * @conductor/agent-tools — sandboxed tool execution for the agent runtime.
 *
 * Brings the vibe platform's sandbox/tool capability under the COO router: the
 * engine routes a turn to a model, and the model drives these tools through a
 * pluggable Executor (simulated by default, real local sandbox opt-in, remote
 * Vercel Sandbox as a drop-in). A ToolRegistry lets MCP servers contribute
 * additional tools behind the same dispatch surface — the extensibility seam
 * ported from the Claude Code Assistant's MCP service.
 */

import { TOOLS, TOOL_NAMES, PURE_TOOL_NAMES, getTool } from './tools.js';
import { getExecutor, SimulatedExecutor, LocalSandboxExecutor, VercelSandboxExecutor } from './executors.js';
import { runAgenticTurn, makeSimulatedPlanner } from './agent-loop.js';
import { runPureTool, calculator, currentTime, analyzeData } from './pure-tools.js';
import { runWebTool, webSearch, fetchUrl, webEnabled } from './web-tools.js';

export { TOOLS, TOOL_NAMES, PURE_TOOL_NAMES, getTool, getExecutor, SimulatedExecutor, LocalSandboxExecutor, VercelSandboxExecutor };
export { runAgenticTurn, makeSimulatedPlanner };
export { runPureTool, calculator, currentTime, analyzeData };
export { runWebTool, webSearch, fetchUrl, webEnabled };

/**
 * Registry of available tools. Seeded with the built-in sandbox tools; MCP
 * servers (or any provider) can register more at runtime. Dispatch routes a
 * tool call either to its registered handler or to the default Executor.
 */
export class ToolRegistry {
  constructor({ executor } = {}) {
    this.executor = executor || getExecutor();
    this.extra = new Map(); // name -> { schema, handler }
  }

  /** Register an external tool (e.g. backed by an MCP server). */
  register(schema, handler) {
    this.extra.set(schema.name, { schema, handler });
    return this;
  }

  /** All tool schemas (built-in + registered), ready for a provider tools API. */
  list() {
    return [...TOOLS, ...[...this.extra.values()].map((e) => e.schema)];
  }

  /** Execute one tool call. Returns a unified { ok, output|error, ... }. */
  async run(name, args = {}) {
    const ext = this.extra.get(name);
    if (ext) {
      try {
        return await ext.handler(args);
      } catch (err) {
        return { ok: false, error: String(err?.message || err) };
      }
    }
    if (!TOOL_NAMES.includes(name)) {
      return { ok: false, error: `unknown tool: ${name}` };
    }
    return this.executor.execute(name, args);
  }
}

/** Convenience: run a single tool with the env-selected executor. */
export async function runTool(name, args, env = process.env) {
  const executor = getExecutor(env);
  try {
    return await new ToolRegistry({ executor }).run(name, args);
  } finally {
    // Tear down any per-call resource (e.g. a Vercel Sandbox microVM).
    await executor.dispose?.();
  }
}
