const DEFAULT_DOM_URL = 'http://localhost:3000/';
const DEFAULT_METRIC_BATCH_SIZE = 50;
const DEFAULT_METRIC_FLUSH_MS = 50;

const METRICS_FLAG_PREFIX = '--poku-react-metrics=';
const MIN_METRIC_MS_PREFIX = '--poku-react-min-metric-ms=';
const DOM_URL_PREFIX = '--poku-react-dom-url=';
const METRIC_BATCH_SIZE_PREFIX = '--poku-react-metric-batch-size=';
const METRIC_FLUSH_MS_PREFIX = '--poku-react-metric-flush-ms=';

export type RuntimeOptions = {
  domUrl: string;
  metricsEnabled: boolean;
  minMetricMs: number;
  metricBatchSize: number;
  metricFlushMs: number;
};

const parseFlagValue = (prefix: string, argv: string[]) => {
  for (const arg of argv) {
    if (!arg.startsWith(prefix)) continue;
    return arg.slice(prefix.length);
  }

  return undefined;
};

const parseBooleanFlag = (value: string | undefined) => {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true';
};

const parseFiniteNumber = (value: string | undefined, fallback: number) => {
  if (!value || value.trim() === '') return fallback;

  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) return fallback;

  return parsed;
};

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = parseFiniteNumber(value, fallback);
  if (parsed <= 0) return fallback;
  return Math.floor(parsed);
};

export const parseRuntimeOptions = (
  argv: string[] = process.argv
): RuntimeOptions => {
  const metricsEnabled = parseBooleanFlag(
    parseFlagValue(METRICS_FLAG_PREFIX, argv)
  );

  return {
    domUrl: parseFlagValue(DOM_URL_PREFIX, argv) || DEFAULT_DOM_URL,
    metricsEnabled,
    minMetricMs: Math.max(
      0,
      parseFiniteNumber(parseFlagValue(MIN_METRIC_MS_PREFIX, argv), 0)
    ),
    metricBatchSize: parsePositiveInteger(
      parseFlagValue(METRIC_BATCH_SIZE_PREFIX, argv),
      DEFAULT_METRIC_BATCH_SIZE
    ),
    metricFlushMs: parsePositiveInteger(
      parseFlagValue(METRIC_FLUSH_MS_PREFIX, argv),
      DEFAULT_METRIC_FLUSH_MS
    ),
  };
};

export const runtimeOptionArgPrefixes = {
  metrics: METRICS_FLAG_PREFIX,
  minMetricMs: MIN_METRIC_MS_PREFIX,
  domUrl: DOM_URL_PREFIX,
  metricBatchSize: METRIC_BATCH_SIZE_PREFIX,
  metricFlushMs: METRIC_FLUSH_MS_PREFIX,
};
