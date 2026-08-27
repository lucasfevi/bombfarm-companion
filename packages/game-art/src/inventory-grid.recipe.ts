import { cva, type VariantProps } from 'class-variance-authority';

export const inventoryCardRecipe = cva(
  'flex items-start gap-2.5 rounded-lg border p-2.5 text-left motion-safe:transition-[border-color,background-color] motion-safe:duration-[120ms]',
  {
    variants: {
      tone: {
        default: 'border-line bg-surface',
        equipped: 'border-accent bg-[color-mix(in_oklch,var(--accent)_10%,var(--surface))]',
        /** An item the catalog cannot name: dimmed rather than hidden, because the whole point
         *  of the `other` bucket is that these stay visible until the catalog catches up. */
        unresolved: 'border-dashed border-line bg-[color-mix(in_oklch,var(--muted)_8%,var(--surface))]',
      },
      interactive: {
        true: 'cursor-pointer hover:border-accent',
        false: 'cursor-default',
      },
    },
    defaultVariants: { tone: 'default', interactive: false },
  },
);

export type InventoryCardTone = NonNullable<VariantProps<typeof inventoryCardRecipe>['tone']>;

export const inventoryBadgeRecipe = cva('rounded-full border px-1.5 py-0.5 text-[10px] leading-none', {
  variants: {
    tone: {
      neutral: 'border-line bg-surface text-muted',
      accent: 'border-accent bg-[color-mix(in_oklch,var(--accent)_16%,var(--surface))] text-ink',
      warn: 'border-warn bg-surface text-[color-mix(in_oklch,var(--warn)_80%,white_20%)]',
      up: 'border-up bg-[color-mix(in_oklch,var(--up)_14%,var(--surface))] text-up',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type InventoryBadgeTone = NonNullable<VariantProps<typeof inventoryBadgeRecipe>['tone']>;

export const inventoryGridClass = 'grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2';
