import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Slider chrome — Base UI Root/Control/Track/Indicator/Thumb dressed with
 * planner tokens. Mirrors `switch.recipe.ts`'s idiom (transition var,
 * `data-*` state hooks from Base UI, no reimplemented interaction).
 */

const transition = 'motion-safe:transition-[background-color,border-color] motion-safe:duration-[140ms] motion-safe:ease-out';

export const sliderWrapperClass = 'flex min-w-0 flex-col gap-1.5';
export const sliderLabelRowClass = 'flex items-baseline justify-between gap-2';
export const sliderLabelClass = 'text-[13px] font-medium text-ink';
export const sliderValueClass = 'text-xs tabular-nums text-muted';

export const sliderRootRecipe = cva('relative flex w-full touch-none select-none items-center data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40', {
  variants: {
    size: {
      default: 'py-1.5',
    },
  },
  defaultVariants: { size: 'default' },
});

export type SliderSize = NonNullable<VariantProps<typeof sliderRootRecipe>['size']>;

export const sliderControlClass = 'relative flex h-4 w-full items-center';

export const sliderTrackClass = `relative h-1.5 w-full grow overflow-hidden rounded-full bg-bg-2 border border-line ${transition}`;

export const sliderIndicatorClass = `absolute h-full rounded-full bg-accent ${transition}`;

export const sliderThumbClass = `block size-4 shrink-0 rounded-full border-2 border-accent bg-surface shadow-sm outline-none ${transition} focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklch,var(--accent)_45%,transparent)] data-[dragging]:scale-110`;
