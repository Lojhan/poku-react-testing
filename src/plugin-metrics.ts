import type {
  NormalizedMetricsOptions,
  ReactMetricsSummary,
  ReactTestingPluginOptions,
  RenderMetric,
} from './plugin-types.ts';
import { runtimeOptionArgPrefixes } from './runtime-options.ts';

type RenderMetricMessage = {
  type: 'POKU_REACT_RENDER_METRIC';
  componentName?: string;
  durationMs?: number;
};

type RenderMetricBatchMessage = {
  type: 'POKU_REACT_RENDER_METRIC_BATCH';
  metrics: Array<{
    componentName?: string;
    durationMs?: number;
  }>;
};

const DEFAULT_TOP_N = 5;
const DEFAULT_MIN_DURATION_MS = 0;

export const isRenderMetricMessage = (
  message: unknown
): message is RenderMetricMessage => {
  if (!message || typeof message !== 'object') return false;
  return (
    (message as Record<string, unknown>).type === 'POKU_REACT_RENDER_METRIC'
  );
};

export const isRenderMetricBatchMessage = (
  message: unknown
): message is RenderMetricBatchMessage => {
  if (!message || typeof message !== 'object') return false;

  const record = message as Record<string, unknown>;
  return (
    record.type === 'POKU_REACT_RENDER_METRIC_BATCH' &&
    Array.isArray(record.metrics)
  );
};

export const getComponentName = (componentName: unknown) =>
  typeof componentName === 'string' && componentName.length > 0
    ? componentName
    : 'AnonymousComponent';

const getPositiveIntegerOrDefault = (value: unknown, fallback: number) => {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value.trim())
        : NaN;

  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.floor(numeric);
};

const getNonNegativeNumberOrDefault = (value: unknown, fallback: number) => {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value.trim())
        : NaN;

  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric;
};

export const buildRuntimeOptionArgs = (
  options: ReactTestingPluginOptions,
  metricsOptions: NormalizedMetricsOptions
) => {
  const args: string[] = [];

  if (options.domUrl) {
    args.push(`${runtimeOptionArgPrefixes.domUrl}${options.domUrl}`);
  }

  if (metricsOptions.enabled) {
    args.push(`${runtimeOptionArgPrefixes.metrics}1`);
    args.push(
      `${runtimeOptionArgPrefixes.minMetricMs}${metricsOptions.minDurationMs}`
    );
  }

  return args;
};

export const normalizeMetricsOptions = (
  metrics: ReactTestingPluginOptions['metrics']
): NormalizedMetricsOptions => {
  if (metrics === true) {
    return {
      enabled: true,
      topN: DEFAULT_TOP_N,
      minDurationMs: DEFAULT_MIN_DURATION_MS,
    };
  }

  if (!metrics) {
    return {
      enabled: false,
      topN: DEFAULT_TOP_N,
      minDurationMs: DEFAULT_MIN_DURATION_MS,
    };
  }

  const normalized: NormalizedMetricsOptions = {
    enabled: metrics.enabled ?? true,
    topN: getPositiveIntegerOrDefault(metrics.topN, DEFAULT_TOP_N),
    minDurationMs: getNonNegativeNumberOrDefault(
      metrics.minDurationMs,
      DEFAULT_MIN_DURATION_MS
    ),
  };

  if (metrics.reporter) normalized.reporter = metrics.reporter;

  return normalized;
};

export const selectTopSlowestMetrics = (
  metrics: RenderMetric[],
  options: NormalizedMetricsOptions
) =>
  [...metrics]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, options.topN);

export const createMetricsSummary = (
  metrics: RenderMetric[],
  options: NormalizedMetricsOptions
): ReactMetricsSummary | null => {
  if (!options.enabled || metrics.length === 0) return null;

  const topSlowest = selectTopSlowestMetrics(metrics, options);
  if (topSlowest.length === 0) return null;

  return {
    totalCaptured: metrics.length,
    totalReported: topSlowest.length,
    topSlowest,
  };
};

export const printMetricsSummary = (summary: ReactMetricsSummary) => {
  const lines = summary.topSlowest.map(
    (metric) =>
      `  - ${metric.componentName} in ${metric.file}: ${metric.durationMs.toFixed(2)}ms`
  );

  console.log('\n[poku-react-testing] Slowest component renders');
  for (const line of lines) console.log(line);
};
