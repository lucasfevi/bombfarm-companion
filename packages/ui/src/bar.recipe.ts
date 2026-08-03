import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Advice ranking-bar chrome — parity with the former `bar-chrome.ts`. `track`
 * is fixed; the fill has a default vs "best" tone. Keeps the historic
 * `.track`/`.fill` collision cleared (utility classes, no named CSS).
 */
export const trackClass = 'h-2 overflow-hidden bg-bg';

export const barRecipe = cva('', {
  variants: {
    variant: {
      fill: 'h-full bg-[color-mix(in_oklch,var(--accent)_45%,var(--bg-2))]',
      best: 'h-full bg-accent',
    },
  },
  defaultVariants: { variant: 'fill' },
});

export type BarVariant = NonNullable<VariantProps<typeof barRecipe>['variant']>;
