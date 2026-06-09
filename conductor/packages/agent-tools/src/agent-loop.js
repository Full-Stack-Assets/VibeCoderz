/**
 * AGENTIC LOOP — lets a model autonomously drive the sandbox tools.
 *
 * `runAgenticTurn` is provider-agnostic: it repeatedly asks a `planner` for the
 * next action, executes any tool call through the `ToolRegistry`, and feeds the
 * result back until the planner returns a final answer (or a step cap is hit).
 *
 * A planner is just `(steps) => Promise<Action>` where Action is either
 * `{ type: 'tool', tool, args }` or `{ type: 'final', text }`. This keeps the
 * loop testable and lets the live LLM planner own its provider-specific
 * transcript state in a closure, while `makeSimulatedPlanner` drives it with
 * zero configuration.
 */

// Flatten a message's content (string or multimodal block array) to plain text.
const flattenContent = (content) => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter((b) => b.type !== 'image').map((b) => String(b.text ?? '')).join(' ');
  return String(content ?? '');
};

const lastUserText = (messages = []) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') return flattenContent(messages[i].content);
  }
  return '';
};

/**
 * @param {object} opts
 * @param {(steps:any[]) => Promise<{type:'tool'|'final', tool?:string, args?:object, text?:string}>} opts.planner
 * @param {import('./index.js').ToolRegistry} opts.registry
 * @param {number} [opts.maxSteps=6]
 * @param {(step:{tool,args,result}) => void} [opts.onStep] called as each tool step completes
 * @returns {Promise<{text:string, steps:Array<{tool,args,result}>}>}
 */
export async function runAgenticTurn({ planner, registry, maxSteps = 6, onStep }) {
  const steps = [];
  for (let i = 0; i < maxSteps; i++) {
    const action = await planner(steps);
    if (!action || action.type === 'final') {
      return { text: action?.text ?? '', steps };
    }
    const result = await registry.run(action.tool, action.args || {});
    const step = { tool: action.tool, args: action.args || {}, result };
    steps.push(step);
    if (onStep) {
      try {
        onStep(step);
      } catch {
        /* observer errors must not break the loop */
      }
    }
  }
  return {
    text: `Reached the ${maxSteps}-step tool limit. Here is what was done so far.`,
    steps,
  };
}

const STUB = (fname, task) => {
  if (fname.endsWith('.js') || fname.endsWith('.mjs')) {
    return `// ${task.slice(0, 80)}\nconsole.log('Conductor ran ${fname}');\n`;
  }
  if (fname.endsWith('.py')) return `# ${task.slice(0, 80)}\nprint('Conductor ran ${fname}')\n`;
  return `${task.slice(0, 200)}\n`;
};

/** Build a deterministic tool plan from the user's request. */
function buildPlan(text) {
  const t = text.toLowerCase();
  const fileMatch = text.match(/([\w./-]+\.(?:js|mjs|ts|tsx|jsx|py|txt|md|json|sh))/);
  const wantsList = /\b(list|ls|show files|directory|tree|what files)\b/.test(t);
  const wantsFile = /\b(create|write|add|generate|make|implement|build|script|file|component|function|app)\b/.test(t);
  const wantsRun = /\b(run|execute|compile|test|node|npm|print|output)\b/.test(t);

  // Non-coding capabilities (research / utility / data) take precedence when a
  // clearer intent is present — Conductor is a general agent, not just a coder.
  const wantsSearch = /\b(search|look up|lookup|find out|latest|news|current|who is|google)\b/.test(t);
  const calcMatch = text.match(/(?:calculate|compute|what(?:'s| is))?\s*([-+\d().*/%\s]{3,})$/);
  const wantsTime = /\b(what time|current time|what'?s the date|today'?s date|time is it)\b/.test(t);
  const dataMatch = text.match(/((?:[^\n,]+,){2,}[^\n,]+(?:\n[^\n,]+)+)/); // looks like CSV

  if (wantsTime) return [{ tool: 'current_time', args: {} }];
  if (dataMatch) return [{ tool: 'analyze_data', args: { data: dataMatch[1] } }];
  if (calcMatch && /[-+*/%]/.test(calcMatch[1]) && /\d/.test(calcMatch[1])) {
    return [{ tool: 'calculator', args: { expression: calcMatch[1].trim() } }];
  }
  if (wantsSearch && !wantsFile) {
    return [{ tool: 'web_search', args: { query: text.slice(0, 120) } }];
  }

  if (wantsList && !wantsFile) return [{ tool: 'list_files', args: {} }];

  const plan = [];
  if (wantsFile) {
    const fname = fileMatch ? fileMatch[1] : 'solution.js';
    plan.push({ tool: 'write_file', args: { path: fname, content: STUB(fname, text) } });
    if (/\.(js|mjs)$/.test(fname)) plan.push({ tool: 'run_command', args: { command: `node ${fname}` } });
    else plan.push({ tool: 'list_files', args: {} });
    return plan;
  }
  if (wantsRun) return [{ tool: 'run_command', args: { command: 'node --version' } }];
  return []; // no tool intent → answer directly
}

function summarize(task, steps) {
  if (steps.length === 0) {
    return `**[simulation]** No tool actions were needed for this turn, so I'm answering directly.\n\n> ${task.slice(0, 200)}`;
  }
  const lines = steps.map((s) => {
    const out = s.result.ok ? s.result.output : `✗ ${s.result.error}`;
    const arg =
      s.args.command ?? s.args.query ?? s.args.url ?? s.args.expression ?? s.args.path ??
      s.args.timezone ?? (s.tool === 'analyze_data' ? 'dataset' : s.args.dir || '.');
    return `- \`${s.tool}\` (${arg}) → ${String(out).split('\n')[0].slice(0, 120)}`;
  });
  return (
    `**[simulation · agentic]** I completed ${steps.length} tool step${steps.length > 1 ? 's' : ''} ` +
    `in the sandbox for this request:\n\n${lines.join('\n')}\n\n` +
    `Set a provider key to have the model drive these tools with real reasoning.`
  );
}

/**
 * Deterministic, zero-config planner. Plans the tool actions up front from the
 * request, executes them one per loop iteration, then returns a final summary.
 */
export function makeSimulatedPlanner(messages) {
  const task = lastUserText(messages);
  const plan = buildPlan(task);
  let i = 0;
  return async (steps) => {
    if (i < plan.length) return { type: 'tool', ...plan[i++] };
    return { type: 'final', text: summarize(task, steps) };
  };
}
