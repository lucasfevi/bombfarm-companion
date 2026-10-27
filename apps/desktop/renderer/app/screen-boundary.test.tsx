import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CopyProvider } from '../lib/copy';
import { en } from '../lib/copy/en';
import { ptBR } from '../lib/copy/pt-BR';
import { ScreenCrashFallback } from './screen-boundary';

function render(locale: 'en' | 'pt-BR') {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale,
      children: createElement(ScreenCrashFallback, { onRetry: vi.fn() }),
    }),
  );
}

describe('the compact window crash tip', () => {
  it('does not tell a window with no tabs to switch them, in either language', () => {
    expect(en.screenCrashInfoCompact).not.toMatch(/tab/i);
    expect(ptBR.screenCrashInfoCompact).not.toMatch(/\baba\b/i);
    expect(en.screenCrashInfo).toMatch(/tabs/);
    expect(ptBR.screenCrashInfo).toMatch(/aba/);
  });

  it('still offers a retry and says where the details went', () => {
    expect(en.screenCrashInfoCompact).toContain('Try again');
    expect(en.screenCrashInfoCompact).toContain('log file');
    expect(ptBR.screenCrashInfoCompact).toContain('Tente novamente');
    expect(ptBR.screenCrashInfoCompact).toContain('arquivo de log');
  });

  it.each([
    ['en', en],
    ['pt-BR', ptBR],
  ] as const)('is the tip the compact fallback carries in %s, and the full one is not', (locale, copy) => {
    const draw = (compact: boolean) =>
      renderToStaticMarkup(
        createElement(CopyProvider, {
          locale,
          children: createElement(ScreenCrashFallback, { onRetry: vi.fn(), compact }),
        }),
      );
    expect(draw(true)).toContain(copy.screenCrashInfoCompact);
    expect(draw(true)).not.toContain(copy.screenCrashInfo);
    expect(draw(false)).toContain(copy.screenCrashInfo);
    expect(draw(true)).toContain(copy.screenCrashRetry);
  });
});

describe('ScreenCrashFallback', () => {
  it('says the screen could not load and offers a retry, in English', () => {
    const html = render('en');
    expect(html).toContain("This screen couldn&#x27;t load");
    expect(html).toContain('Try again');
  });

  it('speaks Portuguese under the Portuguese locale', () => {
    const html = render('pt-BR');
    expect(html).toContain('Não foi possível carregar esta tela');
    expect(html).toContain('Tentar novamente');
  });
});
