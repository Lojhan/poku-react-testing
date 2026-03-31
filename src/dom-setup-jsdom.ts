import { parseRuntimeOptions } from './runtime-options.ts';

const configuredUrl = parseRuntimeOptions().domUrl;

type ReactActGlobal = typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const reactGlobal = globalThis as ReactActGlobal;

const defineGlobal = (key: keyof typeof globalThis, value: unknown) => {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  });
};

const createJSDOMEnvironment = async () => {
  let mod: typeof import('jsdom');

  try {
    mod = await import('jsdom');
  } catch {
    throw new Error(
      '[poku-react-testing] DOM adapter "jsdom" requires the "jsdom" package. Install it with "npm install --save-dev jsdom".'
    );
  }

  const dom = new mod.JSDOM('<!doctype html><html><body></body></html>', {
    url: configuredUrl,
  });

  const { window } = dom;

  defineGlobal('window', window as unknown as Window & typeof globalThis);
  defineGlobal('document', window.document);
  defineGlobal('navigator', window.navigator);
  defineGlobal('HTMLElement', window.HTMLElement);
  defineGlobal('Node', window.Node);
  defineGlobal('Event', window.Event);
  defineGlobal('CustomEvent', window.CustomEvent);
  defineGlobal('MouseEvent', window.MouseEvent);
};

if (!globalThis.window || !globalThis.document) {
  await createJSDOMEnvironment();
}

if (typeof reactGlobal.IS_REACT_ACT_ENVIRONMENT === 'undefined') {
  reactGlobal.IS_REACT_ACT_ENVIRONMENT = true;
}
