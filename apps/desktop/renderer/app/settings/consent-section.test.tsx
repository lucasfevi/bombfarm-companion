import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CONSENT_TEXT, isGranted, type ConsentRecord } from '@bombfarm/game-api';
import { CopyProvider } from '../../lib/copy';
import { ConsentSection } from './consent-section';

function render(locale: 'en' | 'pt-BR', props: { granted: boolean; onRevoke: () => void; onReallow: () => void }) {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale,
      children: createElement(ConsentSection, props),
    }),
  );
}

/** The exact `granted` derivation `page.tsx` uses, isolated here so the "predates the current
 *  disclosure version" test below exercises it against a real `ConsentRecord | null`. */
function grantedFrom(record: ConsentRecord | null): boolean {
  return record !== null && isGranted(record);
}

describe('ConsentSection — granted state offers the turn-off control', () => {
  it('reads as allowed and renders only the turn-off control', () => {
    const html = render('en', { granted: true, onRevoke: vi.fn(), onReallow: vi.fn() });
    expect(html).toContain('Access: allowed');
    expect(html).toContain('data-testid="settings-consent-revoke"');
    expect(html).not.toContain('data-testid="settings-consent-reallow"');
    expect(html).toContain('Turn off');
  });
});

describe('ConsentSection — not-granted state offers the re-allow control', () => {
  it('reads as not allowed and renders only the re-allow control', () => {
    const html = render('en', { granted: false, onRevoke: vi.fn(), onReallow: vi.fn() });
    expect(html).toContain('Access: not allowed');
    expect(html).toContain('data-testid="settings-consent-reallow"');
    expect(html).not.toContain('data-testid="settings-consent-revoke"');
    expect(html).toContain('Review and allow');
  });
});

describe('ConsentSection — a grant that predates the current disclosure version is treated as not-granted', () => {
  it('page.tsx derives granted the same way this asserts: consent !== null && isGranted(consent)', () => {
    const staleGrant: ConsentRecord = {
      decision: 'granted',
      grantedAt: '2026-01-01T00:00:00.000Z',
      textVersion: CONSENT_TEXT.version - 1,
    };
    const granted = grantedFrom(staleGrant);
    expect(granted).toBe(false);

    const html = render('en', { granted, onRevoke: vi.fn(), onReallow: vi.fn() });
    expect(html).toContain('Access: not allowed');
    expect(html).toContain('data-testid="settings-consent-reallow"');
  });
});

describe('ConsentSection — PT-BR', () => {
  it('renders the Portuguese status and action text, granted', () => {
    const html = render('pt-BR', { granted: true, onRevoke: vi.fn(), onReallow: vi.fn() });
    expect(html).toContain('Acesso: permitido');
    expect(html).toContain('Desativar');
  });

  it('renders the Portuguese status and action text, not granted', () => {
    const html = render('pt-BR', { granted: false, onRevoke: vi.fn(), onReallow: vi.fn() });
    expect(html).toContain('Acesso: não permitido');
    expect(html).toContain('Revisar e permitir');
  });
});
