import type { PremiumPlayingAccount, PremiumView } from '@bombfarm/contracts';
import { Banner } from '@bombfarm/ui';
import { sub, useCopy, useLocale, type Copy } from '../../lib/copy';
import { formatCapturedAt, formatDate } from '../../lib/format';

export type PremiumBannerId = 'unreachable' | 'awaitingPayment' | 'grace' | 'paymentFailed' | 'disputeHold';

export interface PremiumBannerSpec {
  readonly id: PremiumBannerId;
  readonly tone: 'warn' | 'danger';
  readonly titleKey: keyof Copy;
  readonly bodyKey: keyof Copy;
  readonly date: string | null;
  readonly time: string | null;
}

const BASE = { date: null, time: null } as const;

export function premiumBannersFor(view: PremiumView): PremiumBannerSpec[] {
  const status = view.status;
  const banners: PremiumBannerSpec[] = [];
  if (view.lastRefreshFailed && status !== null) {
    banners.push({
      ...BASE,
      id: 'unreachable',
      tone: 'warn',
      titleKey: 'premiumBannerUnreachableTitle',
      bodyKey: 'premiumBannerUnreachableBody',
      time: view.fetchedAt,
    });
  }
  if (status === null) return banners;
  if (status.awaitingPaymentUntil !== null) {
    banners.push({
      ...BASE,
      id: 'awaitingPayment',
      tone: 'warn',
      titleKey: 'premiumBannerAwaitingTitle',
      bodyKey: 'premiumBannerAwaitingBody',
    });
  }
  if (status.graceUntil !== null) {
    banners.push({
      ...BASE,
      id: 'grace',
      tone: 'warn',
      titleKey: 'premiumBannerGraceTitle',
      bodyKey: 'premiumBannerGraceBody',
      date: status.graceUntil,
    });
  }
  if (status.paymentFailed) {
    banners.push({
      ...BASE,
      id: 'paymentFailed',
      tone: 'danger',
      titleKey: 'premiumBannerPaymentFailedTitle',
      bodyKey: 'premiumBannerPaymentFailedBody',
    });
  }
  if (status.disputeHold) {
    banners.push({
      ...BASE,
      id: 'disputeHold',
      tone: 'danger',
      titleKey: 'premiumBannerDisputeTitle',
      bodyKey: 'premiumBannerDisputeBody',
    });
  }
  return banners;
}

type PausedReason = Exclude<PremiumPlayingAccount['reason'], null | 'checking' | 'signed_out'>;

export type PremiumAccountNotice =
  | { readonly kind: 'checking' }
  | {
      readonly kind: 'paused';
      readonly reason: PausedReason;
      readonly tone: 'warn' | 'info';
      readonly titleKey: keyof Copy;
      readonly bodyKey: keyof Copy | null;
    };

const PAUSED: Record<PausedReason, Omit<Extract<PremiumAccountNotice, { kind: 'paused' }>, 'kind' | 'reason'>> = {
  other_account: { tone: 'warn', titleKey: 'premiumPausedOtherAccount', bodyKey: null },
  no_steam_link: { tone: 'warn', titleKey: 'premiumPausedNoSteamLink', bodyKey: null },
  no_session: { tone: 'info', titleKey: 'premiumPausedNoSession', bodyKey: null },
  no_steam_id64: { tone: 'info', titleKey: 'premiumPausedNoSession', bodyKey: 'premiumPausedUpdateGame' },
  report_failed: { tone: 'warn', titleKey: 'premiumPausedReportFailed', bodyKey: null },
};

/** Why Premium is held back for the account playing — only for a player whose Premium is active. */
export function premiumAccountNoticeFor(view: PremiumView): PremiumAccountNotice | null {
  if (view.session !== 'signed-in' || view.status?.active !== true) return null;
  const { reason } = view.playingAccount;
  if (reason === null || reason === 'signed_out') return null;
  if (reason === 'checking') return { kind: 'checking' };
  return { kind: 'paused', reason, ...PAUSED[reason] };
}

function PremiumAccountNoticeView({ view }: { view: PremiumView }) {
  const t = useCopy();
  const notice = premiumAccountNoticeFor(view);
  if (notice === null) return null;
  if (notice.kind === 'checking') {
    return (
      <p data-testid="premium-account-checking" className="text-sm text-muted">
        {t.premiumCheckingAccount}
      </p>
    );
  }
  return (
    <Banner
      tone={notice.tone}
      layout="embedded"
      title={t[notice.titleKey]}
      data-testid={`premium-banner-paused-${notice.reason}`}
    >
      {notice.bodyKey === null ? null : t[notice.bodyKey]}
    </Banner>
  );
}

export function PremiumBanners({ view }: { view: PremiumView }) {
  const t = useCopy();
  const { locale } = useLocale();
  return (
    <>
      <PremiumAccountNoticeView view={view} />
      {premiumBannersFor(view).map((banner) => (
        <Banner
          key={banner.id}
          tone={banner.tone}
          layout="embedded"
          title={t[banner.titleKey]}
          data-testid={`premium-banner-${banner.id}`}
        >
          {sub(t[banner.bodyKey], {
            date: banner.date === null ? '' : formatDate(banner.date, locale),
            time: banner.time === null ? '' : formatCapturedAt(banner.time, t),
          })}
        </Banner>
      ))}
    </>
  );
}
