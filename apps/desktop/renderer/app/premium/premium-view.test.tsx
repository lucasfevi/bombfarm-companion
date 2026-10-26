import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  signedOutPremiumView,
  type PremiumPlayingAccount,
  type PremiumStatus,
  type PremiumView,
} from '@bombfarm/contracts';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
import { noticeAfterManage, noticeAfterRefresh, type PremiumNotice } from './premium-notice';
import { PremiumScreenView } from './premium-view';

const MIDDAY = (day: string) => `${day}T12:00:00.000Z`;

const activeStatus: PremiumStatus = {
  active: true,
  kinds: ['subscription'],
  until: MIDDAY('2026-12-01'),
  awaitingPaymentUntil: null,
  graceUntil: null,
  cancellationAt: null,
  paymentFailed: false,
  pendingFirstPayment: false,
  disputeHold: false,
};

function signedIn(status: Partial<PremiumStatus> | null, rest: Partial<PremiumView> = {}): PremiumView {
  return {
    ...signedOutPremiumView,
    session: 'signed-in',
    visible: true,
    status: status === null ? null : { ...activeStatus, ...status },
    fetchedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    ...rest,
  };
}

function render(view: PremiumView, locale: 'en' | 'pt-BR' = 'en', notice: PremiumNotice | null = null): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale,
      children: createElement(PremiumScreenView, {
        view,
        notice,
        onSignIn: () => {},
        onRefresh: () => {},
        onManage: () => {},
      }),
    }),
  );
}

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ');
}

describe('the Premium tab when signed out', () => {
  it('says Premium is not shown until you sign in, with a Sign in button and nothing to manage', () => {
    const html = render({ ...signedOutPremiumView, visible: true });

    expect(text(html)).toContain('Premium is not shown until you sign in');
    expect(html).toContain('data-testid="premium-sign-in"');
    expect(html).not.toContain('data-testid="premium-manage"');
    expect(html).not.toContain('data-testid="premium-refresh"');
  });

  it('keeps the same prompt, with Sign in disabled, while a sign-in is running', () => {
    const html = render({ ...signedOutPremiumView, visible: true, session: 'signing-in' });

    expect(html).toMatch(/data-testid="premium-sign-in"[^>]*disabled|disabled[^>]*data-testid="premium-sign-in"/);
  });
});

