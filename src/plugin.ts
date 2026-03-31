import { definePlugin } from 'poku/plugins';
import { fileURLToPath } from 'node:url';
import { dirname, extname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

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

const isRenderMetricMessage = (message: unknown): message is RenderMetricMessage => {
	if (!message || typeof message !== 'object') return false;
	return (message as Record<string, unknown>).type === 'POKU_REACT_RENDER_METRIC';
};

const getComponentName = (componentName: unknown) =>
	typeof componentName === 'string' && componentName.length > 0
		? componentName
		: 'AnonymousComponent';

const isTsxImport = (arg: string) => arg === '--import=tsx' || arg === '--loader=tsx';

const resolveDomSetupPath = (adapter: ReactDomAdapter | undefined) => {
 	if (!adapter || adapter === 'happy-dom') return happyDomSetupPath;
	if (adapter === 'jsdom') return jsdomSetupPath;

 	return resolve(process.cwd(), adapter.setupModule);
};

const normalizeMetricsOptions = (
	metrics: ReactTestingPluginOptions['metrics'],
): NormalizedMetricsOptions => {
	if (metrics === true) {
		return {
			enabled: true,
			topN: 5,
			minDurationMs: 0,
		};
	}

	if (!metrics) {
		return {
			enabled: false,
			topN: 5,
			minDurationMs: 0,
		};
	}

	const normalized: NormalizedMetricsOptions = {
		enabled: metrics.enabled ?? true,
		topN: Number.isFinite(metrics.topN) && Number(metrics.topN) > 0 ? Math.floor(Number(metrics.topN)) : 5,
		minDurationMs:
			Number.isFinite(metrics.minDurationMs) && Number(metrics.minDurationMs) >= 0
				? Number(metrics.minDurationMs)
				: 0,
	};

	if (metrics.reporter) normalized.reporter = metrics.reporter;

	return normalized;
};

/**
 * Create a Poku plugin that prepares DOM globals and TSX execution for React tests.
 */
export const createReactTestingPlugin = (options: ReactTestingPluginOptions = {}) => {
	const metrics: RenderMetric[] = [];
	const previousDomUrl = process.env.POKU_REACT_DOM_URL;
	const previousMetricsFlag = process.env.POKU_REACT_ENABLE_METRICS;
	const domSetupPath = resolveDomSetupPath(options.dom);
	const metricsOptions = normalizeMetricsOptions(options.metrics);

	if (options.domUrl) {
		process.env.POKU_REACT_DOM_URL = options.domUrl;
	}

	if (metricsOptions.enabled) {
		process.env.POKU_REACT_ENABLE_METRICS = '1';
	}

	return definePlugin({
		name: 'react-testing',
		ipc: metricsOptions.enabled,

		runner(command, file) {
			if (command[0] !== 'node') return command;
			if (!reactExtensions.has(extname(file))) return command;

			const fileIndex = command.lastIndexOf(file);
			if (fileIndex === -1) return command;

			const beforeFile = command.slice(1, fileIndex);
			const afterFile = command.slice(fileIndex + 1);

			const hasTsx = beforeFile.some(isTsxImport);
			const hasDomSetup = beforeFile.some((arg) => arg === `--import=${domSetupPath}`);

			const extraImports: string[] = [];
			if (!hasTsx) extraImports.push('--import=tsx');
			if (!hasDomSetup) extraImports.push(`--import=${domSetupPath}`);

			return ['node', ...beforeFile, ...extraImports, file, ...afterFile];
		},

		onTestProcess(child, file) {
			if (!metricsOptions.enabled) return;

			child.on('message', (message) => {
				if (!isRenderMetricMessage(message)) return;

				metrics.push({
					file,
					componentName: getComponentName(message.componentName),
					durationMs: Number(message.durationMs) || 0,
				});
			});
		},

		teardown() {
			if (typeof previousDomUrl === 'undefined') {
				delete process.env.POKU_REACT_DOM_URL;
			} else {
				process.env.POKU_REACT_DOM_URL = previousDomUrl;
			}

			if (typeof previousMetricsFlag === 'undefined') {
				delete process.env.POKU_REACT_ENABLE_METRICS;
			} else {
				process.env.POKU_REACT_ENABLE_METRICS = previousMetricsFlag;
			}

			if (!metricsOptions.enabled || metrics.length === 0) return;

			const topSlowest = [...metrics]
				.filter((metric) => metric.durationMs >= metricsOptions.minDurationMs)
				.sort((a, b) => b.durationMs - a.durationMs)
				.slice(0, metricsOptions.topN);

			if (topSlowest.length === 0) return;

			const summary: ReactMetricsSummary = {
				totalCaptured: metrics.length,
				totalReported: topSlowest.length,
				topSlowest,
			};

			if (metricsOptions.reporter) {
				metricsOptions.reporter(summary);
				return;
			}

			const lines = topSlowest.map(
				(metric) =>
					`  - ${metric.componentName} in ${metric.file}: ${metric.durationMs.toFixed(2)}ms`,
			);

			console.log('\n[poku-react-testing] Slowest component renders');
			for (const line of lines) console.log(line);
		},
	});
};

/**
 * Alias for `createReactTestingPlugin`.
 */
export const reactTestingPlugin = createReactTestingPlugin;
