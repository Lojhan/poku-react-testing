export type ReactDomAdapter = 'happy-dom' | 'jsdom' | { setupModule: string };

export type RenderMetric = {
  file: string;
  componentName: string;
  durationMs: number;
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

export type NormalizedMetricsOptions = {
  enabled: boolean;
  topN: number;
  minDurationMs: number;
  reporter?: (summary: ReactMetricsSummary) => void;
};
