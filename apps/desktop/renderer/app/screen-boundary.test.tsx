import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CopyProvider } from '../lib/copy';
import { ScreenCrashFallback } from './screen-boundary';

function render(locale: 'en' | 'pt-BR') {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale,
      children: createElement(ScreenCrashFallback, { onRetry: vi.fn() }),
    }),
  );
}

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
