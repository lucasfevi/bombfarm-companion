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
      // m2-storybook-ci (T7): plain `text-warn` on `bg-surface` measured
      // 3.31:1 (OKLCH -> linear-sRGB -> WCAG relative luminance), below the 4.5:1
      // AA floor for this 10px text. Lightened via `color-mix` toward white (still
      // driven by the `--warn` token, not a hardcoded literal, per design
      // system rules) rather than changing the shared `--color-warn` custom
      // property, which borders/icons elsewhere also read and which isn't in this
      // feature's scope. 20% white measures 4.80:1.
      'small-warn': `${chipSmallBase} border-warn bg-surface text-[color-mix(in_oklch,var(--warn)_80%,white_20%)]`,
      // m2-shell-status (2026-08-11): additive tone for StatusChip's `not_running`
      // state — no game-connection tone maps to any of the five variants above.
      'small-muted': `${chipSmallBase} border-line bg-surface text-muted`,
    },
  },
  defaultVariants: { variant: 'default' },
});

export type ChipVariant = NonNullable<VariantProps<typeof chipRecipe>['variant']>;
