import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * RES-02 — zustand's `devtools` middleware must not reach the production bundle.
 *
 * The runtime `NODE_ENV` guard cannot achieve this alone: webpack marks a statically
 * imported binding as used at module-graph time, so the middleware shipped whole even
 * though the branch using it was provably dead (measured leak: 1,517 B gzip). The fix is
 * a production-only `resolve.alias` in `next.config.ts` swapping `devtools-middleware.ts`
 * for `devtools-middleware-noop.ts`.
 *
 * That alias keys off a **file path**, so renaming or moving either module silently
 * disables it and the bytes come back with no other signal. These assertions are that
 * signal.
 */
const root = resolve(__dirname, '../..');
const read = (relative: string) => readFileSync(resolve(root, relative), 'utf8');

const REAL = 'src/shared/stores/devtools-middleware.ts';
const NOOP = 'src/shared/stores/devtools-middleware-noop.ts';

describe('RES-02 devtools is excluded from the production bundle', () => {
  it('both middleware modules still exist at the paths next.config.ts aliases', () => {
    expect(existsSync(resolve(root, REAL)), `${REAL} is missing — the alias cannot match`).toBe(
      true,
    );
    expect(existsSync(resolve(root, NOOP)), `${NOOP} is missing — the alias cannot match`).toBe(
      true,
    );
  });

  it('next.config.ts aliases the real module to the no-op for non-dev builds', () => {
    const config = read('next.config.ts');
    expect(config).toContain('devtools-middleware.ts');
    expect(config).toContain('devtools-middleware-noop.ts');
    expect(config).toContain('config.resolve.alias');
  });

  it('the no-op stand-in imports nothing from zustand/middleware', () => {
    // If it did, aliasing would pull the middleware back in and achieve nothing.
    expect(read(NOOP)).not.toContain("from 'zustand/middleware'");
  });

  it('planner-store.ts gets the middleware through the aliasable module, not directly', () => {
    const store = read('src/shared/stores/planner-store.ts');
    expect(store).toContain("from '@/shared/stores/devtools-middleware'");
    // A direct `devtools` import here would bypass the alias entirely.
    expect(store).not.toMatch(/import \{[^}]*\bdevtools\b[^}]*\} from 'zustand\/middleware'/);
  });

  it('no built production chunk contains the devtools connector', () => {
    const chunks = resolve(root, 'out/_next/static/chunks');
    if (!existsSync(chunks)) {
      // `pnpm build` has not run in this working tree. The four assertions above still
      // hold the invariant at source level; this one adds byte-level proof when a build
      // is present (CI runs `pnpm build` before the suite).
      return;
    }
    if (existsSync(resolve(root, 'out/.perf-profile-build'))) {
      // out/ holds a RES-05 measurement build (`pnpm perf:build:profile`), which disables
      // minification so component names survive for the profiler. Unminified webpack
      // output keeps unused exports it would otherwise drop, so zustand's devtools is
      // present there by construction — and that build is never deployed. Asserting on it
      // would report a regression that does not exist in shipped output. Re-run
      // `pnpm build` to restore a shippable export and get byte-level proof again.
      return;
    }
    const offenders = readdirSync(chunks)
      .filter((name) => name.endsWith('.js'))
      .filter((name) => readFileSync(join(chunks, name), 'utf8').includes('__REDUX_DEVTOOLS_EXTENSION__'));
    expect(offenders, `devtools connector found in: ${offenders.join(', ')}`).toEqual([]);
  });
});
