'use client';

import { useState } from 'react';
import type { PremiumKind, PremiumView } from '@bombfarm/contracts';
import { Button, EmptyState, cn } from '@bombfarm/ui';
import { sub, useCopy, useLocale, type Copy } from '../../lib/copy';
import { formatCapturedAt, formatDate } from '../../lib/format';
import { usePremium } from '../../lib/premium/use-premium';
import { PremiumBanners } from './premium-banners';
import { PremiumLicenceLine } from './premium-licence-line';
import { PremiumMount } from './premium-mount';
import { noticeAfterManage, noticeAfterRefresh, type PremiumNotice } from './premium-notice';

const KIND_ORDER = ['subscription', 'pass', 'manual_grant'] as const satisfies readonly PremiumKind[];

const KIND_COPY_KEY = {
  subscription: 'premiumKindSubscription',
  pass: 'premiumKindPass',
  manual_grant: 'premiumKindManualGrant',
} as const satisfies Record<PremiumKind, keyof Copy>;

const NOTICE_COPY_KEY = {
  'too-soon': 'premiumRefreshTooSoon',
  'manage-failed': 'premiumManageFailed',
} as const satisfies Record<PremiumNotice, keyof Copy>;

export function PremiumScreenView({
  view,
  notice,
  onSignIn,
  onRefresh,
  onManage,
  onUseHere,
}: {
  view: PremiumView;
  notice: PremiumNotice | null;
  onSignIn: () => void;
  onRefresh: () => void;
  onManage: () => void;
  onUseHere: () => void;
}) {
  const t = useCopy();
  const { locale } = useLocale();

  if (view.session !== 'signed-in') {
    return (
      <div data-testid="premium-view" className="flex flex-1 flex-col">
        <EmptyState
          icon="star"
          title={t.premiumSignedOutTitle}
          description={t.premiumSignedOutBody}
          action={
            <Button
              type="button"
              variant="default"
              data-testid="premium-sign-in"
              disabled={view.session === 'signing-in'}
              onClick={onSignIn}
            >
              {t.premiumSignInAction}
            </Button>
          }
        />
      </div>
    );
  }

  const status = view.status;
  const kinds = status === null ? [] : KIND_ORDER.filter((kind) => status.kinds.includes(kind));

  return (
    <div data-testid="premium-view" className="flex flex-1 flex-col gap-3">
      <PremiumBanners view={view} />
      <PremiumLicenceLine licence={view.licence} onUseHere={onUseHere} />
      {status === null ? (
        <p data-testid="premium-unavailable" className="text-sm text-muted">
          {t.premiumStatusUnavailable}
        </p>
      ) : (
        <section className="flex flex-col gap-1">
          <h2 data-testid="premium-headline" className="text-base font-semibold text-ink">
            {status.active ? t.premiumActive : t.premiumNotActive}
          </h2>
          {status.active && kinds.length > 0 ? (
            <p data-testid="premium-kinds" className="text-sm text-ink">
              {sub(t.premiumKindsLine, { kinds: kinds.map((kind) => t[KIND_COPY_KEY[kind]]).join(', ') })}
            </p>
          ) : null}
          {status.active ? (
            <p data-testid="premium-until" className="text-sm text-ink">
              {status.until === null ? t.premiumNoEndDate : sub(t.premiumUntil, { date: formatDate(status.until, locale) })}
            </p>
          ) : null}
          {status.cancellationAt !== null ? (
            <p data-testid="premium-cancellation" className="text-sm text-muted">
              {sub(t.premiumWillNotRenew, { date: formatDate(status.cancellationAt, locale) })}
            </p>
          ) : null}
          {status.pendingFirstPayment ? (
            <p data-testid="premium-first-payment" className="text-sm text-muted">
              {t.premiumFirstPaymentPending}
            </p>
          ) : null}
        </section>
      )}
      {view.fetchedAt !== null ? (
        <p data-testid="premium-updated" className="text-xs text-muted">
          {sub(t.premiumUpdated, { time: formatCapturedAt(view.fetchedAt, t) })}
        </p>
      ) : null}
      <PremiumMount host={view.host} />
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" data-testid="premium-refresh" onClick={onRefresh}>
          {t.premiumRefreshAction}
        </Button>
        <Button type="button" variant="default" data-testid="premium-manage" onClick={onManage}>
          {t.premiumManageAction}
        </Button>
      </div>
      <p
        role="status"
        data-testid="premium-notice"
        aria-hidden={notice === null}
        className={cn('text-xs', 'text-muted', notice === null && 'invisible')}
      >
        {notice === null ? '' : t[NOTICE_COPY_KEY[notice]]}
      </p>
    </div>
  );
}

export function PremiumScreen() {
  const { view, signIn, refresh, manage, moveHere } = usePremium();
  const [notice, setNotice] = useState<PremiumNotice | null>(null);

  return (
    <PremiumScreenView
      view={view}
      notice={notice}
      onSignIn={() => {
        setNotice(null);
        void signIn();
      }}
      onRefresh={() => {
        void refresh().then((result) => {
          setNotice(noticeAfterRefresh(result));
        });
      }}
      onManage={() => {
        void manage().then((result) => {
          setNotice(noticeAfterManage(result));
        });
      }}
      onUseHere={() => {
        void moveHere();
      }}
    />
  );
}
