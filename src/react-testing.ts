import type {
  fireEvent as baseFireEvent,
  BoundFunctions,
  Screen,
} from '@testing-library/dom';
import type { ComponentType, PropsWithChildren, ReactElement } from 'react';
import type { Root } from 'react-dom/client';
import { getQueriesForElement, queries } from '@testing-library/dom';
import * as domTestingLibrary from '@testing-library/dom';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { parseRuntimeOptions } from './runtime-options.ts';

const { act } = React;

/** React `act` re-export for explicit async orchestration in tests. */
export { act };

type WrapperComponent = ComponentType<PropsWithChildren<unknown>>;

type InternalMounted = {
  root: Root | null;
  container: Element | null;
  ownsContainer: boolean;
};

const mountedRoots = new Set<InternalMounted>();

const getNow: () => number =
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now.bind(performance)
    : Date.now.bind(Date);

const getComponentName = (ui: ReactElement) => {
  const uiType = ui.type;
  if (!uiType) return 'AnonymousComponent';
  if (typeof uiType === 'string') return uiType;

  const typed = uiType as { displayName?: string; name?: string };
  return typed.displayName || typed.name || 'AnonymousComponent';
};

const runtimeOptions = parseRuntimeOptions();
const metricsEnabled = runtimeOptions.metricsEnabled;
const minMetricMs = runtimeOptions.minMetricMs;

type QueuedRenderMetric = {
  componentName: string;
  durationMs: number;
};

const metricBuffer: QueuedRenderMetric[] = [];
let metricFlushTimer: ReturnType<typeof setTimeout> | undefined;
let metricsChannelClosed = false;

const flushMetricBuffer = () => {
  if (!metricsEnabled || typeof process.send !== 'function') return;

  if (process.connected === false) {
    metricBuffer.length = 0;
    metricsChannelClosed = true;
    return;
  }

  if (metricsChannelClosed || metricBuffer.length === 0) return;

  const payload = metricBuffer.splice(0, metricBuffer.length);

  try {
    process.send({
      type: 'POKU_REACT_RENDER_METRIC_BATCH',
      metrics: payload,
    });
  } catch {
    metricsChannelClosed = true;
    metricBuffer.length = 0;
  }
};

const clearMetricFlushTimer = () => {
  if (!metricFlushTimer) return;
  clearTimeout(metricFlushTimer);
  metricFlushTimer = undefined;
};

const scheduleMetricFlush = () => {
  if (metricFlushTimer) return;

  metricFlushTimer = setTimeout(() => {
    metricFlushTimer = undefined;
    flushMetricBuffer();
  }, runtimeOptions.metricFlushMs);

  metricFlushTimer.unref?.();
};

if (metricsEnabled) {
  process.on('beforeExit', () => {
    clearMetricFlushTimer();
    flushMetricBuffer();
  });

  process.on('disconnect', () => {
    clearMetricFlushTimer();
    metricBuffer.length = 0;
    metricsChannelClosed = true;
  });
}

const emitRenderMetric = (componentName: string, durationMs: number) => {
  if (!metricsEnabled || typeof process.send !== 'function') return;

  if (process.connected === false || metricsChannelClosed) {
    metricBuffer.length = 0;
    metricsChannelClosed = true;
    clearMetricFlushTimer();
    return;
  }

  const safeDuration =
    Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0;

  // Optimization: Drop metrics below the threshold to prevent IPC flooding
  if (safeDuration < minMetricMs) return;

  metricBuffer.push({
    componentName,
    durationMs: safeDuration,
  });

  if (metricBuffer.length >= runtimeOptions.metricBatchSize) {
    clearMetricFlushTimer();
    flushMetricBuffer();
    return;
  }

  scheduleMetricFlush();
};

const wrapUi = (ui: ReactElement, Wrapper?: WrapperComponent) =>
  Wrapper ? React.createElement(Wrapper, null, ui) : ui;

export type RenderOptions = {
  container?: HTMLElement;
  baseElement?: HTMLElement;
  wrapper?: WrapperComponent;
  disableAct?: boolean;
};

export type RenderResult = BoundFunctions<typeof queries> & {
  container: HTMLElement;
  baseElement: HTMLElement;
  rerender: (ui: ReactElement) => void;
  unmount: () => void;
};

/**
 * Render a React element in an isolated container and return bound DOM queries.
 */
