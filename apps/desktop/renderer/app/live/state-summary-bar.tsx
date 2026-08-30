import { Fragment, type ReactNode } from 'react';
import { Tooltip } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';

/**
 * Folds the tooltip's extra readings into the trigger's own accessible name, the same way the
 * earnings panel's XP trigger does — a screen-reader user who never opens the popup still gets the
 * hint. Joined with an em dash rather than a copy-layer template: every part is already translated
 * text (or a formatted number); this only decides how they're strung together.
 */
function combineAriaLabel(primary: string, extras: readonly (string | undefined)[]): string {
  const extraText = extras.filter((part): part is string => Boolean(part)).join(' — ');
  return extraText.length > 0 ? `${primary} — ${extraText}` : primary;
}

/**
 * One count, optionally a hover/focus tooltip. The plain-span and tooltip-trigger branches each
 * own their own literal `className` (the untranslated-prose guard only tolerates a Tailwind
 * string written directly at the JSX call site), so a caller with nothing extra to say never pays
 * for the button/tooltip machinery.
 */
function StatBadge({
  testId,
  ariaLabel,
  tooltip,
  children,
}: {
  testId: string;
  ariaLabel?: string;
  tooltip?: ReactNode;
  children: ReactNode;
}) {
  if (tooltip === undefined) {
    return (
      <span data-testid={testId} className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.04em] uppercase">
        {children}
      </span>
    );
  }

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          data-testid={testId}
          aria-label={ariaLabel}
          className="inline-flex cursor-help items-center gap-1.5 border-0 bg-transparent p-0 text-[11px] font-bold tracking-[0.04em] uppercase underline decoration-dotted underline-offset-2 hover:text-ink focus-visible:rounded-sm focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {children}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6}>
            <Tooltip.Popup>{tooltip}</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/**
 * One row of rotation-state counts, replacing the four section headings it used to take to show
 * the same thing. Each count's colour is the row list's own legend — a hero row's state dot below
 * matches the colour of the count it belongs to. The slots hints and the resting facts used to
 * head their own section; they're read once and then ignored, so they move into a tooltip on the
 * count they describe instead of holding permanent space open.
 */
export function StateSummaryBar({
  onFieldCount,
  onFieldHint,
  recoveringCount,
  recoveringHint,
  recoveringFacts,
  queuedCount,
  benchedCount,
}: {
  onFieldCount: string;
  onFieldHint?: string;
  recoveringCount: string;
  recoveringHint?: string;
  recoveringFacts: readonly string[];
  queuedCount: string;
  benchedCount: string;
}) {
  const t = useCopy();

  const onFieldTooltip =
    onFieldHint !== undefined ? (
      <p data-testid="live-state-summary-on-field-hint" className="m-0">
        {onFieldHint}
      </p>
    ) : undefined;

  const hasRecoveringExtras = recoveringHint !== undefined || recoveringFacts.length > 0;
  const recoveringTooltip = hasRecoveringExtras ? (
    <div className="flex flex-col gap-1">
      {recoveringFacts.length > 0 ? (
        <p data-testid="live-state-summary-recovering-facts" className="m-0 flex flex-wrap items-baseline gap-x-1.5">
          {recoveringFacts.map((fact, index) => (
            <Fragment key={fact}>
              {index > 0 ? <span aria-hidden>·</span> : null}
              <span>{fact}</span>
            </Fragment>
          ))}
        </p>
      ) : null}
      {recoveringHint !== undefined ? (
        <p data-testid="live-state-summary-recovering-hint" className="m-0">
          {recoveringHint}
        </p>
      ) : null}
    </div>
  ) : undefined;

  return (
    <div data-testid="live-state-summary" className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <StatBadge
        testId="live-state-summary-on-field"
        ariaLabel={
          onFieldHint !== undefined ? combineAriaLabel(`${t.liveListOnFieldTitle} ${onFieldCount}`, [onFieldHint]) : undefined
        }
        tooltip={onFieldTooltip}
      >
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-up" />
        <span>{t.liveListOnFieldTitle}</span>
        <span data-testid="live-state-summary-on-field-count" className="tabular-nums text-up">
          {onFieldCount}
        </span>
      </StatBadge>
      <StatBadge
        testId="live-state-summary-recovering"
        ariaLabel={
          hasRecoveringExtras
            ? combineAriaLabel(`${t.liveListRecoveringTitle} ${recoveringCount}`, [...recoveringFacts, recoveringHint])
            : undefined
        }
        tooltip={recoveringTooltip}
      >
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-info" />
        <span>{t.liveListRecoveringTitle}</span>
        <span data-testid="live-state-summary-recovering-count" className="tabular-nums text-info">
          {recoveringCount}
        </span>
      </StatBadge>
      <StatBadge testId="live-state-summary-queued">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-warn" />
        <span>{t.liveListQueuedTitle}</span>
        <span data-testid="live-state-summary-queued-count" className="tabular-nums text-warn">
          {queuedCount}
        </span>
      </StatBadge>
      <StatBadge testId="live-state-summary-benched">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-muted" />
        <span>{t.liveListBenchedTitle}</span>
        <span data-testid="live-state-summary-benched-count" className="tabular-nums text-muted">
          {benchedCount}
        </span>
      </StatBadge>
    </div>
  );
}
