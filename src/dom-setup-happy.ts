import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { parseRuntimeOptions } from './runtime-options.ts';

declare const Deno: unknown;

type ReactActGlobal = typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const reactGlobal = globalThis as ReactActGlobal;

const configuredUrl = parseRuntimeOptions().domUrl;

if (!globalThis.window || !globalThis.document) {
  const isDenoRuntime = typeof Deno !== 'undefined';
  const nativeEvent = isDenoRuntime ? globalThis.Event : undefined;
  const nativeDispatchEvent = isDenoRuntime
    ? globalThis.dispatchEvent?.bind(globalThis)
    : undefined;

  GlobalRegistrator.register({
    url: configuredUrl,
  });

  if (isDenoRuntime) {
    if (nativeEvent)
      (globalThis as unknown as Record<string, unknown>).Event = nativeEvent;
    if (nativeDispatchEvent) globalThis.dispatchEvent = nativeDispatchEvent;
  }
}

if (typeof reactGlobal.IS_REACT_ACT_ENVIRONMENT === 'undefined') {
  reactGlobal.IS_REACT_ACT_ENVIRONMENT = true;
}
