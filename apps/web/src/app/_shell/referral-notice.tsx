'use client';

import type { Strings } from '@/shared/i18n';
import { REFERRAL_CODE } from '@/shared/referral';
import { Button } from '@bombfarm/ui';
import { useReferralCopy } from './use-referral-copy';

export function ReferralNotice({ t, onDismiss }: { t: Strings; onDismiss: () => void }) {
  const { codeRef, copy } = useReferralCopy(t);

  // Only a successful clipboard write dismisses. The fallback leaves the code selected for a
  // manual Ctrl+C, which needs the notice — and the selection inside it — to stay on screen.
  async function copyThenDismiss() {
    if (await copy()) onDismiss();
  }

  return (
    <section
      data-testid="referral-notice"
      aria-label={t.referralNoticeTitle}
      className="mx-auto mt-3 flex w-[min(calc(var(--maxw)/2),calc(100%-32px))] flex-col gap-3 border border-[color-mix(in_oklch,var(--accent)_35%,var(--line))] bg-[color-mix(in_oklch,var(--accent)_7%,var(--surface))] px-3.5 py-3"
    >
      <div className="min-w-0">
        <h2 className="m-0 text-[13px] font-bold text-accent">{t.referralNoticeTitle}</h2>
        <p className="m-0 mt-1.5 text-[12.5px] leading-1.45 text-ink">
          {t.referralNoticeBody} {t.referralNoticeReward}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={copyThenDismiss}
          data-testid="referral-notice-copy"
          className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-sm border border-line bg-bg-2 px-2.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent motion-safe:transition-[border-color,color] motion-safe:duration-[120ms]"
        >
          <code ref={codeRef} className="font-mono tracking-[0.06em] text-accent">
            {REFERRAL_CODE}
          </code>
          {t.referralNoticeCopy}
        </button>
        <Button type="button" variant="ghost" onClick={onDismiss}>
          {t.referralNoticeDismiss}
        </Button>
      </div>
    </section>
  );
}