export const render = (
  ui: ReactElement,
  options: RenderOptions = {}
): RenderResult => {
  const baseElement = options.baseElement || document.body;
  const container = options.container || document.createElement('div');
  const ownsContainer = !options.container;

  if (ownsContainer) baseElement.appendChild(container);

  const root = createRoot(container);
  const mounted: InternalMounted = { root, container, ownsContainer };
  mountedRoots.add(mounted);

  const wrappedUi = wrapUi(ui, options.wrapper);
  const startedAt = getNow();

  if (options.disableAct) {
    root.render(wrappedUi);
  } else {
    act(() => {
      root.render(wrappedUi);
    });
  }

  emitRenderMetric(getComponentName(ui), getNow() - startedAt);

  const unmount = () => {
    if (!mountedRoots.has(mounted)) return;

    try {
      act(() => {
        mounted.root?.unmount();
      });
    } finally {
      if (mounted.ownsContainer && mounted.container?.parentNode) {
        mounted.container.parentNode.removeChild(mounted.container);
      }

      mounted.root = null;
      mounted.container = null;
      mountedRoots.delete(mounted);
    }
  };

  const rerender = (nextUi: ReactElement) => {
    if (options.disableAct) {
      root.render(wrapUi(nextUi, options.wrapper));
      return;
    }

    act(() => {
      root.render(wrapUi(nextUi, options.wrapper));
    });
  };

  return {
    ...getQueriesForElement(baseElement),
    container,
    baseElement,
    rerender,
    unmount,
  };
};

export type RenderHookOptions<Props = unknown> = RenderOptions & {
  initialProps?: Props;
};

export type RenderHookResult<Result, Props = unknown> = {
  readonly result: {
    readonly current: Result;
  };
  rerender: (nextProps?: Props) => void;
  unmount: () => void;
};

/**
 * Render a hook directly and expose the latest hook value via `result.current`.
 */
export const renderHook = <
  Result,
  Props extends Record<string, unknown> = Record<string, unknown>,
>(
  hook: (props: Props) => Result,
  options: RenderHookOptions<Props> = {}
): RenderHookResult<Result, Props> => {
  let currentResult!: Result;

  const HookHarness = (props: Props) => {
    currentResult = hook(props);
    return null;
  };

  const initialProps = options.initialProps || ({} as Props);
  const view = render(React.createElement(HookHarness, initialProps), options);

  return {
    get result() {
      return { current: currentResult };
    },
    rerender(nextProps = initialProps) {
      view.rerender(React.createElement(HookHarness, nextProps));
    },
    unmount: view.unmount,
  };
};

/**
 * Unmount all rendered roots and remove owned containers from the document.
 */
export const cleanup = () => {
  const mountedEntries = [...mountedRoots];

  for (const mounted of mountedEntries) {
    try {
      act(() => {
        mounted.root?.unmount();
      });
    } finally {
      if (mounted.ownsContainer && mounted.container?.parentNode) {
        mounted.container.parentNode.removeChild(mounted.container);
      }

      mounted.root = null;
      mounted.container = null;
      mountedRoots.delete(mounted);
    }
  }

  flushMetricBuffer();
};

/**
 * Global Testing Library `screen` bound to `document.body`.
 */
const baseScreenQueries = getQueriesForElement(document.body) as Record<
  string,
  unknown
>;

const boundScreenQueries: Record<string, unknown> = {};
for (const key of Object.keys(baseScreenQueries)) {
  const value = baseScreenQueries[key];
  boundScreenQueries[key] =
    typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(baseScreenQueries)
      : value;
}

export const screen = boundScreenQueries as Screen;

/**
 * Testing Library `fireEvent` wrapped in React `act` for synchronous state flushing.
 */
const baseFireEventInstance = domTestingLibrary.fireEvent;

const wrappedFireEvent = ((...args: Parameters<typeof baseFireEvent>) => {
  let result!: ReturnType<typeof baseFireEvent>;
  act(() => {
    result = baseFireEventInstance(...args);
  });
  return result;
}) as typeof baseFireEvent;

for (const key of Object.keys(baseFireEventInstance) as Array<
  keyof typeof baseFireEventInstance
>) {
  const value = baseFireEventInstance[key];

  if (typeof value !== 'function') {
    (
      wrappedFireEvent as unknown as Record<
        keyof typeof baseFireEventInstance,
        unknown
      >
    )[key] = value;
    continue;
  }

  (
    wrappedFireEvent as unknown as Record<
      keyof typeof baseFireEventInstance,
      unknown
    >
  )[key] = (...args: unknown[]) => {
    let result: unknown;
    act(() => {
      result = Reflect.apply(value, baseFireEventInstance, args);
    });
    return result;
  };
}

export const fireEvent = wrappedFireEvent;

export * from '@testing-library/dom';
