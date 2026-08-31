import { memo, type ReactNode } from 'react';
import type { AppLocale, LiveEarnings } from '@bombfarm/contracts';
import { formatCompactNumber, Icon, Panel, Sparkline, Tooltip, type Lang } from '@bombfarm/ui';
import { sub, useCopy, useLocale, type Copy } from '../../lib/copy';
import { formatCapturedAt, formatCount } from '../../lib/format';
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

function numberText(value: number | null | undefined, lang: Lang): ReactNode {
  return value == null ? EM_DASH : formatCompactNumber(value, lang, 1);
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

/**
 * The unit under the XP headline, and what it means. Nothing here depends on a figure — only on
 * the language — so it is memoised: the panel around it re-renders four times a second as gold and
 * XP move, and rebuilding a Base UI tooltip (provider, root, trigger, portal, positioner, popup)
 * that many times a second to draw the same word is the largest single piece of work this panel
 * was repeating for no reason.
 */
const XpHeadlineHelp = memo(function XpHeadlineHelp({ t }: { t: Copy }) {
  return (
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
  );
});

/**
 * Marks the three figures below it as measured, against the map panel's own "Estimated" note in
 * the same position one panel over. The two rows sit at the same height and print the same kind of
 * per-prop figure, so which of them is a reading and which is a model has to be legible without
 * opening either tooltip.
 */
const MeasuredNote = memo(function MeasuredNote({ t }: { t: Copy }) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          data-testid="live-earnings-measured-trigger"
          aria-label={`${t.liveEarningsMeasuredNote}: ${t.liveEarningsMeasuredBody}`}
          className="self-start border-0 bg-transparent p-0 text-[10.5px] uppercase tracking-[0.06em] text-muted underline decoration-dotted underline-offset-2 cursor-help hover:text-ink focus-visible:rounded-sm focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t.liveEarningsMeasuredNote}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6}>
            <Tooltip.Popup>
              <p className="m-0" data-testid="live-earnings-measured-body">
                {t.liveEarningsMeasuredBody}
              </p>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
});

/** The footnote sits on its own line rather than beside the value, and the line is reserved whether
 *  or not there is one: its longest Portuguese form is wider than the English one, and inline it
 *  would push this panel's intrinsic width past the point where the Live tab's two-panel row still
 *  fits the narrowest window the app allows. */
function MeasuredFigure({
  testId,
  label,
  value,
  footnote,
  className,
}: {
  testId: string;
  label: string;
  value: ReactNode;
  footnote?: ReactNode;
  className: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">{label}</span>
      <span data-testid={testId} className={className}>
        {value}
      </span>
      <span className="min-h-[11px] text-[11px] leading-none">{footnote}</span>
    </div>
  );
}

/** A deviation small enough to round away is reported as agreement rather than as a signed zero —
 *  "0% under estimate" claims a direction the rounding just erased. */
function goldPerPropFootnote(delta: number, t: Copy): { text: string; tone: string } {
  const percent = Math.round(Math.abs(delta) * 100);
  if (percent === 0) return { text: t.liveEarningsGoldPerPropOnEstimate, tone: 'text-muted' };
  return delta < 0
    ? { text: sub(t.liveEarningsGoldPerPropUnder, { percent }), tone: 'text-down' }
    : { text: sub(t.liveEarningsGoldPerPropOver, { percent }), tone: 'text-up' };
}

/**
 * The measured counterpart to the map panel's three estimates, in the same shape and at the same
 * height one panel over. Only gold-per-prop is a genuine overlap: a measured xp-per-prop would just
 * be the map's own estimate multiplied by the boost, because that is exactly how the XP figure is
 * derived in the first place, and nothing counts map completions for a gold-per-clear to divide by.
 * Props per minute and the session's prop count take the other two places instead.
 */
function MeasuredRow({
  earnings,
  goldPerPropDelta,
  t,
  lang,
  locale,
}: {
  earnings: LiveEarnings | null;
  goldPerPropDelta: number | null;
  t: Copy;
  lang: Lang;
  locale: AppLocale;
}) {
  const goldPerProp = earnings?.goldPerProp10 ?? null;
  // Gated on the figure it annotates, never on the delta alone: a comparison printed beside a dash
  // is a claim about a number that is not there.
  const footnote = goldPerProp !== null && goldPerPropDelta !== null ? goldPerPropFootnote(goldPerPropDelta, t) : null;

  return (
    <div data-testid="live-earnings-measured" className="flex flex-col gap-2 border-t border-line/55 pt-3">
      <MeasuredNote t={t} />
      <div className="grid grid-cols-3 gap-3">
        <MeasuredFigure
          testId="live-earnings-gold-per-prop"
          label={t.liveEarningsGoldPerPropLabel}
          value={goldPerProp === null ? EM_DASH : formatCompactNumber(goldPerProp, lang)}
          footnote={
            footnote === null ? undefined : (
              <span data-testid="live-earnings-gold-per-prop-delta" className={footnote.tone}>
                {footnote.text}
              </span>
            )
          }
          className="text-[15px] font-bold tabular-nums text-gold"
        />
        <MeasuredFigure
          testId="live-earnings-props-per-minute"
          label={t.liveEarningsPropsPerMinuteLabel}
          value={earnings?.propsPerMinute10 == null ? EM_DASH : formatCount(earnings.propsPerMinute10, locale)}
          className="text-[15px] font-bold tabular-nums text-ink"
        />
        <MeasuredFigure
          testId="live-earnings-props-total"
          label={t.liveEarningsPropsTotalLabel}
          value={earnings?.propsSessionTotal == null ? EM_DASH : formatCount(earnings.propsSessionTotal, locale)}
          className="text-[15px] font-bold tabular-nums text-ink"
        />
      </div>
    </div>
  );
}

