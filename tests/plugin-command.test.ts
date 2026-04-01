import { assert, test } from 'poku';
import {
  buildRunnerCommand,
  canHandleRuntime,
  resolveDomSetupPath,
} from '../src/plugin-command.ts';

test('canHandleRuntime supports node, bun and deno', async () => {
  assert.strictEqual(canHandleRuntime('node'), true);
  assert.strictEqual(canHandleRuntime('bun'), true);
  assert.strictEqual(canHandleRuntime('deno'), true);
  assert.strictEqual(canHandleRuntime('python'), false);
});

test('buildRunnerCommand injects imports and runtime args for node', async () => {
  const result = buildRunnerCommand({
    runtime: 'node',
    command: ['node', '--trace-warnings', 'tests/example.test.tsx'],
    file: 'tests/example.test.tsx',
    domSetupPath: '/tmp/dom-setup.ts',
    runtimeOptionArgs: ['--poku-react-dom-url=http://example.local/'],
  });

  assert.strictEqual(result.shouldHandle, true);
  assert.deepStrictEqual(result.command, [
    'node',
    '--trace-warnings',
    '--import=tsx',
    '--import=/tmp/dom-setup.ts',
    'tests/example.test.tsx',
    '--poku-react-dom-url=http://example.local/',
  ]);
});

test('buildRunnerCommand injects deno preload and avoids duplicates', async () => {
  const result = buildRunnerCommand({
    runtime: 'deno',
    command: [
      'deno',
      'run',
      '-A',
      '--preload=/tmp/dom-setup.ts',
      'tests/example.test.tsx',
      '--poku-react-metrics=1',
    ],
    file: 'tests/example.test.tsx',
    domSetupPath: '/tmp/dom-setup.ts',
    runtimeOptionArgs: ['--poku-react-metrics=1'],
  });

  assert.strictEqual(result.shouldHandle, true);
  assert.deepStrictEqual(result.command, [
    'deno',
    'run',
    '-A',
    '--preload=/tmp/dom-setup.ts',
    'tests/example.test.tsx',
    '--poku-react-metrics=1',
  ]);
});

test('buildRunnerCommand leaves unsupported runtime unchanged', async () => {
  const original = ['python', 'tests/example.test.tsx'];
  const result = buildRunnerCommand({
    runtime: 'python',
    command: original,
    file: 'tests/example.test.tsx',
    domSetupPath: '/tmp/dom-setup.ts',
    runtimeOptionArgs: [],
  });

  assert.strictEqual(result.shouldHandle, false);
  assert.deepStrictEqual(result.command, original);
});

test('resolveDomSetupPath resolves built-in and custom adapters', async () => {
  const happyPath = resolveDomSetupPath('happy-dom');
  const jsdomPath = resolveDomSetupPath('jsdom');
  const customPath = resolveDomSetupPath({
    setupModule: 'tests/setup/custom.ts',
  });

  assert.ok(happyPath.includes('dom-setup-happy'));
  assert.ok(jsdomPath.includes('dom-setup-jsdom'));
  assert.ok(customPath.endsWith('/tests/setup/custom.ts'));
});
