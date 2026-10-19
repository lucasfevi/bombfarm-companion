import type { PremiumView } from '@bombfarm/contracts';
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

export function PremiumBanners({ view }: { view: PremiumView }) {
  const t = useCopy();
  const { locale } = useLocale();
  return (
    <>
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
