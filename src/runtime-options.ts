import {
  createRuntimeOptionArgPrefixes,
  parseRuntimeOptions as parseCoreRuntimeOptions,
} from '@pokujs/dom';

export const runtimeOptionArgPrefixes = createRuntimeOptionArgPrefixes(
  'poku-react'
);

export const parseRuntimeOptions = (argv: string[] = process.argv) =>
  parseCoreRuntimeOptions(runtimeOptionArgPrefixes, argv);
