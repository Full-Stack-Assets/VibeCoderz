import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {
  runAgenticTurn,
  makeSimulatedPlanner,
  ToolRegistry,
  SimulatedExecutor,
  LocalSandboxExecutor,
} from '../src/index.js';

test('agentic turn writes and runs a file, returning a step trace', async () => {
  const registry = new ToolRegistry({ executor: new SimulatedExecutor() });
  const planner = makeSimulatedPlanner([{ role: 'user', content: 'create a file app.js and run it' }]);
  const { text, steps } = await runAgenticTurn({ planner, registry });
  assert.ok(steps.length >= 2);
  assert.equal(steps[0].tool, 'write_file');
  assert.equal(steps[1].tool, 'run_command');
  assert.match(text, /agentic/);
});

test('a non-tool request returns a final answer with no steps', async () => {
  const registry = new ToolRegistry({ executor: new SimulatedExecutor() });
  const planner = makeSimulatedPlanner([{ role: 'user', content: 'what is the capital of France?' }]);
  const { steps } = await runAgenticTurn({ planner, registry });
  assert.equal(steps.length, 0);
});

test('loop executes tools for real against the local sandbox', async () => {
  const root = path.join(os.tmpdir(), `conductor-loop-${Date.now()}`);
  const registry = new ToolRegistry({ executor: new LocalSandboxExecutor({ root }) });
  const planner = makeSimulatedPlanner([{ role: 'user', content: 'write a script hello.js and run it' }]);
  const { steps } = await runAgenticTurn({ planner, registry });
  const run = steps.find((s) => s.tool === 'run_command');
  assert.ok(run, 'a run_command step exists');
  assert.equal(run.result.ok, true);
  assert.match(run.result.output, /Conductor ran hello\.js/);
});

test('respects the maxSteps cap with a runaway planner', async () => {
  const registry = new ToolRegistry({ executor: new SimulatedExecutor() });
  const planner = async () => ({ type: 'tool', tool: 'list_files', args: {} });
  const { steps } = await runAgenticTurn({ planner, registry, maxSteps: 3 });
  assert.equal(steps.length, 3);
});

test('list intent triggers a single list_files step', async () => {
  const registry = new ToolRegistry({ executor: new SimulatedExecutor() });
  const planner = makeSimulatedPlanner([{ role: 'user', content: 'list the files in the project' }]);
  const { steps } = await runAgenticTurn({ planner, registry });
  assert.equal(steps.length, 1);
  assert.equal(steps[0].tool, 'list_files');
});
