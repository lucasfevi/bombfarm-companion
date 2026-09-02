import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../../lib/copy';
import { SupportSection } from './support-section';

function render(locale: 'en' | 'pt-BR') {
  return renderToStaticMarkup(
    createElement(CopyProvider, { locale, children: createElement(SupportSection) }),
  );
}

describe('SupportSection', () => {
  it('titles the section and explains where the control goes', () => {
    const html = render('en');

    expect(html).toContain('Support the project');
    expect(html).toContain('Opens the page in your browser.');
    expect(html).toContain('data-testid="settings-support-coffee"');
  });

  it('renders in Portuguese under the Portuguese locale', () => {
    const html = render('pt-BR');

    expect(html).toContain('Apoie o projeto');
    expect(html).not.toContain('Support the project');
  });
});
