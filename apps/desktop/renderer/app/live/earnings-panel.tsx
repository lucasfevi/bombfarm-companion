import type { ReactNode } from 'react';
import type { LiveEarnings } from '@bombfarm/contracts';
import { formatCompactNumber, Icon, Panel, Tooltip } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { formatCapturedAt } from '../../lib/format';
import type { ReachedLiveFreshness } from './freshness-line';
import { formatLiveDurationSeconds } from './format-live-duration';

const EM_DASH = '—';
const MAX_COVERAGE_MINUTES = 10;

/** Below this age a reading is not meaningfully stale — "just now" tells the player nothing they
 *  don't already assume, so the age suffix stays suppressed until the underlying gap actually
 *  means something. Thresholded on the raw millisecond age, never on the formatted string. */
const FRESH_BALANCE_AGE_MS = 60_000;

/**
 * Reserves width for a live-updating number so its own growth cannot shift what comes after it —
 * sized to `formatCompactNumber`'s widest realistic output ("999.9m"). `align` picks which edge
 * the digits hug inside that fixed box: `'right'` (every caller but the gold headline figure)
 * keeps the last digit anchored so a growing number never visually jumps in place; `'left'` (the
 * gold headline figure alone) keeps the first digit flush with the "last N min" coverage label
 * sitting directly under it — a right-aligned box would leave that digit trailing an invisible
 * gap the label doesn't have, since the box's own width does not depend on which edge the text
 * hugs.
 */
function NumericValue({ children, align = 'right' }: { children: ReactNode; align?: 'left' | 'right' }) {
  if (align === 'left') {
    return <span className="inline-block w-[6ch] text-left tabular-nums">{children}</span>;
  }
  return <span className="inline-block w-[6ch] text-right tabular-nums">{children}</span>;
}

/** The rolling window is capped at 600s (10 real minutes) and starts shorter — floored, not
 *  rounded up, so the label never claims more coverage than the figures actually rest on. */
function coverageMinutesLabel(coverageSeconds: number): number {
  return Math.min(MAX_COVERAGE_MINUTES, Math.max(1, Math.floor(coverageSeconds / 60)));
}

function numberText(value: number | null | undefined): ReactNode {
  return <NumericValue>{value == null ? EM_DASH : formatCompactNumber(value, 1)}</NumericValue>;
}

/** Tile-only counterpart of {@link numberText} — no fixed-width box: a tile value is right-aligned
 *  to the tile's own edge and nothing follows it, so a growing number has nothing left to push. */
function tileNumberText(value: number | null | undefined): ReactNode {
  return value == null ? EM_DASH : formatCompactNumber(value, 1);
}

/** Tile-only counterpart of the headline rate value — same reasoning as {@link tileNumberText}:
 *  the unit suffix sits directly beside the digits so it travels with them instead of a separate
 *  reservation pinning it to the tile's edge on its own. */
function tileRateValue(value: number | null | undefined, unit: string): ReactNode {
  if (value == null) return EM_DASH;
  return (
    <>
      {formatCompactNumber(value, 1)}
      <span className="text-muted text-[0.6em] font-normal">{unit}</span>
    </>
  );
}

/** Same shape as {@link tileRateValue}, but with a real space before the unit word — the headline
 *  figures spell their unit out ("gold / hr") rather than tiles' tight "/h", so it reads as two
 *  words rather than running the number and "gold" together. Left-aligned (see {@link NumericValue})
 *  so the digits stay flush with the coverage label under them. */
function headlineRateValue(value: number | null | undefined, unit: string): ReactNode {
  if (value == null) return <NumericValue align="left">{EM_DASH}</NumericValue>;
  return (
    <>
      <NumericValue align="left">{formatCompactNumber(value, 1)}</NumericValue>
      <span className="text-muted text-[0.6em] font-normal">{` ${unit}`}</span>
    </>
  );
}

/**
 * Stacks the real label under an invisible copy of its longest realistic form (the coverage word
 * growing from "1" to "10") so the box is always sized for that longest form.
 */