describe('the Premium tab when signed in', () => {
  it('says Premium is active, why, and until when', () => {
    const html = text(render(signedIn({})));

    expect(html).toContain('Premium is active');
    expect(html).toContain('Why: subscription');
    expect(html).toContain('until December 1, 2026');
  });

  it.each([
    [['subscription'], 'Why: subscription'],
    [['pass'], 'Why: prepaid pass'],
    [['manual_grant'], 'Why: granted by the team'],
  ] as const)('names the kind %j in the spec wording', (kinds, line) => {
    expect(text(render(signedIn({ kinds: [...kinds] })))).toContain(line);
  });

  it('lists several kinds in the fixed order whatever order the server sent them in', () => {
    const html = text(render(signedIn({ kinds: ['manual_grant', 'pass', 'subscription'] })));

    expect(html).toContain('Why: subscription, prepaid pass, granted by the team');
  });

  it('says there is no end date for an open-ended Premium', () => {
    const html = text(render(signedIn({ until: null })));

    expect(html).toContain('with no end date');
    expect(html).not.toContain('until');
  });

  it('prints a past end date exactly as the server gave it, without recomputing', () => {
    const html = text(render(signedIn({ until: MIDDAY('2020-01-15') })));

    expect(html).toContain('Premium is active');
    expect(html).toContain('until January 15, 2020');
  });

  it('says Premium is not active and shows no end', () => {
    const html = text(render(signedIn({ active: false, kinds: [], until: null })));

    expect(html).toContain('Premium is not active');
    expect(html).not.toContain('until');
    expect(html).not.toContain('with no end date');
    expect(html).not.toContain('Why:');
  });

  it('says Premium will not renew after the scheduled cancellation, as a plain line', () => {
    const html = render(signedIn({ cancellationAt: MIDDAY('2026-11-20') }));

    expect(text(html)).toContain('Premium will not renew after November 20, 2026');
    expect(html).toContain('data-testid="premium-cancellation"');
    expect(html).not.toContain('data-testid="premium-banner-');
  });

  it('says the first payment is still being processed as a plain line, not a banner', () => {
    const html = render(signedIn({ active: false, kinds: [], until: null, pendingFirstPayment: true }));

    expect(text(html)).toContain('Your first payment is still being processed — Premium starts once it is paid');
    expect(html).toContain('data-testid="premium-first-payment"');
    expect(html).not.toContain('data-testid="premium-banner-');
  });

  it('shows when the status was fetched', () => {
    expect(text(render(signedIn({})))).toContain('Updated 5m ago');
  });

  it('shows the grace banner with the date Premium stays on until', () => {
    const html = render(signedIn({ graceUntil: MIDDAY('2026-10-25') }));

    expect(html).toContain('data-testid="premium-banner-grace"');
    expect(text(html)).toContain('Your last payment failed');
    expect(text(html)).toContain('Premium stays on until October 25, 2026.');
  });

  it('shows all four payment banners in order', () => {
    const html = render(
      signedIn({
        awaitingPaymentUntil: MIDDAY('2026-10-20'),
        graceUntil: MIDDAY('2026-10-25'),
        paymentFailed: true,
        disputeHold: true,
      }),
    );

    const order = ['awaitingPayment', 'grace', 'paymentFailed', 'disputeHold'].map((id) =>
      html.indexOf(`data-testid="premium-banner-${id}"`),
    );
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(text(html)).toContain('A boleto is waiting to be paid');
    expect(text(html)).toContain('Your payment failed');
    expect(text(html)).toContain('Premium is paused while a payment dispute is open.');
  });

  it('keeps the last status and says when the server could not be reached', () => {
    const html = text(render(signedIn({}, { lastRefreshFailed: true })));

    expect(html).toContain("Couldn't reach the server");
    expect(html).toContain('Showing status from 5m ago.');
    expect(html).toContain('Premium is active');
  });

  it('says status is unavailable when there is none to show', () => {
    const html = render(signedIn(null, { lastRefreshFailed: true, fetchedAt: null }));

    expect(text(html)).toContain('Premium status is unavailable right now');
    expect(html).not.toContain('data-testid="premium-headline"');
  });

  it('offers Refresh and Manage Premium', () => {
    const html = render(signedIn({}));

    expect(text(html)).toContain('Refresh');
    expect(text(html)).toContain('Manage Premium');
  });

  it.each<[PremiumNotice, string]>([
    ['too-soon', 'Try again in a moment'],
    ['manage-failed', "Couldn't open the Premium page — try again"],
  ])('shows the %s notice in a slot that is always there', (notice, sentence) => {
    expect(text(render(signedIn({}), 'en', notice))).toContain(sentence);
    const quiet = render(signedIn({}));
    expect(quiet).toContain('data-testid="premium-notice"');
    expect(quiet).toContain('invisible');
  });

  it('speaks Portuguese under the Portuguese locale and leaks no English', () => {
    const html = text(
      render(signedIn({ kinds: ['pass'], graceUntil: MIDDAY('2026-10-25') }), 'pt-BR'),
    );

    expect(html).toContain(ptBR.premiumActive);
    expect(html).toContain('Motivo: passe pré-pago');
    expect(html).toContain('25 de outubro de 2026');
    expect(html).not.toContain(en.premiumActive);
    expect(html).not.toContain(en.premiumManageAction);
  });
});

describe('the unreachable banner in Portuguese', () => {
  it('reads as a sentence once the age is filled in', () => {
    const html = text(render(signedIn({}, { lastRefreshFailed: true }), 'pt-BR'));

    expect(html).toContain('Mostrando o último status, atualizado há 5m.');
  });
});

describe('what the Premium tab never says', () => {
  const states: [string, PremiumView][] = [
    ['signed out', { ...signedOutPremiumView, visible: true }],
    ['active', signedIn({ kinds: ['subscription', 'pass', 'manual_grant'], cancellationAt: MIDDAY('2026-11-20') })],
    ['not active', signedIn({ active: false, kinds: [], until: null, pendingFirstPayment: true })],
    [
      'every banner',
      signedIn(
        { awaitingPaymentUntil: MIDDAY('2026-10-20'), graceUntil: MIDDAY('2026-10-25'), paymentFailed: true, disputeHold: true },
        { lastRefreshFailed: true },
      ),
    ],
    ['unavailable', signedIn(null, { lastRefreshFailed: true, fetchedAt: null })],
  ];

  it.each(states)('names no price, purchase, plan or currency when %s', (_name, view) => {
    for (const locale of ['en', 'pt-BR'] as const) {
      const html = text(render(view, locale));
      expect(html).not.toMatch(/price|preço|buy|comprar|purchase|compra|checkout|subscribe now|assine|plan\b|plano/i);
      expect(html).not.toMatch(/[$€£]|R\$/);
    }
  });

  it('carries no link of its own', () => {
    for (const [, view] of states) expect(render(view)).not.toMatch(/<a\b|href=/);
  });
});

