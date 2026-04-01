import { assert, test } from 'poku';
import { __internal } from '../src/plugin.ts';

test('normalizes metrics defaults when disabled', async () => {
  const normalized = __internal.normalizeMetricsOptions(undefined);

  assert.strictEqual(normalized.enabled, false);
  assert.strictEqual(normalized.topN, 5);
  assert.strictEqual(normalized.minDurationMs, 0);
});

test('normalizes metrics with option object', async () => {
  const reporterCalls: number[] = [];
  const normalized = __internal.normalizeMetricsOptions({
    enabled: true,
    topN: 9.8,
    minDurationMs: 2.5,
    reporter(summary) {
      reporterCalls.push(summary.totalCaptured);
    },
  });

  assert.strictEqual(normalized.enabled, true);
  assert.strictEqual(normalized.topN, 9);
  assert.strictEqual(normalized.minDurationMs, 2.5);
  assert.strictEqual(typeof normalized.reporter, 'function');
  assert.strictEqual(reporterCalls.length, 0);
});

test('buildRunnerCommand injects tsx and dom setup for node', async () => {
  const result = __internal.buildRunnerCommand({
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

test('buildRunnerCommand injects dom setup for bun without tsx import', async () => {
  const result = __internal.buildRunnerCommand({
    runtime: 'bun',
    command: ['bun', 'tests/example.test.tsx'],
    file: 'tests/example.test.tsx',
    domSetupPath: '/tmp/dom-setup.ts',
    runtimeOptionArgs: ['--poku-react-metrics=1'],
  });

  assert.strictEqual(result.shouldHandle, true);
  assert.deepStrictEqual(result.command, [
    'bun',
    '--import=/tmp/dom-setup.ts',
    'tests/example.test.tsx',
    '--poku-react-metrics=1',
  ]);
});

test('buildRunnerCommand injects preload for deno', async () => {
  const result = __internal.buildRunnerCommand({
    runtime: 'deno',
    command: ['deno', 'run', '-A', 'tests/example.test.tsx'],
    file: 'tests/example.test.tsx',
    domSetupPath: '/tmp/dom-setup.ts',
    runtimeOptionArgs: ['--poku-react-min-metric-ms=1.5'],
  });

  assert.strictEqual(result.shouldHandle, true);
  assert.deepStrictEqual(result.command, [
    'deno',
    'run',
    '-A',
    '--preload=/tmp/dom-setup.ts',
    'tests/example.test.tsx',
    '--poku-react-min-metric-ms=1.5',
  ]);
});

test('buildRunnerCommand leaves unsupported runtime unchanged', async () => {
  const original = ['python', 'tests/example.test.tsx'];
  const result = __internal.buildRunnerCommand({
    runtime: 'python',
    command: original,
    file: 'tests/example.test.tsx',
    domSetupPath: '/tmp/dom-setup.ts',
    runtimeOptionArgs: [],
  });

  assert.strictEqual(result.shouldHandle, false);
  assert.deepStrictEqual(result.command, original);
});

test('buildRunnerCommand leaves non-react extension unchanged', async () => {
  const original = ['node', 'tests/example.test.ts'];
  const result = __internal.buildRunnerCommand({
    runtime: 'node',
    command: original,
    file: 'tests/example.test.ts',
    domSetupPath: '/tmp/dom-setup.ts',
    runtimeOptionArgs: [],
  });

  assert.strictEqual(result.shouldHandle, false);
  assert.deepStrictEqual(result.command, original);
});

test('buildRunnerCommand avoids duplicate runtime args', async () => {
  const result = __internal.buildRunnerCommand({
    runtime: 'node',
    command: [
      'node',
      '--trace-warnings',
      'tests/example.test.tsx',
      '--poku-react-metrics=1',
    ],
    file: 'tests/example.test.tsx',
    domSetupPath: '/tmp/dom-setup.ts',
    runtimeOptionArgs: ['--poku-react-metrics=1'],
  });

  assert.deepStrictEqual(result.command, [
    'node',
    '--trace-warnings',
    '--import=tsx',
    '--import=/tmp/dom-setup.ts',
    'tests/example.test.tsx',
    '--poku-react-metrics=1',
  ]);
});

test('buildRuntimeOptionArgs creates argv-safe plugin flags', async () => {
  const args = __internal.buildRuntimeOptionArgs(
    { domUrl: 'http://example.local/', metrics: true },
    __internal.normalizeMetricsOptions({ enabled: true, minDurationMs: 2.75 })
  );

  assert.deepStrictEqual(args, [
    '--poku-react-dom-url=http://example.local/',
    '--poku-react-metrics=1',
    '--poku-react-min-metric-ms=2.75',
  ]);
});

test('normalizeMetricsOptions ignores invalid non-number containers', async () => {
  const normalized = __internal.normalizeMetricsOptions({
    enabled: true,
    topN: [42] as unknown as number,
    minDurationMs: ['4'] as unknown as number,
  });

  assert.strictEqual(normalized.topN, 5);
  assert.strictEqual(normalized.minDurationMs, 0);
});

test('createMetricsSummary returns ordered top metrics with filters', async () => {
  const metrics = [
    { file: 'a', componentName: 'A', durationMs: 0.4 },
    { file: 'b', componentName: 'B', durationMs: 4.2 },
    { file: 'c', componentName: 'C', durationMs: 3.3 },
  ];

  const summary = __internal.createMetricsSummary(
    metrics,
    __internal.normalizeMetricsOptions({
      enabled: true,
      topN: 2,
      minDurationMs: 1,
    })
  );

  assert.ok(summary);
  assert.strictEqual(summary?.totalCaptured, 3);
  assert.strictEqual(summary?.totalReported, 2);
  assert.deepStrictEqual(
    summary?.topSlowest.map((item) => item.componentName),
    ['B', 'C']
  );
});

test('createMetricsSummary returns null when disabled', async () => {
  const summary = __internal.createMetricsSummary(
    [{ file: 'a', componentName: 'A', durationMs: 8 }],
    __internal.normalizeMetricsOptions(false)
  );

  assert.strictEqual(summary, null);
});

test('getComponentName falls back for non-string values', async () => {
  assert.strictEqual(__internal.getComponentName('MyComp'), 'MyComp');
  assert.strictEqual(__internal.getComponentName(''), 'AnonymousComponent');
  assert.strictEqual(__internal.getComponentName(null), 'AnonymousComponent');
});

test('isRenderMetricMessage validates expected payloads', async () => {
  assert.strictEqual(
    __internal.isRenderMetricMessage({ type: 'POKU_REACT_RENDER_METRIC' }),
    true
  );
  assert.strictEqual(
    __internal.isRenderMetricMessage({ type: 'OTHER' }),
    false
  );
  assert.strictEqual(__internal.isRenderMetricMessage(null), false);
});

test('isRenderMetricBatchMessage validates batched payloads', async () => {
  assert.strictEqual(
    __internal.isRenderMetricBatchMessage({
      type: 'POKU_REACT_RENDER_METRIC_BATCH',
      metrics: [{ componentName: 'A', durationMs: 1.2 }],
    }),
    true
  );

  assert.strictEqual(
    __internal.isRenderMetricBatchMessage({
      type: 'POKU_REACT_RENDER_METRIC_BATCH',
    }),
    false
  );
  assert.strictEqual(__internal.isRenderMetricBatchMessage(null), false);
});

test('resolveDomSetupPath resolves built-in and custom adapters', async () => {
  const happyPath = __internal.resolveDomSetupPath('happy-dom');
  const jsdomPath = __internal.resolveDomSetupPath('jsdom');
  const customPath = __internal.resolveDomSetupPath({
    setupModule: 'tests/setup/custom.ts',
  });

  assert.ok(happyPath.includes('dom-setup-happy'));
  assert.ok(jsdomPath.includes('dom-setup-jsdom'));
  assert.ok(customPath.endsWith('/tests/setup/custom.ts'));
});
