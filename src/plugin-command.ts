import type { ReactDomAdapter } from './plugin-types.ts';
import { existsSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

const resolveSetupModulePath = (baseName: string) => {
  const jsPath = resolve(currentDir, `${baseName}.js`);
  if (existsSync(jsPath)) return jsPath;

  return resolve(currentDir, `${baseName}.ts`);
};

const happyDomSetupPath = resolveSetupModulePath('dom-setup-happy');
const jsdomSetupPath = resolveSetupModulePath('dom-setup-jsdom');

const reactExtensions = new Set(['.tsx', '.jsx']);

export type RuntimeSupport = {
  supportsNodeLikeImport: boolean;
  supportsDenoPreload: boolean;
};

export type BuildRunnerCommandInput = {
  runtime: string;
  command: string[];
  file: string;
  domSetupPath: string;
  runtimeOptionArgs: string[];
};

export type BuildRunnerCommandOutput = {
  shouldHandle: boolean;
  command: string[];
};

const isTsxImport = (arg: string) =>
  arg === '--import=tsx' || arg === '--loader=tsx';

export const isNodeRuntime = (runtime: string) => runtime === 'node';
const isBunRuntime = (runtime: string) => runtime === 'bun';
const isDenoRuntime = (runtime: string) => runtime === 'deno';

export const getRuntimeSupport = (runtime: string): RuntimeSupport => ({
  supportsNodeLikeImport: isNodeRuntime(runtime) || isBunRuntime(runtime),
  supportsDenoPreload: isDenoRuntime(runtime),
});

export const canHandleRuntime = (runtime: string) => {
  const support = getRuntimeSupport(runtime);
  return support.supportsNodeLikeImport || support.supportsDenoPreload;
};

export const resolveDomSetupPath = (adapter: ReactDomAdapter | undefined) => {
  if (!adapter || adapter === 'happy-dom') return happyDomSetupPath;
  if (adapter === 'jsdom') return jsdomSetupPath;

  return resolve(process.cwd(), adapter.setupModule);
};

export const buildRunnerCommand = ({
  runtime,
  command,
  file,
  domSetupPath,
  runtimeOptionArgs,
}: BuildRunnerCommandInput): BuildRunnerCommandOutput => {
  const support = getRuntimeSupport(runtime);

  if (!support.supportsNodeLikeImport && !support.supportsDenoPreload) {
    return { shouldHandle: false, command };
  }

  if (!reactExtensions.has(extname(file))) {
    return { shouldHandle: false, command };
  }

  const fileIndex = command.lastIndexOf(file);
  if (fileIndex === -1) return { shouldHandle: false, command };

  const nodeImportFlag = `--import=${domSetupPath}`;
  const denoPreloadFlag = `--preload=${domSetupPath}`;
  const beforeFile: string[] = [];
  const afterFile: string[] = [];

  let hasTsx = false;
  let hasNodeLikeDomSetup = false;
  let hasDenoDomSetup = false;
  const existingArgs = new Set<string>();

  for (let index = 1; index < command.length; index += 1) {
    const arg = command[index];
    if (typeof arg !== 'string') continue;

    existingArgs.add(arg);

    if (index < fileIndex) {
      beforeFile.push(arg);

      if (isTsxImport(arg)) hasTsx = true;
      else if (arg === nodeImportFlag) hasNodeLikeDomSetup = true;
      else if (arg === denoPreloadFlag) hasDenoDomSetup = true;
      continue;
    }

    if (index > fileIndex) {
      afterFile.push(arg);
    }
  }

  const extraImports: string[] = [];
  if (isNodeRuntime(runtime) && !hasTsx) extraImports.push('--import=tsx');
  if (support.supportsNodeLikeImport && !hasNodeLikeDomSetup)
    extraImports.push(nodeImportFlag);
  if (support.supportsDenoPreload && !hasDenoDomSetup)
    extraImports.push(denoPreloadFlag);

  const runtimeArgsToInject: string[] = [];
  for (const runtimeOptionArg of runtimeOptionArgs) {
    if (existingArgs.has(runtimeOptionArg)) continue;
    runtimeArgsToInject.push(runtimeOptionArg);
  }

  return {
    shouldHandle: true,
    command: [
      runtime,
      ...beforeFile,
      ...extraImports,
      file,
      ...runtimeArgsToInject,
      ...afterFile,
    ],
  };
};