/** The peak is printed rather than drawn as a rule across the chart: the line's own top edge
 *  already is the peak, and the number is what says how much that height is worth. */
function TrendBlock({
  series,
  minutes,
  lang,
  t,
}: {
  series: readonly (number | null)[];
  minutes: number;
  lang: Lang;
  t: Copy;
}) {
  const readings = series.filter((value): value is number => value !== null);
  const peak = readings.length === 0 ? null : Math.max(...readings);

  return (
    <div data-testid="live-earnings-trend" className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">
          {sub(t.liveEarningsSeriesLabel, { minutes })}
        </span>
        {peak === null ? null : (
          <span
            data-testid="live-earnings-trend-peak"
            className="text-[10.5px] text-muted tabular-nums whitespace-nowrap"
          >
            {sub(t.liveEarningsSeriesPeakLabel, { value: formatCompactNumber(peak, lang) })}
          </span>
        )}
      </div>
      <Sparkline
        values={series}
        ariaLabel={sub(t.liveEarningsSeriesAria, { minutes })}
        height={44}
        className="text-gold"
      />
    </div>
  );
}

export function EarningsPanel({
  freshness,
  earnings,
  goldPerPropDelta = null,
  onReset,
}: {
  freshness: ReachedLiveFreshness;
  earnings: LiveEarnings | null;
  /** The measured gold-per-prop's signed deviation from the map panel's estimate for the map being
   *  played, as a fraction. Computed by the caller, the one place holding both panels' data. */
  goldPerPropDelta?: number | null;
  onReset: () => void;
}) {
  const t = useCopy();
  const { lang, locale } = useLocale();

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
      <span className={currentGoldIsStale ? 'text-muted' : 'text-gold'}>{numberText(balance, lang)}</span>
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
      <div className="flex flex-col gap-4">
        <div className="flex items-stretch gap-5 pr-7">
          {/* Fixed at its widest content rather than sized to whichever child is currently
              longest — measured against the real rendered font, `box-sizing: border-box` means
              this width is the WHOLE box, so the border and `pr-6` padding come out of it before
              any text fits. The gold figure's widest realistic compact form is "999.9m", not the
              one-longer "999.9bi" the formatter can also reach — a variable-font "m" measures
              wider than "bi" together in this typeface, so the extra digit-string length loses to
              the wider single glyph it replaces. At 28px bold that form measures ~102.8px; with a
              ~4px cross-platform rendering margin the column needs ~107px of content, plus the 1px
              border and the 20px of `pr-5` padding: 107 + 1 + 20 = 128px (8rem), 12px narrower
              than the old (undersized) 140px box. Every other line in the column — the XP figure
              at 19px, the coverage label's longest form in either language ("últimos 10 min"), and
              both unit strings — measures well under that. */}
          <div
            data-testid="live-earnings-headline-column"
            className="flex w-[8rem] shrink-0 flex-col items-end gap-1.5 border-r border-line/55 pr-5"
          >
            <span
              data-testid="live-earnings-recent-window-label"
              className="text-right text-[10.5px] text-muted tabular-nums whitespace-nowrap"
            >
              {recentWindowText}
            </span>
            <span data-testid="live-earnings-gold-10" className="text-[28px] font-bold leading-none text-gold tabular-nums whitespace-nowrap">
              {numberText(earnings?.gold10, lang)}
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
              {numberText(earnings?.xp10, lang)}
            </span>
            <XpHeadlineHelp t={t} />
          </div>
          <div className="grid grid-cols-[repeat(3,7rem)] gap-x-3 gap-y-3">
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
              value={numberText(earnings?.goldSession, lang)}
              className="text-[23px] font-bold text-gold/70 tabular-nums whitespace-nowrap"
            />
            <Block
              blockTestId="live-earnings-block-gold-total"
              testId="live-earnings-gold-session-total"
              label={t.liveEarningsGoldSessionTotalLabel}
              value={numberText(earnings?.goldSessionTotal, lang)}
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
              value={numberText(earnings?.xpSession, lang)}
              className="text-[23px] font-bold text-info/70 tabular-nums whitespace-nowrap"
            />
            <Block
              blockTestId="live-earnings-block-xp-total"
              testId="live-earnings-xp-session-total"
              label={t.liveEarningsXpSessionTotalLabel}
              value={numberText(earnings?.xpSessionTotal, lang)}
              className="text-[23px] font-bold text-info tabular-nums whitespace-nowrap"
            />
          </div>
        </div>
        <TrendBlock series={earnings?.gold10Series ?? []} minutes={minutes} lang={lang} t={t} />
        <MeasuredRow earnings={earnings} goldPerPropDelta={goldPerPropDelta} t={t} lang={lang} locale={locale} />
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
