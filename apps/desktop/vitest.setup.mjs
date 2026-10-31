import { transformSync } from 'esbuild';
import { readFileSync } from 'node:fs';
import Module from 'node:module';

// Main-process code reaches its dev-only module with `require`, which the bundler resolves in the
// built app. Node cannot load a TypeScript file by itself, so tests teach `require` to read one.
Module._extensions['.ts'] ??= (module, file) => {
  module._compile(transformSync(readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs' }).code, file);
};
