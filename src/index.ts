/** Plugin factory and alias for Poku integration. */
export { createReactTestingPlugin, reactTestingPlugin } from './plugin.ts';
export type {
  ReactDomAdapter,
  ReactMetricsOptions,
  ReactMetricsSummary,
  ReactTestingPluginOptions,
} from './plugin.ts';
/** React testing helpers and DX exports. */
export {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from './react-testing.ts';
export * from './react-testing.ts';