function RecentWindowLabel({ longest, text }: { longest: string; text: string }) {
  return (
    <span className="relative grid text-[10.5px] text-muted tabular-nums whitespace-nowrap">
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
  secondLineTestId,
  secondLineText = '',
  secondLineReserve = '',
}: {
  testId: string;
  label: ReactNode;
  value: ReactNode;
  className: string;
  /** Test id for the always-mounted second line beneath the value — only the current-gold tile
   *  passes one; the other five tiles leave it unset and render the same reserved-but-blank line,
   *  so every tile in the grid keeps the same height whether or not it ever has anything to say
   *  on that second line. */
  secondLineTestId?: string;
  /** The second line's real text, shown at its own natural width. */
  secondLineText?: string;
  /** The longest realistic form of the second line, mounted invisibly so its width is reserved
   *  before `secondLineText` ever needs it — the current-gold age's own longest form ("23h ago"),
   *  or empty for a tile that never has a second line to show. */
  secondLineReserve?: string;
}) {
  return (
    <div className="rounded-lg border border-line/55 p-3 flex flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">{label}</span>
      <span className="block text-right tabular-nums whitespace-nowrap">
        <span data-testid={testId} className={className}>
          {value}
        </span>
      </span>
      <span className="relative grid text-right text-[10.5px] leading-none text-muted tabular-nums whitespace-nowrap">
        <span aria-hidden className="invisible col-start-1 row-start-1">
          {secondLineReserve || ' '}
        </span>
        <span data-testid={secondLineTestId} className="col-start-1 row-start-1">
          {secondLineText}
        </span>
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
  const currentGoldAgeSource: string | null =
    balanceCapturedAt !== null ? balanceCapturedAt : freshness.kind === 'live' ? null : freshness.sinceAt;
  const currentGoldAgeText: string | null =
    currentGoldAgeSource !== null && Date.now() - Date.parse(currentGoldAgeSource) >= FRESH_BALANCE_AGE_MS
      ? formatCapturedAt(currentGoldAgeSource, t)
      : null;
  // Minutes and hours share the exact same template shape as days ("{n}<letter> ago" / "há
  // {n}<letter>"), so any two-digit bucket reserves the same width as the others — hours' realistic
  // ceiling (just under a day) stands in for all three.
  const currentGoldAgeLongest = sub(t.ageHours, { n: 23 });
  const currentGoldValue: ReactNode = tileNumberText(balance);
  // The age line only ever has something to reserve or show once there is a balance to attach it
  // to — with no balance the value already reads an em dash, and an age under it would pin a
  // fabricated reading to a figure that isn't there.
  const currentGoldAgeReserve = balance !== null ? currentGoldAgeLongest : '';
  const currentGoldAgeShown = balance !== null ? (currentGoldAgeText ?? '') : '';

  return (
    <Panel data-testid="live-earnings" aria-label={t.liveEarningsTitle}>
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
                  {numberText(earnings?.xp10)}
                </span>
                <Tooltip.Provider>
                  <Tooltip.Root>
                    <Tooltip.Trigger
                      type="button"
                      data-testid="live-earnings-xp-help-trigger"
                      aria-label={`${t.liveEarningsXpHeadlineUnit}: ${t.liveEarningsXpHelpBody}`}
                      className="border-0 bg-transparent p-0 text-muted text-[0.6em] font-normal underline decoration-dotted underline-offset-2 cursor-help hover:text-ink focus-visible:rounded-sm focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {t.liveEarningsXpHeadlineUnit}
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Positioner sideOffset={6}>
                        <Tooltip.Popup>
                          <p className="m-0" data-testid="live-earnings-xp-help-body">
                            {t.liveEarningsXpHelpBody}
                          </p>
                        </Tooltip.Popup>
                      </Tooltip.Positioner>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              </span>
            </div>
            <RecentWindowLabel longest={recentWindowLongest} text={recentWindowText} />
          </div>
          <button
            type="button"
            data-testid="live-earnings-reset"
            aria-label={t.liveEarningsResetAria}
            onClick={onReset}
            className="grid place-items-center rounded-sm border-0 bg-transparent p-0 text-muted transition-colors hover:text-ink focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Icon name="arrow-path" size="md" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile
            testId="live-earnings-gold-current"
            label={t.liveEarningsCurrentGoldLabel}
            value={currentGoldValue}
            className="text-[23px] font-bold text-gold"
            secondLineTestId="live-earnings-gold-current-age"
            secondLineText={currentGoldAgeShown}
            secondLineReserve={currentGoldAgeReserve}
          />
          <Tile
            testId="live-earnings-gold-session-total"
            label={t.liveEarningsGoldSessionTotalLabel}
            value={tileNumberText(earnings?.goldSessionTotal)}
            className="text-[23px] font-bold text-gold"
          />
          <Tile
            testId="live-earnings-xp-session-total"
            label={t.liveEarningsXpSessionTotalLabel}
            value={tileNumberText(earnings?.xpSessionTotal)}
            className="text-[23px] font-bold text-info"
          />
          <Tile
            testId="live-earnings-elapsed"
            label={t.liveEarningsElapsedLabel}
            value={formatLiveDurationSeconds(sessionSeconds)}
            className="text-[23px] font-bold text-ink"
          />
          <Tile
            testId="live-earnings-gold-session"
            label={t.liveEarningsGoldSessionLabel}
            value={tileRateValue(earnings?.goldSession, t.liveEarningsRateUnit)}
            className="text-[23px] font-bold text-gold/70"
          />
          <Tile
            testId="live-earnings-xp-session"
            label={t.liveEarningsXpSessionLabel}
            value={tileRateValue(earnings?.xpSession, t.liveEarningsRateUnit)}
            className="text-[23px] font-bold text-info/70"
          />
        </div>
      </div>
    </Panel>
  );
}
