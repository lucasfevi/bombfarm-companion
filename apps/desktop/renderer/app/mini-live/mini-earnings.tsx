import type { ReactNode } from 'react';
import type { LiveEarnings } from '@bombfarm/contracts';
import { formatCompactNumber, Icon, type Lang } from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCount } from '../../lib/format';

const EM_DASH = '—';
const MAX_COVERAGE_MINUTES = 10;

function coverageMinutesLabel(coverageSeconds: number): number {
  return Math.min(MAX_COVERAGE_MINUTES, Math.max(1, Math.floor(coverageSeconds / 60)));
}

function numberText(value: number | null | undefined, lang: Lang): ReactNode {
  return value == null ? EM_DASH : formatCompactNumber(value, lang, 1);
}

function Figure({
  testId,
  label,
  value,
  className,
}: {
  testId: string;
  label: string;
  value: ReactNode;
  className: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">{label}</span>
      <span data-testid={testId} className={className}>
        {value}
      </span>
    </div>
  );
}

export function MiniEarnings({ earnings, onReset }: { earnings: LiveEarnings | null; onReset: () => void }) {
  const t = useCopy();
  const { lang, locale } = useLocale();

  const coverageSeconds = earnings?.coverageSeconds ?? 0;
  const minutes = coverageMinutesLabel(coverageSeconds);
  const recentWindowText = sub(t.liveEarningsRecentWindowLabel, { minutes });

  return (
    <section data-testid="mini-earnings" aria-label={t.liveEarningsTitle} className="relative min-w-0 rounded-md border border-line/55 bg-surface p-2">
      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-2">
          <div className="flex min-w-0 flex-col items-start gap-0.5">
            <span
              data-testid="live-earnings-recent-window-label"
              className="text-[10px] text-muted tabular-nums whitespace-nowrap"
            >
              {recentWindowText}
            </span>
            <span data-testid="live-earnings-gold-10" className="text-[20px] font-bold leading-none text-gold tabular-nums">
              {numberText(earnings?.gold10, lang)}
            </span>
            <span className="text-[10px] text-muted">{t.liveEarningsGoldHeadlineUnit}</span>
          </div>
          <div className="flex min-w-0 flex-col items-end gap-0.5">
            <span className="text-[10px] text-muted">{t.liveEarningsXpHeadlineUnit}</span>
            <span data-testid="live-earnings-xp-10" className="text-[16px] font-bold leading-none text-info tabular-nums">
              {numberText(earnings?.xp10, lang)}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line/55 pt-2 sm:grid-cols-3">
          <Figure
            testId="live-earnings-gold-current"
            label={t.liveEarningsCurrentGoldLabel}
            value={numberText(earnings?.goldBalance, lang)}
            className="text-[15px] font-bold tabular-nums text-gold"
          />
          <Figure
            testId="live-earnings-gold-session"
            label={t.liveEarningsGoldSessionLabel}
            value={numberText(earnings?.goldSession, lang)}
            className="text-[15px] font-bold tabular-nums text-gold/70"
          />
          <Figure
            testId="live-earnings-xp-session"
            label={t.liveEarningsXpSessionLabel}
            value={numberText(earnings?.xpSession, lang)}
            className="text-[15px] font-bold tabular-nums text-info/70"
          />
          <Figure
            testId="live-earnings-gold-per-prop"
            label={t.liveEarningsGoldPerPropLabel}
            value={earnings?.goldPerProp10 == null ? EM_DASH : formatCount(earnings.goldPerProp10, locale)}
            className="text-[15px] font-bold tabular-nums text-gold"
          />
          <Figure
            testId="live-earnings-props-per-minute"
            label={t.liveEarningsPropsPerMinuteLabel}
            value={earnings?.propsPerMinute10 == null ? EM_DASH : formatCount(earnings.propsPerMinute10, locale)}
            className="text-[15px] font-bold tabular-nums text-ink"
          />
          <Figure
            testId="live-earnings-props-total"
            label={t.liveEarningsPropsTotalLabel}
            value={earnings?.propsSessionTotal == null ? EM_DASH : formatCount(earnings.propsSessionTotal, locale)}
            className="text-[15px] font-bold tabular-nums text-ink"
          />
        </div>
      </div>
      <button
        type="button"
        data-testid="live-earnings-reset"
        title={t.liveEarningsResetAria}
        aria-label={t.liveEarningsResetAria}
        onClick={onReset}
        className="absolute right-1 top-1 grid place-items-center rounded-sm border-0 bg-transparent p-0 text-muted transition-colors hover:text-ink focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Icon name="arrow-path" size="sm" />
      </button>
    </section>
  );
}
