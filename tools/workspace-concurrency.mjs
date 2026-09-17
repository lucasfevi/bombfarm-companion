import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NPMRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.npmrc');

/**
 * The static ceiling stays in `.npmrc` and is read back here, so a bare `pnpm -r` typed by hand
 * is bounded by the same number the budgeted wrappers start from. Two copies of it would drift.
 */
export function npmrcWorkspaceConcurrency() {
  try {
    const match = /^workspace-concurrency\s*=\s*(\d+)\s*$/m.exec(readFileSync(NPMRC, 'utf8'));
    const value = Number(match?.[1]);
    return Number.isFinite(value) && value >= 1 ? value : 1;
  } catch {
    return 1;
  }
}
