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

/** The rolling window is capped at 600s (10 real minutes) and starts shorter — floored, not
 *  rounded up, so the label never claims more coverage than the figures actually rest on. */
function coverageMinutesLabel(coverageSeconds: number): number {
  return Math.min(MAX_COVERAGE_MINUTES, Math.max(1, Math.floor(coverageSeconds / 60)));
}

function numberText(value: number | null | undefined): ReactNode {
  return value == null ? EM_DASH : formatCompactNumber(value, 1);
}

/** Right-aligned label/value block for the right half's six figures. Every block reserves the
 *  same two lines — label, value — so all six stay the same fixed width (the label's own box, not
 *  just the column) and the same height as each other, with no third line reserved for an age
 *  none but current gold ever has. Current gold's own staleness signal lives inside its own
 *  `value`, not as a block-level concern. */
function Block({
  blockTestId,
  testId,
  label,
  value,
  className,
}: {
  blockTestId: string;
  testId: string;
  label: ReactNode;
  value: ReactNode;
  className: string;
}) {
  return (
    <div data-testid={blockTestId} className="flex flex-col items-end gap-0.5">
      <span className="block w-full text-right text-[10.5px] uppercase leading-none tracking-[0.06em] text-muted whitespace-nowrap">
        {label}
      </span>
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
  // A dash carries nothing to be stale about — gating on `balance` keeps the marker dark rather
  // than pinning a fabricated reading beside a figure that isn't there.
  const currentGoldIsStale = balance !== null && currentGoldAgeText !== null;
  const currentGoldValue: ReactNode = (
    <>
      <span className={currentGoldIsStale ? 'text-muted' : 'text-gold'}>{numberText(balance)}</span>
      <Tooltip.Provider>
        <Tooltip.Root>
          {currentGoldIsStale ? (
            <Tooltip.Trigger
              type="button"
              data-testid="live-earnings-gold-current-age-trigger"
              aria-label={`${t.liveEarningsCurrentGoldLabel}: ${currentGoldAgeText}`}
              className="inline-flex items-center border-0 bg-transparent p-0 text-muted cursor-help hover:text-ink focus-visible:rounded-sm focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Icon name="information-circle" size="xs" />
            </Tooltip.Trigger>
          ) : (
            <Tooltip.Trigger
              type="button"
              data-testid="live-earnings-gold-current-age-trigger"
              aria-label={`${t.liveEarningsCurrentGoldLabel}: ${currentGoldAgeText ?? ''}`}
              className="invisible inline-flex items-center border-0 bg-transparent p-0 text-muted"
            >
              <Icon name="information-circle" size="xs" />
            </Tooltip.Trigger>
          )}
          <Tooltip.Portal>
            <Tooltip.Positioner sideOffset={6}>
              <Tooltip.Popup>
                <p className="m-0" data-testid="live-earnings-gold-current-age">
                  {currentGoldAgeText ?? ''}
                </p>
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    </>
  );

  return (
    <Panel data-testid="live-earnings" aria-label={t.liveEarningsTitle} className="relative min-w-0">
      <div className="flex items-stretch gap-6 pr-8">
        {/* Fixed at its widest content rather than sized to whichever child is currently
            longest — measured against the real rendered font, `box-sizing: border-box` means
            this width is the WHOLE box, so the border and `pr-6` padding come out of it before
            any text fits. The gold figure's widest realistic compact form is "999.9m", not the
            one-longer "999.9bi" the formatter can also reach — a variable-font "m" measures
            wider than "bi" together in this typeface, so the extra digit-string length loses to
            the wider single glyph it replaces. At 28px bold that form measures ~102.8px; with a
            ~4px cross-platform rendering margin the column needs ~107px of content, plus the 1px
            border and the 24px of `pr-6` padding: 107 + 1 + 24 = 132px (8.25rem), 8px narrower
            than the old (undersized) 140px box. Every other line in the column — the XP figure
            at 19px, the coverage label's longest form in either language ("últimos 10 min"), and
            both unit strings — measures well under that. */}
        <div
          data-testid="live-earnings-headline-column"
          className="flex w-[8.25rem] shrink-0 flex-col items-end gap-1.5 border-r border-line/55 pr-6"
        >
          <span
            data-testid="live-earnings-recent-window-label"
            className="text-right text-[10.5px] text-muted tabular-nums whitespace-nowrap"
          >
            {recentWindowText}
          </span>
          <span data-testid="live-earnings-gold-10" className="text-[28px] font-bold leading-none text-gold tabular-nums whitespace-nowrap">
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
            className="inline-flex items-center gap-1 text-[23px] font-bold tabular-nums whitespace-nowrap"
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
        className="absolute right-2 top-2 grid place-items-center rounded-sm border-0 bg-transparent p-0 text-muted transition-colors hover:text-ink focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Icon name="arrow-path" size="md" />
      </button>
    </Panel>
  );
}
