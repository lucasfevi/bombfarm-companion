import type { ReactNode } from 'react';
import type { LiveEarnings } from '@bombfarm/contracts';
import { formatCompactNumber, Icon, Panel, Tooltip } from '@bombfarm/ui';
import { copyVariants, sub, useCopy } from '../../lib/copy';
import { formatCapturedAt } from '../../lib/format';
import type { ReachedLiveFreshness } from './freshness-line';
import { formatLiveDurationSeconds } from './format-live-duration';

const EM_DASH = '—';
const MAX_COVERAGE_MINUTES = 10;

/** Below this age a reading is not meaningfully stale — "just now" tells the player nothing they
 *  don't already assume, so the age suffix stays suppressed until the underlying gap actually
 *  means something. Thresholded on the raw millisecond age, never on the formatted string. */
const FRESH_BALANCE_AGE_MS = 60_000;

/** The rolling window is capped at 600s (10 real minutes) and starts shorter — floored, not
 *  rounded up, so the label never claims more coverage than the figures actually rest on. */
function coverageMinutesLabel(coverageSeconds: number): number {
  return Math.min(MAX_COVERAGE_MINUTES, Math.max(1, Math.floor(coverageSeconds / 60)));
}

function numberText(value: number | null | undefined): ReactNode {
  return value == null ? EM_DASH : formatCompactNumber(value, 1);
}

/**
 * Stacks the visible text over an always-mounted invisible copy of EVERY locale's candidate string
 * for that same slot, so the box is exactly as wide as the widest of them regardless of which
 * language is active right now — the reservation `RecentWindowLabel`'s single-locale sizer already
 * used, generalised to cover the case where the two languages themselves differ in width (the
 * headline unit lines below). `candidates` comes from `copyVariants()`, never a raw import of a
 * single locale module, so a reword of either language's string moves this with it.
 */
function ReservedLine({
  candidates,
  testId,
  text,
  className,
}: {
  candidates: readonly string[];
  testId?: string;
  text: ReactNode;
  className: string;
}) {
  return (
    <span className={className}>
      {candidates.map((candidate, index) => (
        <span key={index} aria-hidden className="invisible col-start-1 row-start-1">
          {candidate}
        </span>
      ))}
      <span data-testid={testId} className="col-start-1 row-start-1">
        {text}
      </span>
    </span>
  );
}

/** Right-aligned label-over-value block for the right half's six figures — label and value both
 *  hug the block's own right edge, so each one reads as a single right-anchored unit. */
function Block({
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
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-right text-[10.5px] uppercase tracking-[0.06em] text-muted">{label}</span>
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
  const recentWindowCandidates = copyVariants('liveEarningsRecentWindowLabel').map((template) =>
    sub(template, { minutes: MAX_COVERAGE_MINUTES }),
  );
  const goldUnitCandidates = copyVariants('liveEarningsGoldHeadlineUnit');
  const xpUnitCandidates = copyVariants('liveEarningsXpHeadlineUnit');

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
  const currentGoldValue: ReactNode = numberText(balance);
  // The age reservation only ever has something to hold once there is a balance to attach it to —
  // with no balance the value already reads an em dash, and an age beside it would pin a
  // fabricated reading to a figure that isn't there.
  const currentGoldAgeReserve = balance !== null ? currentGoldAgeLongest : '';
  const currentGoldAgeShown = balance !== null ? (currentGoldAgeText ?? '') : '';

  return (
    <Panel data-testid="live-earnings" aria-label={t.liveEarningsTitle}>
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-stretch gap-6">
          <div className="flex flex-col items-end gap-1.5 border-r border-line/55 pr-6">
            <ReservedLine
              candidates={recentWindowCandidates}
              testId="live-earnings-recent-window-label"
              text={recentWindowText}
              className="relative grid text-right text-[10.5px] text-muted tabular-nums whitespace-nowrap"
            />
            <span data-testid="live-earnings-gold-10" className="text-[38px] font-bold leading-none text-gold tabular-nums whitespace-nowrap">
              {numberText(earnings?.gold10)}
            </span>
            <ReservedLine
              candidates={goldUnitCandidates}
              testId="live-earnings-gold-10-unit"
              text={t.liveEarningsGoldHeadlineUnit}
              className="relative grid text-right text-[10.5px] text-muted tabular-nums whitespace-nowrap"
            />
            <span
              data-testid="live-earnings-xp-10"
              className="text-[19px] font-bold leading-none text-info tabular-nums whitespace-nowrap"
            >
              {numberText(earnings?.xp10)}
            </span>
            <span className="relative grid text-right text-[10.5px] text-muted tabular-nums whitespace-nowrap">
              {xpUnitCandidates.map((candidate, index) => (
                <span key={index} aria-hidden className="invisible col-start-1 row-start-1">
                  {candidate}
                </span>
              ))}
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger
                    type="button"
                    data-testid="live-earnings-xp-help-trigger"
                    aria-label={`${t.liveEarningsXpHeadlineUnit}: ${t.liveEarningsXpHelpBody}`}
                    className="col-start-1 row-start-1 w-full border-0 bg-transparent p-0 text-right text-muted text-[10.5px] font-normal underline decoration-dotted underline-offset-2 cursor-help hover:text-ink focus-visible:rounded-sm focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">
                {t.liveEarningsCurrentGoldLabel}
              </span>
              <span className="flex items-baseline gap-1 whitespace-nowrap">
                <span data-testid="live-earnings-gold-current" className="text-[23px] font-bold text-gold tabular-nums">
                  {currentGoldValue}
                </span>
                <span className="relative grid text-[10.5px] leading-none text-muted tabular-nums">
                  <span aria-hidden className="invisible col-start-1 row-start-1">
                    {currentGoldAgeReserve || ' '}
                  </span>
                  <span data-testid="live-earnings-gold-current-age" className="col-start-1 row-start-1">
                    {currentGoldAgeShown}
                  </span>
                </span>
              </span>
            </div>
            <Block
              testId="live-earnings-gold-session"
              label={t.liveEarningsGoldSessionLabel}
              value={numberText(earnings?.goldSession)}
              className="text-[23px] font-bold text-gold/70 tabular-nums whitespace-nowrap"
            />
            <Block
              testId="live-earnings-gold-session-total"
              label={t.liveEarningsGoldSessionTotalLabel}
              value={numberText(earnings?.goldSessionTotal)}
              className="text-[23px] font-bold text-gold tabular-nums whitespace-nowrap"
            />
            <Block
              testId="live-earnings-elapsed"
              label={t.liveEarningsElapsedLabel}
              value={formatLiveDurationSeconds(sessionSeconds)}
              className="text-[23px] font-bold text-ink tabular-nums whitespace-nowrap"
            />
            <Block
              testId="live-earnings-xp-session"
              label={t.liveEarningsXpSessionLabel}
              value={numberText(earnings?.xpSession)}
              className="text-[23px] font-bold text-info/70 tabular-nums whitespace-nowrap"
            />
            <Block
              testId="live-earnings-xp-session-total"
              label={t.liveEarningsXpSessionTotalLabel}
              value={numberText(earnings?.xpSessionTotal)}
              className="text-[23px] font-bold text-info tabular-nums whitespace-nowrap"
            />
          </div>
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
    </Panel>
  );
}
