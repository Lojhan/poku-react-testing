import { existsSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { definePlugin } from 'poku/plugins';
import { runtimeOptionArgPrefixes } from './runtime-options.ts';

const currentDir = dirname(fileURLToPath(import.meta.url));
const resolveSetupModulePath = (baseName: string) => {
  const jsPath = resolve(currentDir, `${baseName}.js`);
  if (existsSync(jsPath)) return jsPath;

  return resolve(currentDir, `${baseName}.ts`);
};

const happyDomSetupPath = resolveSetupModulePath('dom-setup-happy');
const jsdomSetupPath = resolveSetupModulePath('dom-setup-jsdom');

const reactExtensions = new Set(['.tsx', '.jsx']);

export type ReactDomAdapter = 'happy-dom' | 'jsdom' | { setupModule: string };

export type ReactTestingPluginOptions = {
  /**
   * DOM implementation used by test file processes.
   *
   * - `happy-dom`: fast default suitable for most component tests.
   * - `jsdom`: broader compatibility for browser-like APIs.
   * - `{ setupModule }`: custom module that prepares globals.
   */
  dom?: ReactDomAdapter;
  /**
   * URL assigned to the DOM environment.
   */
  domUrl?: string;
  /**
   * Render metrics configuration. Disabled by default for production-safe behavior.
   */
  metrics?: boolean | ReactMetricsOptions;
};

export type ReactMetricsSummary = {
  totalCaptured: number;
  totalReported: number;
  topSlowest: RenderMetric[];
};

export type ReactMetricsOptions = {
  /**
   * Enable or disable render metrics collection.
   */
  enabled?: boolean;
  /**
   * Maximum number of rows to display/report.
   * @default 5
   */
  topN?: number;
  /**
   * Minimum duration to include in the final report.
   * @default 0
   */
  minDurationMs?: number;
  /**
   * Custom reporter. Falls back to console output when omitted.
   */
  reporter?: (summary: ReactMetricsSummary) => void;
};

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

type RenderMetric = {
  file: string;
  componentName: string;
  durationMs: number;
};

type NormalizedMetricsOptions = {
  enabled: boolean;
  topN: number;
  minDurationMs: number;
  reporter?: (summary: ReactMetricsSummary) => void;
};

type RuntimeSupport = {
  supportsNodeLikeImport: boolean;
  supportsDenoPreload: boolean;
};

type BuildRunnerCommandInput = {
  runtime: string;
  command: string[];
  file: string;
  domSetupPath: string;
  runtimeOptionArgs: string[];
};

type BuildRunnerCommandOutput = {
  shouldHandle: boolean;
  command: string[];
};

const DEFAULT_TOP_N = 5;
const DEFAULT_MIN_DURATION_MS = 0;

const isRenderMetricMessage = (
  message: unknown
): message is RenderMetricMessage => {
  if (!message || typeof message !== 'object') return false;
  return (
    (message as Record<string, unknown>).type === 'POKU_REACT_RENDER_METRIC'
  );
};

const isRenderMetricBatchMessage = (
  message: unknown
): message is RenderMetricBatchMessage => {
  if (!message || typeof message !== 'object') return false;

  const record = message as Record<string, unknown>;
  return (
    record.type === 'POKU_REACT_RENDER_METRIC_BATCH' &&
    Array.isArray(record.metrics)
  );
};

const getComponentName = (componentName: unknown) =>
  typeof componentName === 'string' && componentName.length > 0
    ? componentName
    : 'AnonymousComponent';

const isTsxImport = (arg: string) =>
  arg === '--import=tsx' || arg === '--loader=tsx';
const isNodeRuntime = (runtime: string) => runtime === 'node';
const isBunRuntime = (runtime: string) => runtime === 'bun';
const isDenoRuntime = (runtime: string) => runtime === 'deno';

const getRuntimeSupport = (runtime: string): RuntimeSupport => ({
  supportsNodeLikeImport: isNodeRuntime(runtime) || isBunRuntime(runtime),
  supportsDenoPreload: isDenoRuntime(runtime),
});

const canHandleRuntime = (runtime: string) => {
  const support = getRuntimeSupport(runtime);
  return support.supportsNodeLikeImport || support.supportsDenoPreload;
};

const resolveDomSetupPath = (adapter: ReactDomAdapter | undefined) => {
  if (!adapter || adapter === 'happy-dom') return happyDomSetupPath;
  if (adapter === 'jsdom') return jsdomSetupPath;

  return resolve(process.cwd(), adapter.setupModule);
};

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

const buildRuntimeOptionArgs = (
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

const normalizeMetricsOptions = (
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

const buildRunnerCommand = ({
  runtime,
  command,
  file,
  domSetupPath,
  runtimeOptionArgs,
}: BuildRunnerCommandInput): BuildRunnerCommandOutput => {
  const support = getRuntimeSupport(runtime);

  if (!support.supportsNodeLikeImport && !support.supportsDenoPreload) {
    return { shouldHandle: false, command };
  }

  if (!reactExtensions.has(extname(file))) {
    return { shouldHandle: false, command };
  }

  // Optimization: find from the end to prevent false matches in directory names
  const fileIndex = command.lastIndexOf(file);
  if (fileIndex === -1) return { shouldHandle: false, command };

  const nodeImportFlag = `--import=${domSetupPath}`;
  const denoPreloadFlag = `--preload=${domSetupPath}`;
  const beforeFile: string[] = [];
  const afterFile: string[] = [];

  let hasTsx = false;
  let hasNodeLikeDomSetup = false;
  let hasDenoDomSetup = false;
  const existingArgs = new Set<string>();

  for (let index = 1; index < command.length; index += 1) {
    const arg = command[index];
    if (typeof arg !== 'string') continue;

    existingArgs.add(arg);

    if (index < fileIndex) {
      beforeFile.push(arg);

      if (isTsxImport(arg)) hasTsx = true;
      else if (arg === nodeImportFlag) hasNodeLikeDomSetup = true;
      else if (arg === denoPreloadFlag) hasDenoDomSetup = true;
      continue;
    }

    if (index > fileIndex) {
      afterFile.push(arg);
    }
  }

  const extraImports: string[] = [];
  if (isNodeRuntime(runtime) && !hasTsx) extraImports.push('--import=tsx');
  if (support.supportsNodeLikeImport && !hasNodeLikeDomSetup)
    extraImports.push(nodeImportFlag);
  if (support.supportsDenoPreload && !hasDenoDomSetup)
    extraImports.push(denoPreloadFlag);

  const runtimeArgsToInject: string[] = [];
  for (const runtimeOptionArg of runtimeOptionArgs) {
    if (existingArgs.has(runtimeOptionArg)) continue;
    runtimeArgsToInject.push(runtimeOptionArg);
  }

  return {
    shouldHandle: true,
    command: [
      runtime,
      ...beforeFile,
      ...extraImports,
      file,
      ...runtimeArgsToInject,
      ...afterFile,
    ],
  };
};

const selectTopSlowestMetrics = (
  metrics: RenderMetric[],
  options: NormalizedMetricsOptions
) =>
  [...metrics]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, options.topN);

const createMetricsSummary = (
  metrics: RenderMetric[],
  options: NormalizedMetricsOptions
): ReactMetricsSummary | null => {
  if (!options.enabled || metrics.length === 0) return null;

  const topSlowest = selectTopSlowestMetrics(metrics, options);
  if (topSlowest.length === 0) return null;

  return {
    totalCaptured: metrics.length, // Note: Represents captured over threshold
    totalReported: topSlowest.length,
    topSlowest,
  };
};

const printMetricsSummary = (summary: ReactMetricsSummary) => {
  const lines = summary.topSlowest.map(
    (metric) =>
      `  - ${metric.componentName} in ${metric.file}: ${metric.durationMs.toFixed(2)}ms`
  );

  console.log('\n[poku-react-testing] Slowest component renders');
  for (const line of lines) console.log(line);
};

/**
 * Create a Poku plugin that prepares DOM globals and TSX execution for React tests.
 */
export const createReactTestingPlugin = (
  options: ReactTestingPluginOptions = {}
) => {
  let metrics: RenderMetric[] = [];
  const domSetupPath = resolveDomSetupPath(options.dom);
  const metricsOptions = normalizeMetricsOptions(options.metrics);
  const runtimeOptionArgs = buildRuntimeOptionArgs(options, metricsOptions);

  return definePlugin({
    name: 'react-testing',
    ipc: metricsOptions.enabled,

    runner(command, file) {
      const runtime = command[0];
      if (!runtime) return command;
      const result = buildRunnerCommand({
        runtime,
        command,
        file,
        domSetupPath,
        runtimeOptionArgs,
      });

      return result.command;
    },

    onTestProcess(child, file) {
      if (!metricsOptions.enabled) return;

      child.on('message', (message) => {
        if (isRenderMetricBatchMessage(message)) {
          for (const metric of message.metrics) {
            const durationMs = Number(metric.durationMs) || 0;

            metrics.push({
              file,
              componentName: getComponentName(metric.componentName),
              durationMs,
            });
          }

          if (metrics.length > metricsOptions.topN * 10) {
            metrics = selectTopSlowestMetrics(metrics, metricsOptions);
          }

          return;
        }

        if (!isRenderMetricMessage(message)) return;

        const durationMs = Number(message.durationMs) || 0;

        metrics.push({
          file,
          componentName: getComponentName(message.componentName),
          durationMs,
        });

        // Optimization: Prevent unbounded memory growth on massive suites
        // Prune array back down periodically to keep only top candidates
        if (metrics.length > metricsOptions.topN * 10) {
          metrics = selectTopSlowestMetrics(metrics, metricsOptions);
        }
      });
    },

    teardown() {
      const summary = createMetricsSummary(metrics, metricsOptions);
      if (!summary) return;

      if (metricsOptions.reporter) {
        metricsOptions.reporter(summary);
        return;
      }

      printMetricsSummary(summary);
    },
  });
};

export const reactTestingPlugin = createReactTestingPlugin;

export const __internal = {
  buildRunnerCommand,
  canHandleRuntime,
  buildRuntimeOptionArgs,
  normalizeMetricsOptions,
  selectTopSlowestMetrics,
  createMetricsSummary,
  getComponentName,
  isRenderMetricMessage,
  isRenderMetricBatchMessage,
  resolveDomSetupPath,
};
