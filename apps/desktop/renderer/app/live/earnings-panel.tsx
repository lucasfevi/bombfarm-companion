import type { ReactNode } from 'react';
import type { LiveEarnings } from '@bombfarm/contracts';
import { GoldIcon } from '@bombfarm/game-art';
import { Button, formatCompactNumber, HelpTip, Icon, Panel, PanelHeader } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { formatCapturedAt } from '../../lib/format';
import type { ReachedLiveFreshness } from './freshness-line';
import { formatLiveDurationSeconds } from './format-live-duration';

const EM_DASH = '—';
const MAX_COVERAGE_MINUTES = 10;

/** The rolling window is capped at 600s (10 real minutes) and starts shorter — floored, not
 *  rounded up, so the label never claims more coverage than the figures actually rest on. */
function coverageMinutesLabel(coverageSeconds: number): number {
  return Math.min(MAX_COVERAGE_MINUTES, Math.max(1, Math.floor(coverageSeconds / 60)));
}

function rateValue(value: number | null | undefined, unit: string): ReactNode {
  if (value == null) return EM_DASH;
  return (
    <>
      {formatCompactNumber(value, 1)}
      <span className="text-muted text-[0.6em] font-normal">{unit}</span>
    </>
  );
}

/**
 * Stacks the real label under an invisible copy of its longest realistic form (the coverage word
 * growing from "1" to "10") so the grid cell is always sized for that longest form — the fixed
 * `<colgroup>` widths that used to reserve this space disappear with the table.
 */
function RecentLabel({ testId, longest, text }: { testId: string; longest: string; text: string }) {
  return (
    <span className="relative grid text-[10.5px] uppercase tracking-[0.06em] text-muted tabular-nums whitespace-nowrap">
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {longest}
      </span>
      <span data-testid={testId} className="col-start-1 row-start-1">
        {text}
      </span>
    </span>
  );
}

function Cell({
  valueTestId,
  value,
  className,
  icon,
  label,
}: {
  valueTestId: string;
  value: ReactNode;
  className: string;
  icon?: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="inline-flex items-baseline gap-1.5 tabular-nums">
        {icon}
        <span data-testid={valueTestId} className={className}>
          {value}
        </span>
      </span>
      {label}
    </div>
  );
}

export function EarningsPanel({
  freshness,
  earnings,
  onReset,
}: {
  freshness: ReachedLiveFreshness;
  earnings: LiveEarnings | null;
  onReset: () => void;
}) {
  const t = useCopy();

  const sessionSeconds = earnings?.sessionSeconds ?? 0;
  const coverageSeconds = earnings?.coverageSeconds ?? 0;
  const minutes = coverageMinutesLabel(coverageSeconds);
  const goldRecentLabel = sub(t.liveEarningsGoldRecentLabel, { minutes });
  const goldRecentLongest = sub(t.liveEarningsGoldRecentLabel, { minutes: MAX_COVERAGE_MINUTES });
  const xpRecentLabel = sub(t.liveEarningsXpRecentLabel, { minutes });
  const xpRecentLongest = sub(t.liveEarningsXpRecentLabel, { minutes: MAX_COVERAGE_MINUTES });

  const balance = earnings?.goldBalance ?? null;
  const balanceCapturedAt = earnings?.goldBalanceCapturedAt ?? null;
  // A stored-reading fallback ages by its own capture time; a tick-frozen balance instead ages by
  // the stream's own gap (`freshness.sinceAt`). The two never both apply — the main process only
  // ever populates one of `goldBalance`'s two sources at a time.
  const currentGold: ReactNode =
    balance === null
      ? EM_DASH
      : balanceCapturedAt !== null
        ? `${formatCompactNumber(balance, 1)} · ${formatCapturedAt(balanceCapturedAt, t)}`
        : freshness.kind === 'live'
          ? formatCompactNumber(balance, 1)
          : `${formatCompactNumber(balance, 1)} · ${formatCapturedAt(freshness.sinceAt, t)}`;

  return (
    <Panel data-testid="live-earnings">
      <PanelHeader title={t.liveEarningsTitle}>
        <span className="flex items-center gap-3 text-xs text-muted">
          <span data-testid="live-earnings-session-duration">
            {sub(t.liveEarningsSessionDurationValue, { duration: formatLiveDurationSeconds(sessionSeconds) })}
          </span>
          <Button
            type="button"
            variant="ghost"
            className="p-1"
            data-testid="live-earnings-reset"
            aria-label={t.liveEarningsResetAria}
            onClick={onReset}
          >
            <Icon name="arrow-path" size="xs" />
          </Button>
        </span>
      </PanelHeader>
      <div className="flex flex-wrap items-stretch gap-y-4">
        <div className="flex items-stretch">
          <Cell
            valueTestId="live-earnings-gold-current"
            value={currentGold}
            className="text-[26px] font-semibold text-gold"
            icon={<GoldIcon className="size-6" />}
            label={<span className="text-[10.5px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">{t.liveEarningsCurrentGoldLabel}</span>}
          />
          <span aria-hidden className="mx-4 w-px shrink-0 self-stretch bg-line/55" />
          <Cell
            valueTestId="live-earnings-gold-10"
            value={rateValue(earnings?.gold10, t.liveEarningsRateUnit)}
            className="text-xl font-semibold text-gold"
            label={
              <RecentLabel testId="live-earnings-gold-10-label" longest={goldRecentLongest} text={goldRecentLabel} />
            }
          />
          <span aria-hidden className="mx-4 w-px shrink-0 self-stretch bg-line/55" />
          <Cell
            valueTestId="live-earnings-gold-session"
            value={rateValue(earnings?.goldSession, t.liveEarningsRateUnit)}
            className="text-xl font-semibold text-gold/70"
            label={<span className="text-[10.5px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">{t.liveEarningsGoldSessionLabel}</span>}
          />
        </div>
        <div className="flex items-stretch">
          <span aria-hidden className="mx-4 w-px shrink-0 self-stretch bg-line/55" />
          <Cell
            valueTestId="live-earnings-xp-10"
            value={rateValue(earnings?.xp10, t.liveEarningsRateUnit)}
            className="text-base font-semibold text-info"
            label={
              <span className="inline-flex items-center gap-1">
                <RecentLabel testId="live-earnings-xp-10-label" longest={xpRecentLongest} text={xpRecentLabel} />
                <HelpTip label={t.liveEarningsXpHelpLabel}>{t.liveEarningsXpHelpBody}</HelpTip>
              </span>
            }
          />
          <span aria-hidden className="mx-4 w-px shrink-0 self-stretch bg-line/55" />
          <Cell
            valueTestId="live-earnings-xp-session"
            value={rateValue(earnings?.xpSession, t.liveEarningsRateUnit)}
            className="text-base font-semibold text-info/70"
            label={<span className="text-[10.5px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">{t.liveEarningsXpSessionLabel}</span>}
          />
        </div>
      </div>
    </Panel>
  );
}
