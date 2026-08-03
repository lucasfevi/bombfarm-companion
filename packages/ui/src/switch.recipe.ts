import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Switch chrome — Base UI Root + Thumb dressed with planner tokens.
 * Track/thumb sizes match stack-row control height (~34px row, compact switch).
 */

const transition =
  'motion-safe:transition-[background-color,border-color,transform] motion-safe:duration-[140ms] motion-safe:ease-out';

export const switchRootRecipe = cva(
  `relative inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer items-center rounded-full border border-line bg-bg-2 p-0.5 outline-none select-none ${transition} data-[checked]:border-accent data-[checked]:bg-[color-mix(in_oklch,var(--accent)_32%,var(--bg-2))] data-[unchecked]:border-line focus-visible:border-accent data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40`,
  {
    variants: {
      size: {
        default: '',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

export type SwitchSize = NonNullable<VariantProps<typeof switchRootRecipe>['size']>;

export const switchThumbClass = `pointer-events-none aspect-square h-full rounded-full bg-muted shadow-sm ${transition} data-[checked]:translate-x-[18px] data-[checked]:bg-accent data-[unchecked]:translate-x-0`;
