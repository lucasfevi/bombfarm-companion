import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isPerfProfileBuild, requireBuildOutput } from './support/build-output';

/**
 * Zustand's `devtools` middleware must not reach the production bundle.
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
const outRoot = resolve(root, 'out');
const read = (relative: string) => readFileSync(resolve(root, relative), 'utf8');

const REAL = 'src/shared/stores/devtools-middleware.ts';
const NOOP = 'src/shared/stores/devtools-middleware-noop.ts';

describe('devtools is excluded from the production bundle', () => {
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
    const assertion = 'devtools connector is absent from the production chunks';
    // The four assertions above hold the invariant at source level; this one is the only
    // byte-level proof. Outside CI it skips when no build is present; in CI a missing build
    // fails, because that means the workflow stopped building before this suite.
    if (!requireBuildOutput(outRoot, assertion)) return;
    if (isPerfProfileBuild(outRoot, assertion)) return;

    const chunks = resolve(outRoot, '_next/static/chunks');
    expect(existsSync(chunks), `${chunks} is missing — is this a real export?`).toBe(true);

    const offenders = readdirSync(chunks)
      .filter((name) => name.endsWith('.js'))
      .filter((name) => readFileSync(join(chunks, name), 'utf8').includes('__REDUX_DEVTOOLS_EXTENSION__'));
    expect(offenders, `devtools connector found in: ${offenders.join(', ')}`).toEqual([]);
  });
});
