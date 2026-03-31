import { GlobalRegistrator } from '@happy-dom/global-registrator';

type ReactActGlobal = typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const reactGlobal = globalThis as ReactActGlobal;

const defaultUrl = 'http://localhost:3000/';
const configuredUrl = process.env.POKU_REACT_DOM_URL || defaultUrl;

if (!globalThis.window || !globalThis.document) {
  GlobalRegistrator.register({
    url: configuredUrl,
  });
}

if (typeof reactGlobal.IS_REACT_ACT_ENVIRONMENT === 'undefined') {
  reactGlobal.IS_REACT_ACT_ENVIRONMENT = true;
}