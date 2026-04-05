import { setupJsdomEnvironment } from '@pokujs/dom';
import { parseRuntimeOptions } from './runtime-options.ts';

await setupJsdomEnvironment({
  runtimeOptions: parseRuntimeOptions(),
  packageTag: '@pokujs/react',
  enableReactActEnvironment: true,
});
