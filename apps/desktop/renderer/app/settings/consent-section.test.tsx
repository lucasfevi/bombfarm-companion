import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../../lib/copy';
import { ConsentSection } from './consent-section';

function render(locale: 'en' | 'pt-BR', props: { onRevoke: () => void }) {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale,
      children: createElement(ConsentSection, props),
    }),
  );
}

describe('ConsentSection — reachable only behind the gate, so it always reads as allowed', () => {
  it('renders the granted status and the turn-off control', () => {
    const html = render('en', { onRevoke: vi.fn() });
    expect(html).toContain('Access: allowed');
    expect(html).toContain('data-testid="settings-consent-revoke"');
    expect(html).toContain('Turn off');
  });
});

describe('ConsentSection — PT-BR', () => {
  it('renders the Portuguese status and action text', () => {
    const html = render('pt-BR', { onRevoke: vi.fn() });
    expect(html).toContain('Acesso: permitido');
    expect(html).toContain('Desativar');
  });
});
