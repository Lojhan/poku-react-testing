import { assert, test } from 'poku';
import {
  buildRuntimeOptionArgs,
  createMetricsSummary,
  getComponentName,
  isRenderMetricBatchMessage,
  isRenderMetricMessage,
  normalizeMetricsOptions,
  selectTopSlowestMetrics,
} from '../src/plugin-metrics.ts';

test('normalizeMetricsOptions uses defaults when disabled', async () => {
  const normalized = normalizeMetricsOptions(undefined);

  assert.strictEqual(normalized.enabled, false);
  assert.strictEqual(normalized.topN, 5);
  assert.strictEqual(normalized.minDurationMs, 0);
});

test('normalizeMetricsOptions sanitizes numeric fields', async () => {
  const normalized = normalizeMetricsOptions({
    enabled: true,
    topN: 9.7,
    minDurationMs: 2.5,
  });

  assert.strictEqual(normalized.enabled, true);
  assert.strictEqual(normalized.topN, 9);
  assert.strictEqual(normalized.minDurationMs, 2.5);
});

test('buildRuntimeOptionArgs emits stable CLI flags', async () => {
  const args = buildRuntimeOptionArgs(
    { domUrl: 'http://example.local/', metrics: true },
    normalizeMetricsOptions({ enabled: true, minDurationMs: 2.75 })
  );

  assert.deepStrictEqual(args, [
    '--poku-react-dom-url=http://example.local/',
    '--poku-react-metrics=1',
    '--poku-react-min-metric-ms=2.75',
  ]);
});

test('selectTopSlowestMetrics sorts and truncates', async () => {
  const top = selectTopSlowestMetrics(
    [
      { file: 'a', componentName: 'A', durationMs: 1 },
      { file: 'b', componentName: 'B', durationMs: 4 },
      { file: 'c', componentName: 'C', durationMs: 3 },
    ],
    normalizeMetricsOptions({ enabled: true, topN: 2 })
  );

  assert.deepStrictEqual(
    top.map((metric) => metric.componentName),
    ['B', 'C']
  );
});

test('createMetricsSummary returns null when disabled or empty', async () => {
  assert.strictEqual(
    createMetricsSummary([], normalizeMetricsOptions(true)),
    null
  );
  assert.strictEqual(
    createMetricsSummary(
      [{ file: 'a', componentName: 'A', durationMs: 8 }],
      normalizeMetricsOptions(false)
    ),
    null
  );
});

test('createMetricsSummary reports top metrics', async () => {
  const summary = createMetricsSummary(
    [
      { file: 'a', componentName: 'A', durationMs: 0.4 },
      { file: 'b', componentName: 'B', durationMs: 4.2 },
      { file: 'c', componentName: 'C', durationMs: 3.3 },
    ],
    normalizeMetricsOptions({ enabled: true, topN: 2, minDurationMs: 1 })
  );

  assert.ok(summary);
  assert.strictEqual(summary?.totalCaptured, 3);
  assert.strictEqual(summary?.totalReported, 2);
  assert.deepStrictEqual(
    summary?.topSlowest.map((item) => item.componentName),
    ['B', 'C']
  );
});

test('metric message guards validate expected payloads', async () => {
  assert.strictEqual(
    isRenderMetricMessage({ type: 'POKU_REACT_RENDER_METRIC' }),
    true
  );
  assert.strictEqual(isRenderMetricMessage({ type: 'OTHER' }), false);

  assert.strictEqual(
    isRenderMetricBatchMessage({
      type: 'POKU_REACT_RENDER_METRIC_BATCH',
      metrics: [{ componentName: 'A', durationMs: 1.2 }],
    }),
    true
  );
  assert.strictEqual(
    isRenderMetricBatchMessage({ type: 'POKU_REACT_RENDER_METRIC_BATCH' }),
    false
  );
});

test('getComponentName falls back for invalid values', async () => {
  assert.strictEqual(getComponentName('MyComp'), 'MyComp');
  assert.strictEqual(getComponentName(''), 'AnonymousComponent');
  assert.strictEqual(getComponentName(null), 'AnonymousComponent');
});
