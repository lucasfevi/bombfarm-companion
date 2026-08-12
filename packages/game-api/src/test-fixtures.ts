import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Reads a committed fixture with `node:fs` + `new URL(..., import.meta.url)` — never `import`ed,
 * so nothing under `src/__fixtures__/**` lands in `dist` (T5 Done-when). Test-support only; not
 * exported from `index.ts`.
 */
export function loadFixtureJson(name: 'api-bodies.json' | 'api-bodies-after.json'): Record<string, Record<string, unknown>> {
  const path = fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, Record<string, unknown>>;
}

/** `noUncheckedIndexedAccess` helper for tests: unwraps a possibly-`undefined` lookup with a
 *  descriptive failure instead of a bare non-null assertion (banned by lint in this package). */
export function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
}
