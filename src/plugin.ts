import type {
  ReactDomAdapter,
  ReactMetricsOptions,
  ReactMetricsSummary,
  ReactTestingPluginOptions,
  RenderMetric,
} from './plugin-types.ts';
import { definePlugin } from 'poku/plugins';
import {
  buildRunnerCommand,
  canHandleRuntime,
  resolveDomSetupPath,
} from './plugin-command.ts';
import {
  buildRuntimeOptionArgs,
  createMetricsSummary,
  getComponentName,
  isRenderMetricBatchMessage,
  isRenderMetricMessage,
  normalizeMetricsOptions,
  printMetricsSummary,
  selectTopSlowestMetrics,
} from './plugin-metrics.ts';
import { setupInProcessEnvironment } from './plugin-setup.ts';

export type {
  ReactDomAdapter,
  ReactMetricsOptions,
  ReactMetricsSummary,
  ReactTestingPluginOptions,
};

/**
 * Create a Poku plugin that prepares DOM globals and TSX execution for React tests.
 */
export const createReactTestingPlugin = (
  options: ReactTestingPluginOptions = {}
) => {
  let metrics: RenderMetric[] = [];
  let cleanupNodeTsxLoader: (() => void) | undefined;
  const domSetupPath = resolveDomSetupPath(options.dom);
  const metricsOptions = normalizeMetricsOptions(options.metrics);
  const runtimeOptionArgs = buildRuntimeOptionArgs(options, metricsOptions);

  return definePlugin({
    name: 'react-testing',
    ipc: metricsOptions.enabled,

    async setup(context) {
      cleanupNodeTsxLoader = await setupInProcessEnvironment({
        isolation: context.configs.isolation,
        runtime: context.runtime,
        runtimeOptionArgs,
        domSetupPath,
      });
    },

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
      cleanupNodeTsxLoader?.();
      cleanupNodeTsxLoader = undefined;

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
