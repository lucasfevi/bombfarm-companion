import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const DOMAIN_ROOT = join(here, '..', '..');
export const DIST_ROOT = join(DOMAIN_ROOT, 'dist');

/**
 * This makes `packages/domain/dist` a real build prerequisite, not an optional
 * artifact. Unlike `apps/web`'s `requireBuildOutput` (a multi-minute `next build`, tolerated
 * as a local-developer skip), the prerequisite here is one fast package build
 * (`pnpm --filter @bombfarm/domain build`) — so there is deliberately **no** local-skip
 * branch. A silent skip on this test would defeat the whole point of the feature: this file
 * is the only thing that proves the new `exports` map resolves correctly, in CI and locally
 * alike (T1 Done-when).
 */
export function requireDomainDist(): void {
  if (existsSync(DIST_ROOT)) return;

  throw new Error(
    `[require-dist] ${DIST_ROOT} is missing. Run \`pnpm --filter @bombfarm/domain build\` first.`,
  );
}
