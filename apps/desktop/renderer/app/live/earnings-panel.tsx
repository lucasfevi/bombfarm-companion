import type { ReactNode } from 'react';
import type { LiveEarnings } from '@bombfarm/contracts';
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

function numberText(value: number | null | undefined): string {
  return value == null ? EM_DASH : formatCompactNumber(value, 1);
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

/** Same shape as {@link rateValue}, but with a real space before the unit word — the headline
 *  figures spell their unit out ("gold / hr") rather than tiles' tight "/h", so it reads as two
 *  words rather than running the number and "gold" together. */
function headlineRateValue(value: number | null | undefined, unit: string): ReactNode {
  if (value == null) return EM_DASH;
  return (
    <>
      {formatCompactNumber(value, 1)}
      <span className="text-muted text-[0.6em] font-normal">{` ${unit}`}</span>
    </>
  );
}

/**
 * Stacks the real label under an invisible copy of its longest realistic form (the coverage word
 * growing from "1" to "10") so the box is always sized for that longest form — the two headline
 * figures share this one context line, so a single reservation covers both.
 */
function RecentWindowLabel({ longest, text }: { longest: string; text: string }) {
  return (
    <span className="relative grid text-[10.5px] tabular-nums whitespace-nowrap">
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {longest}
      </span>
      <span data-testid="live-earnings-recent-window-label" className="col-start-1 row-start-1">
        {text}
      </span>
    </span>
  );
}

function Tile({
  testId,
  label,
  value,
  className,
}: {
  testId: string;
  label: ReactNode;
  value: ReactNode;
  className: string;
}) {
  return (
    <div className="rounded-lg border border-line/55 p-3 flex flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">{label}</span>
      <span data-testid={testId} className={className}>
        {value}
      </span>
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
  const recentWindowText = sub(t.liveEarningsRecentWindowLabel, { minutes });
  const recentWindowLongest = sub(t.liveEarningsRecentWindowLabel, { minutes: MAX_COVERAGE_MINUTES });

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

  const sessionAverageText = sub(t.liveEarningsSessionAverageValue, {
    value: earnings?.goldSession == null ? EM_DASH : `${formatCompactNumber(earnings.goldSession, 1)}${t.liveEarningsRateUnit}`,
  });

  return (
    <Panel data-testid="live-earnings">
      <PanelHeader title={t.liveEarningsTitle} />
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-line/55 p-4">
          <div className="flex flex-col gap-1.5">
            <div data-testid="live-earnings-headline-baseline" className="flex items-baseline gap-3">
              <span className="inline-flex items-baseline gap-1 tabular-nums">
                <span data-testid="live-earnings-gold-10" className="text-[38px] font-bold text-gold">
                  {headlineRateValue(earnings?.gold10, t.liveEarningsGoldHeadlineUnit)}
                </span>
              </span>
              <span className="inline-flex items-baseline gap-1 tabular-nums">
                <span data-testid="live-earnings-xp-10" className="text-[19px] font-bold text-info">
                  {headlineRateValue(earnings?.xp10, t.liveEarningsXpHeadlineUnit)}
                </span>
                <HelpTip label={t.liveEarningsXpHelpLabel}>{t.liveEarningsXpHelpBody}</HelpTip>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-muted">
              <RecentWindowLabel longest={recentWindowLongest} text={recentWindowText} />
              <span aria-hidden>·</span>
              <span data-testid="live-earnings-session-average" className="text-[10.5px] tabular-nums whitespace-nowrap">
                {sessionAverageText}
              </span>
            </div>
          </div>
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
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
          <Tile
            testId="live-earnings-gold-current"
            label={t.liveEarningsCurrentGoldLabel}
            value={currentGold}
            className="text-[23px] font-bold text-gold"
          />
          <Tile
            testId="live-earnings-gold-session-total"
            label={t.liveEarningsGoldSessionTotalLabel}
            value={numberText(earnings?.goldSessionTotal)}
            className="text-[23px] font-bold text-gold"
          />
          <Tile
            testId="live-earnings-elapsed"
            label={t.liveEarningsElapsedLabel}
            value={formatLiveDurationSeconds(sessionSeconds)}
            className="text-[23px] font-bold text-ink"
          />
          <Tile
            testId="live-earnings-xp-session-total"
            label={t.liveEarningsXpSessionTotalLabel}
            value={numberText(earnings?.xpSessionTotal)}
            className="text-[23px] font-bold text-info"
          />
          <Tile
            testId="live-earnings-gold-session"
            label={t.liveEarningsGoldSessionLabel}
            value={rateValue(earnings?.goldSession, t.liveEarningsRateUnit)}
            className="text-[23px] font-bold text-gold/70"
          />
          <Tile
            testId="live-earnings-xp-session"
            label={t.liveEarningsXpSessionLabel}
            value={rateValue(earnings?.xpSession, t.liveEarningsRateUnit)}
            className="text-[23px] font-bold text-info/70"
          />
        </div>
      </div>
    </Panel>
  );
}
