/**
 * TOOL DEFINITIONS — the agent's capabilities, as provider-ready schemas.
 *
 * Ported in spirit from the vibe platform's sandbox tools (create-sandbox,
 * run-command, generate-files, …). Each tool has a JSON-Schema `parameters`
 * block so it can be handed directly to a provider's tool-calling API
 * (Anthropic `tools`, OpenAI `tools`) when running live, and dispatched to an
 * Executor for actual execution. The COO engine routes the turn to a model; the
 * model then drives these tools inside a sandbox.
 */

export const TOOLS = [
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

export const TOOL_NAMES = TOOLS.map((t) => t.name);

export function getTool(name) {
  return TOOLS.find((t) => t.name === name) || null;
}
