import type { ReactNode } from 'react';
import type { LiveEarnings } from '@bombfarm/contracts';
import { formatCompactNumber, Icon, Panel, Tooltip } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { formatCapturedAt } from '../../lib/format';
import type { ReachedLiveFreshness } from './freshness-line';
import { formatLiveDurationSeconds } from './format-live-duration';

const EM_DASH = '—';
const MAX_COVERAGE_MINUTES = 10;
/** Keeps the age line's invisible sizer a non-empty inline box on the five blocks that never
 *  carry a real age, so every block's third line renders at the same height as current gold's. */
const AGE_LINE_RESERVE_FALLBACK = ' ';

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

/** Right-aligned label/value/age block for the right half's six figures. Every block reserves the
 *  same three lines — label, value, age — so all six stay the same fixed width (the label's own
 *  box, not just the column) and the same height whether or not that block ever has an age to
 *  show. Only current gold ever passes a real `ageTestId`/`ageReserve`/`ageShown`; the rest keep
 *  the third line's height without claiming a reading they don't have. */
function Block({
  blockTestId,
  testId,
  label,
  value,
  className,
  ageTestId,
  ageReserve,
  ageShown,
}: {
  blockTestId: string;
  testId: string;
  label: ReactNode;
  value: ReactNode;
  className: string;
  ageTestId?: string;
  ageReserve?: string;
  ageShown?: ReactNode;
}) {
  return (
    <div data-testid={blockTestId} className="flex flex-col items-end gap-0.5">
      <span className="block w-full text-right text-[10.5px] uppercase leading-none tracking-[0.06em] text-muted whitespace-nowrap">
        {label}
      </span>
      <span data-testid={testId} className={className}>
        {value}
      </span>
      <span className="relative grid text-right text-[10.5px] leading-none text-muted tabular-nums whitespace-nowrap">
        <span aria-hidden className="invisible col-start-1 row-start-1">
          {ageReserve || AGE_LINE_RESERVE_FALLBACK}
        </span>
        <span data-testid={ageTestId} className="col-start-1 row-start-1">
          {ageShown ?? ''}
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
          {/* Fixed at its widest content rather than sized to whichever child is currently
              longest — measured against the real rendered font: the gold figure's widest
              realistic compact form ("999.9m") at its own 38px bold came out widest at ~139.4px,
              ahead of that same form at the XP figure's 19px, the coverage label's longest form
              in either language ("últimos 10 min"), and both unit strings in either language.
              140px (8.75rem) covers it, so neither a changing figure nor a language switch can
              move the divider after it. */}
          <div
            data-testid="live-earnings-headline-column"
            className="flex w-[8.75rem] shrink-0 flex-col items-end gap-1.5 border-r border-line/55 pr-6"
          >
            <span
              data-testid="live-earnings-recent-window-label"
              className="text-right text-[10.5px] text-muted tabular-nums whitespace-nowrap"
            >
              {recentWindowText}
            </span>
            <span data-testid="live-earnings-gold-10" className="text-[38px] font-bold leading-none text-gold tabular-nums whitespace-nowrap">
              {numberText(earnings?.gold10)}
            </span>
            <span
              data-testid="live-earnings-gold-10-unit"
              className="text-right text-[10.5px] text-muted tabular-nums whitespace-nowrap"
            >
              {t.liveEarningsGoldHeadlineUnit}
            </span>
            <span
              data-testid="live-earnings-xp-10"
              className="text-[19px] font-bold leading-none text-info tabular-nums whitespace-nowrap"
            >
              {numberText(earnings?.xp10)}
            </span>
            <Tooltip.Provider>
              <Tooltip.Root>
                <Tooltip.Trigger
                  type="button"
                  data-testid="live-earnings-xp-help-trigger"
                  aria-label={`${t.liveEarningsXpHeadlineUnit}: ${t.liveEarningsXpHelpBody}`}
                  className="block w-full border-0 bg-transparent p-0 text-right text-muted text-[10.5px] font-normal underline decoration-dotted underline-offset-2 cursor-help hover:text-ink focus-visible:rounded-sm focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
          </div>
          <div className="grid grid-cols-[repeat(3,7rem)] gap-x-4 gap-y-3">
            <Block
              blockTestId="live-earnings-block-current-gold"
              testId="live-earnings-gold-current"
              label={t.liveEarningsCurrentGoldLabel}
              value={currentGoldValue}
              className="text-[23px] font-bold text-gold tabular-nums whitespace-nowrap"
              ageTestId="live-earnings-gold-current-age"
              ageReserve={currentGoldAgeReserve}
              ageShown={currentGoldAgeShown}
            />
            <Block
              blockTestId="live-earnings-block-gold-rate"
              testId="live-earnings-gold-session"
              label={t.liveEarningsGoldSessionLabel}
              value={numberText(earnings?.goldSession)}
              className="text-[23px] font-bold text-gold/70 tabular-nums whitespace-nowrap"
            />
            <Block
              blockTestId="live-earnings-block-gold-total"
              testId="live-earnings-gold-session-total"
              label={t.liveEarningsGoldSessionTotalLabel}
              value={numberText(earnings?.goldSessionTotal)}
              className="text-[23px] font-bold text-gold tabular-nums whitespace-nowrap"
            />
            <Block
              blockTestId="live-earnings-block-elapsed"
              testId="live-earnings-elapsed"
              label={t.liveEarningsElapsedLabel}
              value={formatLiveDurationSeconds(sessionSeconds)}
              className="text-[23px] font-bold text-ink tabular-nums whitespace-nowrap"
            />
            <Block
              blockTestId="live-earnings-block-xp-rate"
              testId="live-earnings-xp-session"
              label={t.liveEarningsXpSessionLabel}
              value={numberText(earnings?.xpSession)}
              className="text-[23px] font-bold text-info/70 tabular-nums whitespace-nowrap"
            />
            <Block
              blockTestId="live-earnings-block-xp-total"
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
