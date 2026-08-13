/**
 * Also settles design hazard 9 (T2): a `.test.tsx` under `renderer/` must not break
 * `next build renderer` (verified by running `pnpm --filter @bombfarm/desktop build` with this
 * file present) and must run under the desktop Vitest project (node env, `esbuild.jsx: 'automatic'`,
 * `renderToStaticMarkup` — the `packages/ui/vitest.config.ts` precedent).
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider, useCopy } from './index';
import { en } from './en';

function Probe() {
  const t = useCopy();
  return createElement('span', { 'data-testid': 'copy-probe' }, t.emptyNoSnapshotTitle);
}

describe('CopyProvider / useCopy (AD-040)', () => {
  it('useCopy() returns the en copy object even without a mounted Provider (context default)', () => {
    const html = renderToStaticMarkup(createElement(Probe));
    expect(html).toContain(en.emptyNoSnapshotTitle);
  });

  it('useCopy() returns the same values when read through a mounted CopyProvider', () => {
    const html = renderToStaticMarkup(createElement(CopyProvider, null, createElement(Probe)));
    expect(html).toContain(en.emptyNoSnapshotTitle);
  });
});
