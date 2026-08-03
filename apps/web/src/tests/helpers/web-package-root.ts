import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path to `apps/web` — safe when Vitest runs from the monorepo root. */
export const WEB_PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
