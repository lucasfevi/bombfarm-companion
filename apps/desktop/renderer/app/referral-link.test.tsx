import { describe, expect, it } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { REFERRAL_CODE } from '@bombfarm/domain/referral';
import { CopyProvider } from '../lib/copy';
import { ReferralChip, ReferralCopyControl } from './referral-link';

function render(locale: 'en' | 'pt-BR', component: () => ReactElement) {
  return renderToStaticMarkup(
    createElement(CopyProvider, { locale, children: createElement(component) }),
  );
}

describe('ReferralChip — the top-bar shape', () => {
  it('shows the code the web planner shows, not a second copy of it', () => {
    const html = render('en', ReferralChip);

    expect(html).toContain(REFERRAL_CODE);
    expect(html).toContain('data-testid="shell-referral"');
  });

  it('is a button rather than a link — the code is copied, not navigated to', () => {
    const html = render('en', ReferralChip);

    expect(html).toContain('type="button"');
    expect(html).not.toContain('href=');
  });

  it('names itself for assistive tech with the reason, not just the action', () => {
    const html = render('en', ReferralChip);

    expect(html).toContain('aria-label="Copy my referral code — we both get a reward once you clear stage 151"');
  });

  it('names itself in Portuguese under the Portuguese locale', () => {
    const html = render('pt-BR', ReferralChip);

    expect(html).toContain('Copiar meu código de indicação');
    expect(html).not.toContain('Copy my referral code');
  });
});

describe('ReferralCopyControl — the Settings shape', () => {
  it('carries the same code and a live region for the outcome', () => {
    const html = render('en', ReferralCopyControl);

    expect(html).toContain(REFERRAL_CODE);
    expect(html).toContain('data-testid="settings-support-referral"');
    expect(html).toContain('role="status"');
  });

  it('says nothing in the live region until a copy has been attempted', () => {
    const html = render('en', ReferralCopyControl);

    expect(html).not.toContain('Referral code copied');
    expect(html).not.toContain('Clipboard unavailable');
  });

  it('renders in Portuguese under the Portuguese locale', () => {
    const html = render('pt-BR', ReferralCopyControl);

    expect(html).toContain('Copiar meu código de indicação');
    expect(html).not.toContain('Copy my referral code');
  });
});
