import type {
  ReactDomAdapter,
  ReactMetricsOptions,
  ReactMetricsSummary,
  ReactTestingPluginOptions,
} from './plugin-types.ts';
import {
  createFrameworkTestingPluginFactory,
} from '@pokujs/dom';
import type { FrameworkDescriptor } from '@pokujs/dom';
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
  selectTopSlowestMetrics,
} from './plugin-metrics.ts';

const descriptor: FrameworkDescriptor = {
  pluginName: 'react-testing',
  packageTag: '@pokujs/react',
  runtimeArgBase: 'poku-react',
  metricMessageType: 'POKU_REACT_RENDER_METRIC',
  metricBatchMessageType: 'POKU_REACT_RENDER_METRIC_BATCH',
};

const { createTestingPlugin } = createFrameworkTestingPluginFactory(
  descriptor,
  import.meta.url
);

export type {
  ReactDomAdapter,
  ReactMetricsOptions,
  ReactMetricsSummary,
  ReactTestingPluginOptions,
};

export const createReactTestingPlugin = (
  options: ReactTestingPluginOptions = {}
) => createTestingPlugin(options);

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
