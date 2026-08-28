import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Accordion / Collapsible shared trigger chrome. One recipe serves
 * both the `ExplainSection` uppercase-accent header look (`tone: 'section'`,
 * absorbing the former section-summary chrome from `panel-field.recipe.ts`)
 * and the compact per-row stat-breakdown trigger the sibling
 * `effective-stats-breakdown` feature needs (`tone: 'row'`). Chevron
 * rotation is bound to the trigger's own
 * `data-panel-open` attribute via a descendant selector — no `group` needed.
 *
 * Fixed layout bundles (no real variants) are documented recipe constants —
 * imported directly from this module, not re-exported from the
 * barrel.
 */

export const accordionRecipe = cva(
  'flex w-full cursor-pointer select-none outline-none [&[data-panel-open]_[data-accordion-icon]]:rotate-180 focus-visible:border-accent',
  {
    variants: {
      tone: {
        section:
          'items-center gap-2.5 border border-line bg-surface px-4 py-3 text-[13px] font-bold tracking-[0.04em] text-accent uppercase',
        /** Stat-breakdown strip: accent rail + tinted surface so rows read as interactive ledgers, not plain muted list text. */
        row: [
          'items-center justify-between gap-3 rounded-sm border border-[color-mix(in_oklch,var(--accent)_28%,var(--line))]',
          'border-l-[3px] border-l-accent',
          'bg-[color-mix(in_oklch,var(--accent)_9%,var(--bg))]',
          'px-2.5 py-1.5 text-left text-[12px] text-ink',
          'data-[panel-open]:border-accent',
          'data-[panel-open]:bg-[color-mix(in_oklch,var(--accent)_16%,var(--bg-2))]',
          'data-[panel-open]:shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--accent)_35%,transparent)]',
        ].join(' '),
        /** Panel-card header trigger: title-only chrome, no border/bg of its own — the card chrome lives on `Panel`. */
        panel:
          'w-auto items-center gap-1.5 text-[13px] font-bold tracking-[0.04em] uppercase hover:text-accent',
      },
      size: {
        default: '',
        compact: 'py-1.5 text-[12px]',
      },
    },
    defaultVariants: { tone: 'section', size: 'default' },
  },
);

export type AccordionVariant = VariantProps<typeof accordionRecipe>;
export type AccordionTone = NonNullable<AccordionVariant['tone']>;
export type AccordionSize = NonNullable<AccordionVariant['size']>;

/** Accordion item wrapper — defensive `min-w-0` so long row content wraps instead of overflowing a flex ancestor. */
export const accordionItemClass = 'min-w-0';

/** Stack of breakdown rows — slight gap so each accent-rail strip reads as its own chip. */
export const accordionStackClass = 'flex flex-col gap-1';

/** Expanded ledger/formula body under a row trigger — continuation of the accent strip. */
export const accordionLedgerBodyClass =
  'border border-t-0 border-[color-mix(in_oklch,var(--accent)_28%,var(--line))] border-l-[3px] border-l-accent bg-[color-mix(in_oklch,var(--accent)_6%,var(--bg-2))] px-2.5 py-2';

/** Consumer-supplied panel body padding (kept off the animated panel itself, spec A8). */
export const accordionBodyClass = 'w-full p-4';

/** Fixed chevron icon slot — `shrink-0` fixed size so it never causes header reflow; rotation keyed on the trigger's `data-panel-open` (see `accordionRecipe`). */
export const accordionIconClass =
  'shrink-0 size-4 text-accent motion-safe:transition-transform motion-safe:duration-150 motion-reduce:transition-none';
