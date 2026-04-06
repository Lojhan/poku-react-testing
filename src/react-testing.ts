import type {
  fireEvent as baseFireEvent,
  BoundFunctions,
  Screen,
} from '@testing-library/dom';
import type { ComponentType, PropsWithChildren, ReactElement } from 'react';
import type { Root } from 'react-dom/client';
import { getQueriesForElement, queries } from '@testing-library/dom';
import * as domTestingLibrary from '@testing-library/dom';
import * as pokuDom from '@pokujs/dom';
import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  createRenderMetricsEmitter,
  createScreen,
  getNow,
  wrapFireEventMethods,
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

const fallbackMountedRoots = new Set<InternalMounted>();

type ScopeSlot<T> = {
  readonly value: T;
};

type ScopeLike = {
  getOrCreateSlot<T>(key: symbol, init: () => T): ScopeSlot<T>;
  getSlot?<T>(key: symbol): ScopeSlot<T> | undefined;
  addCleanup?(fn: () => void | Promise<void>): void;
};

type DomScopeApi = {
  defineSlotKey?: <T>(name: string) => symbol;
  getOrCreateScope?: () => ScopeLike | undefined;
  getCurrentScope?: () => ScopeLike | undefined;
};

const domScopeApi = pokuDom as unknown as DomScopeApi;

const MOUNTED_ROOTS_SLOT_KEY =
  typeof domScopeApi.defineSlotKey === 'function'
    ? domScopeApi.defineSlotKey<Set<InternalMounted>>(
        '@pokujs/react.mounted-roots'
      )
    : undefined;

const CLEANUP_STATE_SLOT_KEY =
  typeof domScopeApi.defineSlotKey === 'function'
    ? domScopeApi.defineSlotKey<{ registered: boolean }>(
        '@pokujs/react.cleanup-registered'
      )
    : undefined;

const cleanupMountedRoots = (mountedRoots: Set<InternalMounted>) => {
  for (const mounted of [...mountedRoots]) {
    unmountMounted(mountedRoots, mounted);
  }
};

const getScopedMountedRoots = (): Set<InternalMounted> | undefined => {
  if (!MOUNTED_ROOTS_SLOT_KEY) return undefined;
  if (typeof domScopeApi.getOrCreateScope !== 'function') return undefined;

  const scope = domScopeApi.getOrCreateScope();
  if (!scope) return undefined;

  const mountedRoots = scope.getOrCreateSlot(MOUNTED_ROOTS_SLOT_KEY, () =>
    new Set<InternalMounted>()
  ).value;

  if (!CLEANUP_STATE_SLOT_KEY || typeof scope.addCleanup !== 'function') {
    return mountedRoots;
  }

  const cleanupState = scope.getOrCreateSlot(CLEANUP_STATE_SLOT_KEY, () => ({
    registered: false,
  })).value;

  if (!cleanupState.registered) {
    cleanupState.registered = true;
    scope.addCleanup(() => {
      cleanupMountedRoots(mountedRoots);
      metrics.flushMetricBuffer();
    });
  }

  return mountedRoots;
};

const getMountedRoots = (): Set<InternalMounted> =>
  getScopedMountedRoots() ?? fallbackMountedRoots;

const getCurrentScopedMountedRoots = (): Set<InternalMounted> | undefined => {
  if (!MOUNTED_ROOTS_SLOT_KEY) return undefined;
  if (typeof domScopeApi.getCurrentScope !== 'function') return undefined;

  const scope = domScopeApi.getCurrentScope();
  const slot = scope?.getSlot?.<Set<InternalMounted>>(MOUNTED_ROOTS_SLOT_KEY);
  return slot?.value;
};

const unmountMounted = (
  mountedRoots: Set<InternalMounted>,
  mounted: InternalMounted
) => {
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
  const mountedRoots = getMountedRoots();
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
    unmountMounted(mountedRoots, mounted);
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
  const scopedMountedRoots = getCurrentScopedMountedRoots();
  if (scopedMountedRoots) cleanupMountedRoots(scopedMountedRoots);

  cleanupMountedRoots(fallbackMountedRoots);

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

wrapFireEventMethods(
  wrappedFireEvent as unknown as Record<string, unknown>,
  baseFireEventInstance as unknown as Record<string, unknown>,
  (invoke: () => unknown) => {
    let result: unknown;
    act(() => { result = invoke(); });
    return result;
  }
);

export const fireEvent = wrappedFireEvent;

export * from '@testing-library/dom';
