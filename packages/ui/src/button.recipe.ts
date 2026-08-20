import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Button variant table — parity with the former `button-chrome.ts` string exports.
 * Each variant emits its full class string (empty base) so the differing bases
 * (btn / text / icon / coffee) and the historic help-size overrides are preserved
 * byte-for-byte. Conflict-safe caller overrides come from `cn()` at the primitive.
 */
const transition =
  'motion-safe:transition-[border-color,background-color] motion-safe:duration-[120ms] motion-safe:ease-out';

const btnBase = `cursor-pointer rounded-sm border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${transition}`;

export const buttonRecipe = cva('', {
  variants: {
    variant: {
      default: `${btnBase} border-line bg-bg-2 hover:border-accent`,
      primary: `${btnBase} border-accent bg-accent text-accent-ink hover:border-accent`,
      ghost: `${btnBase} border-line bg-transparent hover:border-accent`,
      help: `${btnBase} min-w-[30px] rounded-full border-line bg-bg-2 px-0 py-1.5 text-center font-bold hover:border-accent`,
      'help-on': `${btnBase} min-w-[30px] rounded-full border-accent bg-bg-2 px-0 py-1.5 text-center font-bold text-accent hover:border-accent`,
      text: 'cursor-pointer border-0 bg-transparent p-0 text-[11px] tracking-[0.04em] text-muted uppercase hover:text-accent',
      icon: 'inline-grid size-5 shrink-0 cursor-pointer place-items-center rounded-sm border-0 bg-transparent p-0 text-muted hover:bg-[color-mix(in_oklch,var(--down)_12%,transparent)] hover:text-down',
      // Permanent brand exception — Ko-fi hex + sizing in globals `.btn.coffee` (AD-003).
      coffee: 'btn coffee',
      'coffee-full': 'btn coffee full',
    },
  },
  defaultVariants: { variant: 'default' },
});

export type ButtonVariant = NonNullable<VariantProps<typeof buttonRecipe>['variant']>;
