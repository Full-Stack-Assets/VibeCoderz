/**
 * TOOL DEFINITIONS — the agent's capabilities, as provider-ready schemas.
 *
 * Each tool has a JSON-Schema `parameters` block so it can be handed directly to
 * a provider's tool-calling API (Anthropic `tools`, OpenAI `tools`) when running
 * live, and dispatched to an Executor for actual execution. The COO engine
 * routes the turn to a model; the model then drives these tools.
 *
 * Conductor is a GENERAL agent, so the toolset spans four capability groups:
 *   - SANDBOX  : run_command / write_file / read_file / list_files  (coding)
 *   - WEB      : web_search / fetch_url                              (research)
 *   - DATA     : analyze_data                                       (analysis)
 *   - UTILITY  : calculator / current_time                          (everyday)
 */

// Group A — sandbox/coding tools (run inside the env-selected executor).
const SANDBOX_TOOLS = [
  {
    name: 'run_command',
    description: 'Run a shell command inside the sandbox working directory and return its output.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to run, e.g. "node --version".' },
      },
      required: ['command'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file in the sandbox with the given contents.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Sandbox-relative file path, e.g. "src/index.js".' },
        content: { type: 'string', description: 'The full file contents to write.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a file from the sandbox.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Sandbox-relative file path.' } },
      required: ['path'],
    },
  },
  {
    name: 'list_files',
    description: 'List files in a sandbox directory (defaults to the sandbox root).',
    parameters: {
      type: 'object',
      properties: { dir: { type: 'string', description: 'Sandbox-relative directory. Optional.' } },
      required: [],
    },
  },
];

// Group B — web research tools (live when CONDUCTOR_WEB=live, else simulated).
const WEB_TOOLS = [
  {
    name: 'web_search',
    description:
      'Search the web for current information and return ranked results (title, url, snippet). ' +
      'Use for recent events, facts to verify, or anything beyond the model’s training data.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query.' },
        max_results: { type: 'number', description: 'How many results to return (default 5, max 10).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'fetch_url',
    description: 'Fetch a web page or API endpoint by URL and return its text content (HTML is stripped to text).',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'An absolute http(s) URL.' },
      },
      required: ['url'],
    },
  },
];

// Group C — data & document analysis (pure compute, always runs for real).
const DATA_TOOLS = [
  {
    name: 'analyze_data',
    description:
      'Parse and summarise a structured dataset provided inline. Detects CSV/TSV/JSON, reports row/column ' +
      'counts, and computes per-column numeric statistics (min, max, mean, median).',
    parameters: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'The raw dataset text (CSV, TSV, or JSON array of objects).' },
        format: { type: 'string', enum: ['auto', 'csv', 'tsv', 'json'], description: 'Input format (default auto).' },
      },
      required: ['data'],
    },
  },
];

// Group D — everyday utilities (pure, always real).
const UTILITY_TOOLS = [
  {
    name: 'calculator',
    description: 'Evaluate an arithmetic expression (+, -, *, /, %, parentheses, decimals) and return the result.',
    parameters: {
      type: 'object',
      properties: { expression: { type: 'string', description: 'e.g. "(1234 * 56) / 7 + 2.5".' } },
      required: ['expression'],
    },
  },
  {
    name: 'current_time',
    description: 'Return the current date and time (UTC by default, or a given IANA timezone).',
    parameters: {
      type: 'object',
      properties: { timezone: { type: 'string', description: 'IANA tz, e.g. "America/New_York". Optional.' } },
      required: [],
    },
  },
];

export const TOOLS = [...SANDBOX_TOOLS, ...WEB_TOOLS, ...DATA_TOOLS, ...UTILITY_TOOLS];

export const TOOL_NAMES = TOOLS.map((t) => t.name);

// Tools that perform pure, side-effect-free compute — run for real in every
// executor (including simulated mode), since they touch no network or disk.
export const PURE_TOOL_NAMES = ['analyze_data', 'calculator', 'current_time'];

export function getTool(name) {
  return TOOLS.find((t) => t.name === name) || null;
}