describe('what a button press leaves behind', () => {
  it('shows the too-soon notice only for a refresh refused inside the floor', () => {
    expect(noticeAfterRefresh({ ok: false, reason: 'too-soon' })).toBe('too-soon');
    expect(noticeAfterRefresh({ ok: true })).toBeNull();
    expect(noticeAfterRefresh({ ok: false, reason: 'failed' })).toBeNull();
  });

  it('shows the could-not-open notice for every Manage Premium that did not open a page', () => {
    expect(noticeAfterManage({ ok: true })).toBeNull();
    for (const reason of ['failed', 'unavailable', 'signed-out'] as const) {
      expect(noticeAfterManage({ ok: false, reason })).toBe('manage-failed');
    }
  });
});

describe('the paused notice for the account playing', () => {
  const CASES: [PremiumPlayingAccount, string | null][] = [
    [{ state: 'other', reason: 'other_account' }, 'premiumPausedOtherAccount'],
    [{ state: 'other', reason: 'no_steam_link' }, 'premiumPausedNoSteamLink'],
    [{ state: 'unknown', reason: 'no_session' }, 'premiumPausedNoSession'],
    [{ state: 'unknown', reason: 'no_steam_id64' }, 'premiumPausedNoSession'],
    [{ state: 'unknown', reason: 'report_failed' }, 'premiumPausedReportFailed'],
    [{ state: 'unknown', reason: 'checking' }, 'premiumCheckingAccount'],
    [{ state: 'linked', reason: null }, null],
  ];
  const ALL_KEYS = [
    'premiumPausedOtherAccount',
    'premiumPausedNoSteamLink',
    'premiumPausedNoSession',
    'premiumPausedReportFailed',
    'premiumCheckingAccount',
    'premiumPausedUpdateGame',
  ] as const;

  it.each(['en', 'pt-BR'] as const)('shows exactly the matching text for each state, in %s', (locale) => {
    const copy = locale === 'en' ? en : ptBR;
    for (const [playingAccount, key] of CASES) {
      const shown = text(render(signedIn({}, { playingAccount }), locale));
      for (const other of ALL_KEYS) {
        const expected = other === key || (other === 'premiumPausedUpdateGame' && playingAccount.reason === 'no_steam_id64');
        expect(shown.includes(copy[other]), `${String(playingAccount.reason)} → ${other}`).toBe(expected);
      }
    }
  });

  it('uses a warning banner for another account, a missing Steam link and a failed check, an info banner while waiting for the game, and a plain line while checking', () => {
    const html = (playingAccount: PremiumPlayingAccount) => render(signedIn({}, { playingAccount }));

    expect(html({ state: 'other', reason: 'other_account' })).toContain('data-testid="premium-banner-paused-other_account"');
    expect(html({ state: 'other', reason: 'no_steam_link' })).toContain('data-testid="premium-banner-paused-no_steam_link"');
    expect(html({ state: 'unknown', reason: 'report_failed' })).toContain('data-testid="premium-banner-paused-report_failed"');
    expect(html({ state: 'unknown', reason: 'no_session' })).toContain('data-testid="premium-banner-paused-no_session"');
    const checking = html({ state: 'unknown', reason: 'checking' });
    expect(checking).toContain('data-testid="premium-account-checking"');
    expect(checking).not.toContain('premium-banner-paused');
  });

  it('shows nothing about the account when Premium is not active, or when status is unknown', () => {
    for (const [playingAccount] of CASES) {
      for (const view of [signedIn({ active: false }, { playingAccount }), signedIn(null, { playingAccount })]) {
        const shown = text(render(view));
        for (const key of ALL_KEYS) expect(shown).not.toContain(en[key]);
      }
    }
  });

  it('sits above the payment banners, and a payment banner still shows beside it', () => {
    const html = render(
      signedIn(
        { graceUntil: MIDDAY('2026-10-30'), disputeHold: true },
        { playingAccount: { state: 'other', reason: 'other_account' } },
      ),
    );
    const paused = html.indexOf('premium-banner-paused-other_account');
    const grace = html.indexOf('premium-banner-grace');
    const dispute = html.indexOf('premium-banner-disputeHold');

    expect(paused).toBeGreaterThan(-1);
    expect(grace).toBeGreaterThan(paused);
    expect(dispute).toBeGreaterThan(grace);
  });
});
