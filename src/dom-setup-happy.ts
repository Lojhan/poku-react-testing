import { setupHappyDomEnvironment } from '@pokujs/dom';
import { parseRuntimeOptions } from './runtime-options.ts';

await setupHappyDomEnvironment({
  runtimeOptions: parseRuntimeOptions(),
  packageTag: '@pokujs/react',
  enableReactActEnvironment: true,
});
