import { describe, expect, it } from 'vitest';
import { signedOutPremiumView, type PremiumStatus, type PremiumView } from '@bombfarm/contracts';
import { premiumAccountNoticeFor, premiumBannersFor } from './premium-banners';

const quiet: PremiumStatus = {
  active: true,
  kinds: ['subscription'],
  until: '2026-12-01T12:00:00.000Z',
  awaitingPaymentUntil: null,
  graceUntil: null,
  cancellationAt: null,
  paymentFailed: false,
  pendingFirstPayment: false,
  disputeHold: false,
};

function viewWith(status: Partial<PremiumStatus>, rest: Partial<PremiumView> = {}): PremiumView {
  return {
    ...signedOutPremiumView,
    session: 'signed-in',
    status: { ...quiet, ...status },
    fetchedAt: '2026-10-17T10:00:00.000Z',
    ...rest,
  };
}

const ids = (view: PremiumView) => premiumBannersFor(view).map((banner) => banner.id);

describe('which banners the Premium tab shows', () => {
  it('shows none for a healthy status', () => {
    expect(premiumBannersFor(viewWith({}))).toEqual([]);
  });

  it('shows a warning that a boleto is waiting when payment is awaited', () => {
    const [banner] = premiumBannersFor(viewWith({ awaitingPaymentUntil: '2026-10-20T12:00:00.000Z' }));

    expect(banner).toMatchObject({ id: 'awaitingPayment', tone: 'warn', titleKey: 'premiumBannerAwaitingTitle' });
  });

  it('shows a warning with the end of the grace period', () => {
    const [banner] = premiumBannersFor(viewWith({ graceUntil: '2026-10-25T12:00:00.000Z' }));

    expect(banner).toMatchObject({ id: 'grace', tone: 'warn', date: '2026-10-25T12:00:00.000Z' });
  });

  it('shows a danger banner when the payment failed', () => {
    const [banner] = premiumBannersFor(viewWith({ paymentFailed: true }));

    expect(banner).toMatchObject({ id: 'paymentFailed', tone: 'danger' });
  });

  it('shows a danger banner when a dispute holds Premium', () => {
    const [banner] = premiumBannersFor(viewWith({ disputeHold: true }));

    expect(banner).toMatchObject({ id: 'disputeHold', tone: 'danger' });
  });

  it('orders awaiting payment, grace, payment failed and dispute hold when all four apply', () => {
    const everything = viewWith({
      awaitingPaymentUntil: '2026-10-20T12:00:00.000Z',
      graceUntil: '2026-10-25T12:00:00.000Z',
      paymentFailed: true,
      disputeHold: true,
    });

    expect(ids(everything)).toEqual(['awaitingPayment', 'grace', 'paymentFailed', 'disputeHold']);
  });

  it('puts the could-not-reach banner first, with the time of the status it falls back to', () => {
    const view = viewWith({ paymentFailed: true, disputeHold: true }, { lastRefreshFailed: true });

    expect(ids(view)).toEqual(['unreachable', 'paymentFailed', 'disputeHold']);
    expect(premiumBannersFor(view)[0]).toMatchObject({ tone: 'warn', time: '2026-10-17T10:00:00.000Z' });
  });

  it('shows only the could-not-reach banner for a healthy status that could not be refreshed', () => {
    expect(ids(viewWith({}, { lastRefreshFailed: true }))).toEqual(['unreachable']);
  });

  it('shows no banner when there is no status to fall back to', () => {
    expect(premiumBannersFor({ ...signedOutPremiumView, session: 'signed-in', lastRefreshFailed: true })).toEqual([]);
  });

  it('does not turn a pending first payment or a scheduled cancellation into a banner', () => {
    const view = viewWith({ pendingFirstPayment: true, cancellationAt: '2026-11-01T12:00:00.000Z' });

    expect(premiumBannersFor(view)).toEqual([]);
  });
});

describe('the account notice', () => {
  it('maps each paused reason to its tone and copy', () => {
    const notice = (playingAccount: PremiumView['playingAccount']) =>
      premiumAccountNoticeFor(viewWith({}, { playingAccount }));

    expect(notice({ state: 'other', reason: 'other_account' })).toEqual({
      kind: 'paused',
      reason: 'other_account',
      tone: 'warn',
      titleKey: 'premiumPausedOtherAccount',
      bodyKey: null,
    });
    expect(notice({ state: 'other', reason: 'no_steam_link' })).toMatchObject({ tone: 'warn', titleKey: 'premiumPausedNoSteamLink' });
    expect(notice({ state: 'unknown', reason: 'no_session' })).toMatchObject({ tone: 'info', titleKey: 'premiumPausedNoSession', bodyKey: null });
    expect(notice({ state: 'unknown', reason: 'no_steam_id64' })).toMatchObject({
      tone: 'info',
      titleKey: 'premiumPausedNoSession',
      bodyKey: 'premiumPausedUpdateGame',
    });
    expect(notice({ state: 'unknown', reason: 'report_failed' })).toMatchObject({ tone: 'warn', titleKey: 'premiumPausedReportFailed' });
    expect(notice({ state: 'unknown', reason: 'checking' })).toEqual({ kind: 'checking' });
    expect(notice({ state: 'linked', reason: null })).toBeNull();
    expect(notice({ state: 'unknown', reason: 'signed_out' })).toBeNull();
  });

  it('is absent unless signed in with Premium active', () => {
    const playingAccount = { state: 'other', reason: 'other_account' } as const;

    expect(premiumAccountNoticeFor(viewWith({ active: false }, { playingAccount }))).toBeNull();
    expect(premiumAccountNoticeFor(viewWith({}, { playingAccount, status: null }))).toBeNull();
    expect(premiumAccountNoticeFor(viewWith({}, { playingAccount, session: 'signing-in' }))).toBeNull();
  });
});
