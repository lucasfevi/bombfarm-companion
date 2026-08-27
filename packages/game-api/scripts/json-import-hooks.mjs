/**
 * `packages/domain`'s compiled `dist/**` imports its own `data/*.json` files with no import
 * attribute (`tsc` does not add one), which current Node's default ESM loader rejects
 * (`ERR_IMPORT_ATTRIBUTE_MISSING`) outside of a bundler or Vitest's own module runner, neither of
 * which enforces the attribute. `generate-domain-fixtures.mjs` registers this loader hook — and
 * only this hook, only for its own direct-Node run — rather than changing how `packages/domain`
 * emits or consumes JSON, which would reach every other consumer of its `dist/`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function load(url, context, nextLoad) {
  if (url.endsWith('.json')) {
    return { format: 'json', source: readFileSync(fileURLToPath(url), 'utf8'), shortCircuit: true };
  }
  return nextLoad(url, context);
}
