import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Chip variant table — parity with the former `control-chrome.ts` chip exports
 * (`chipClass` / `chipOnClass` / `chipSmallClass` / `chipSmallWarnClass`).
 * Small chips use a different base, so each variant emits its full class string.
 */
const chipBase =
  'cursor-pointer rounded-full border px-2.5 py-1 text-xs motion-safe:transition-[border-color,background-color] motion-safe:duration-[120ms]';
const chipSmallBase = 'ml-1.5 cursor-default rounded-full border px-1.5 py-0.5 text-[10px]';

export const chipRecipe = cva('', {
  variants: {
    variant: {
      default: `${chipBase} border-line bg-surface`,
      on: `${chipBase} border-accent bg-[color-mix(in_oklch,var(--accent)_16%,var(--surface))]`,
      small: `${chipSmallBase} border-line bg-surface`,
      'small-active': `${chipSmallBase} border-up bg-[color-mix(in_oklch,var(--up)_14%,var(--surface))] text-up`,
      'small-warn': `${chipSmallBase} border-warn bg-surface text-warn`,
      // m2-shell-status (2026-08-11): additive tone for StatusChip's `not_running`
      // state — no game-connection tone maps to any of the five variants above.
      'small-muted': `${chipSmallBase} border-line bg-surface text-muted`,
    },
  },
  defaultVariants: { variant: 'default' },
});

export type ChipVariant = NonNullable<VariantProps<typeof chipRecipe>['variant']>;
