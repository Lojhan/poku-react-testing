import type {
  NormalizedMetricsOptions,
  ReactMetricsSummary,
  ReactTestingPluginOptions,
  RenderMetric,
} from './plugin-types.ts';
import {
  buildRuntimeOptionArgs as buildCoreRuntimeOptionArgs,
  createMetricsSummary,
  getComponentName,
  isRenderMetricBatchMessage as isCoreRenderMetricBatchMessage,
  isRenderMetricMessage as isCoreRenderMetricMessage,
  normalizeMetricsOptions,
  printMetricsSummary as printCoreMetricsSummary,
  selectTopSlowestMetrics,
} from '@pokujs/dom';
import { runtimeOptionArgPrefixes } from './runtime-options.ts';

const REACT_RENDER_METRIC = 'POKU_REACT_RENDER_METRIC';
const REACT_RENDER_METRIC_BATCH = 'POKU_REACT_RENDER_METRIC_BATCH';

export const isRenderMetricMessage = (message: unknown) =>
  isCoreRenderMetricMessage(message, REACT_RENDER_METRIC);

export const isRenderMetricBatchMessage = (message: unknown) =>
  isCoreRenderMetricBatchMessage(message, REACT_RENDER_METRIC_BATCH);

export const buildRuntimeOptionArgs = (
  options: ReactTestingPluginOptions,
  metricsOptions: NormalizedMetricsOptions
) => buildCoreRuntimeOptionArgs(options, metricsOptions, runtimeOptionArgPrefixes);

export const printMetricsSummary = (summary: ReactMetricsSummary) =>
  printCoreMetricsSummary(summary, '@pokujs/react');

export {
  createMetricsSummary,
  getComponentName,
  normalizeMetricsOptions,
  selectTopSlowestMetrics,
};

export type { RenderMetric };
