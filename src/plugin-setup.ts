import { pathToFileURL } from 'node:url';
import { canHandleRuntime, isNodeRuntime } from './plugin-command.ts';

type TsxEsmApiModule = {
  register?: () => () => void;
};

const TSX_LOADER_MODULE = 'tsx/esm/api';

const appendMissingRuntimeArgs = (runtimeOptionArgs: string[]) => {
  for (const arg of runtimeOptionArgs) {
    if (process.argv.includes(arg)) continue;
    process.argv.push(arg);
  }
};

const loadDomSetupModule = async (domSetupPath: string) => {
  await import(pathToFileURL(domSetupPath).href);
};

const registerNodeTsxLoader = async () => {
  const moduleName = TSX_LOADER_MODULE;

  try {
    const mod = (await import(moduleName)) as TsxEsmApiModule;
    if (typeof mod.register !== 'function') {
      throw new Error('Missing register() export from tsx loader API');
    }

    return mod.register();
  } catch (error) {
    throw new Error(
      '[poku-react-testing] isolation "none" in Node.js requires a working "tsx" installation to load .tsx/.jsx test files.',
      { cause: error }
    );
  }
};

export type InProcessSetupOptions = {
  isolation: string | undefined;
  runtime: string;
  runtimeOptionArgs: string[];
  domSetupPath: string;
};

export const setupInProcessEnvironment = async (
  options: InProcessSetupOptions
): Promise<(() => void) | undefined> => {
  if (options.isolation !== 'none') return undefined;
  if (!canHandleRuntime(options.runtime)) return undefined;

  let cleanupNodeTsxLoader: (() => void) | undefined;

  if (isNodeRuntime(options.runtime)) {
    cleanupNodeTsxLoader = await registerNodeTsxLoader();
  }

  appendMissingRuntimeArgs(options.runtimeOptionArgs);
  await loadDomSetupModule(options.domSetupPath);

  return cleanupNodeTsxLoader;
};
