import React, { type ComponentType, type PropsWithChildren, type ReactElement } from 'react';
import {
  getQueriesForElement,
  type BoundFunctions,
  type Screen,
  type fireEvent as baseFireEvent,
  queries,
} from '@testing-library/dom';
import * as domTestingLibrary from '@testing-library/dom';
import { createRoot, type Root } from 'react-dom/client';

const { act } = React;

/** React `act` re-export for explicit async orchestration in tests. */
export { act };

type WrapperComponent = ComponentType<PropsWithChildren<unknown>>;

type InternalMounted = {
  root: Root;
  container: Element;
  ownsContainer: boolean;
};

const mountedRoots = new Set<InternalMounted>();

const getNow = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const getComponentName = (ui: ReactElement) => {
  const uiType = ui.type;
  if (!uiType) return 'AnonymousComponent';
  if (typeof uiType === 'string') return uiType;

  const typed = uiType as { displayName?: string; name?: string };
  return typed.displayName || typed.name || 'AnonymousComponent';
};

const emitRenderMetric = (componentName: string, durationMs: number) => {
  const metricsEnabled = process.env.POKU_REACT_ENABLE_METRICS === '1';
  if (!metricsEnabled) return;
  if (typeof process.send !== 'function') return;

  const safeDuration = Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0;

  try {
    process.send({
      type: 'POKU_REACT_RENDER_METRIC',
      componentName,
      durationMs: safeDuration,
    });
  } catch {
    // Ignore IPC failures when the process channel is already closed.
  }
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
export const render = (ui: ReactElement, options: RenderOptions = {}): RenderResult => {
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

    act(() => {
      root.unmount();
    });

    if (mounted.ownsContainer && container.parentNode) {
      container.parentNode.removeChild(container);
    }

    mountedRoots.delete(mounted);
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
export const renderHook = <Result, Props extends Record<string, unknown> = Record<string, unknown>>(
  hook: (props: Props) => Result,
  options: RenderHookOptions<Props> = {},
): RenderHookResult<Result, Props> => {
  let currentResult!: Result;

  const HookHarness = (props: Props) => {
    currentResult = hook(props);
    return null;
  };

  const initialProps = (options.initialProps || ({} as Props));
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
  for (const mounted of [...mountedRoots]) {
    act(() => {
      mounted.root.unmount();
    });

    if (mounted.ownsContainer && mounted.container.parentNode) {
      mounted.container.parentNode.removeChild(mounted.container);
    }

    mountedRoots.delete(mounted);
  }
};

/**
 * Global Testing Library `screen` bound to `document.body`.
 */
export const screen = new Proxy({} as Screen, {
  get(_, key: PropertyKey) {
    const queries = getQueriesForElement(document.body) as Record<PropertyKey, unknown>;
    const value = queries[key];
    return typeof value === 'function' ? value.bind(queries) : value;
  },
}) as Screen;

/**
 * Testing Library `fireEvent` wrapped in React `act` for synchronous state flushing.
 */
export const fireEvent = new Proxy(domTestingLibrary.fireEvent, {
  get(target, key: keyof typeof domTestingLibrary.fireEvent) {
    const value = target[key];
    if (typeof value !== 'function') return value;

    return (...args: unknown[]) => {
      let result: unknown;
      act(() => {
        result = Reflect.apply(value as (...innerArgs: unknown[]) => unknown, target, args);
      });
      return result;
    };
  },

  apply(target, thisArg, args) {
    let result: unknown;
    act(() => {
      result = Reflect.apply(target, thisArg, args);
    });
    return result;
  },
}) as typeof baseFireEvent;

export * from '@testing-library/dom';
