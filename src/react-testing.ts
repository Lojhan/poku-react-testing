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
import {
  createRenderMetricsEmitter,
  createScreen,
  getNow,
} from '@pokujs/dom';
import { parseRuntimeOptions } from './runtime-options.ts';

const { act } = React;

export { act };

type WrapperComponent = ComponentType<PropsWithChildren<unknown>>;

type InternalMounted = {
  root: Root | null;
  container: Element | null;
  ownsContainer: boolean;
};

const mountedRoots = new Set<InternalMounted>();

const unmountMounted = (mounted: InternalMounted) => {
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

const getComponentName = (ui: ReactElement) => {
  const uiType = ui.type;
  if (!uiType) return 'AnonymousComponent';
  if (typeof uiType === 'string') return uiType;

  const typed = uiType as { displayName?: string; name?: string };
  return typed.displayName || typed.name || 'AnonymousComponent';
};

const runtimeOptions = parseRuntimeOptions();
const metrics = createRenderMetricsEmitter({
  runtimeOptions,
  metricsStateKey: Symbol.for('@pokujs/react.metrics-runtime-state'),
  metricsBatchMessageType: 'POKU_REACT_RENDER_METRIC_BATCH',
});

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

  metrics.emitRenderMetric(getComponentName(ui), getNow() - startedAt);

  const unmount = () => {
    if (!mountedRoots.has(mounted)) return;
    unmountMounted(mounted);
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

  const initialProps = options.initialProps ?? ({} as Props);
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

export const cleanup = () => {
  for (const mounted of [...mountedRoots]) {
    unmountMounted(mounted);
  }

  metrics.flushMetricBuffer();
};

export const screen = createScreen() as Screen;

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
