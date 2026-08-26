/**
 * Also settles design hazard 9 (T2): a `.test.tsx` under `renderer/` must not break
 * `next build renderer` (verified by running `pnpm --filter @bombfarm/desktop build` with this
 * file present) and must run under the desktop Vitest project (node env, `esbuild.jsx: 'automatic'`,
 * `renderToStaticMarkup` — the `packages/ui/vitest.config.ts` precedent).
 *
 * MP3 F4: `CopyProvider` now takes a required `locale` prop (`AD-050`) — every mount below passes
 * one explicitly. `useLocale()`'s mapping and `STRINGS`'s totality over `AppLocale` are asserted
 * here too.
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { APP_LOCALES } from '@bombfarm/contracts';
import { CopyProvider, STRINGS, useCopy, useLocale } from './index';
import { en } from './en';
import { ptBR } from './pt-BR';

function Probe() {
  const t = useCopy();
  return createElement('span', { 'data-testid': 'copy-probe' }, t.liveNeverReadTitle);
}

function LocaleProbe() {
  const { locale, lang, bcp47 } = useLocale();
  return createElement('span', { 'data-testid': 'locale-probe' }, `${locale}|${lang}|${bcp47}`);
}

describe('CopyProvider / useCopy (AD-040)', () => {
  it('useCopy() returns the en copy object even without a mounted Provider (context default)', () => {
    const html = renderToStaticMarkup(createElement(Probe));
    expect(html).toContain(en.liveNeverReadTitle);
  });

  it('useCopy() returns en values when the Provider is mounted with locale="en"', () => {
    const html = renderToStaticMarkup(
      createElement(CopyProvider, { locale: 'en', children: createElement(Probe) }),
    );
    expect(html).toContain(en.liveNeverReadTitle);
  });

  it('useCopy() returns pt-BR values when the Provider is mounted with locale="pt-BR"', () => {
    const html = renderToStaticMarkup(
      createElement(CopyProvider, { locale: 'pt-BR', children: createElement(Probe) }),
    );
    expect(html).toContain(ptBR.liveNeverReadTitle);
    expect(html).not.toContain(en.liveNeverReadTitle);
  });
});

describe('STRINGS (AD-050)', () => {
  it('is total over AppLocale — every APP_LOCALES member resolves to a real Copy object', () => {
    for (const locale of APP_LOCALES) {
      expect(STRINGS[locale]).toBeDefined();
      expect(Object.keys(STRINGS[locale]).length).toBeGreaterThan(0);
    }
  });

  it('en and pt-BR are the exact two entries', () => {
    expect(Object.keys(STRINGS).sort()).toEqual(['en', 'pt-BR']);
  });
});

describe('useLocale (AD-056)', () => {
  it.each([
    ['en', 'en', 'en-US'],
    ['pt-BR', 'pt', 'pt-BR'],
  ] as const)('locale=%p => { lang: %p, bcp47: %p }, already mapped', (locale, lang, bcp47) => {
    const html = renderToStaticMarkup(
      createElement(CopyProvider, { locale, children: createElement(LocaleProbe) }),
    );
    expect(html).toContain(`${locale}|${lang}|${bcp47}`);
  });
});
