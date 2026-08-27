import { cva, type VariantProps } from 'class-variance-authority';

/** Verbatim from the web's former `site-header.tsx` language `role="group"` wrapper. */
export const segmentedToggleRootClass = 'inline-flex h-8 shrink-0 overflow-hidden rounded-sm border border-line';

/** Verbatim from the web's former inline PT/EN button classes. */
export const segmentedToggleItemRecipe = cva('cursor-pointer border-0 px-2.25 text-[11px] font-bold tracking-[0.03em]', {
  variants: {
    active: {
      true: 'bg-accent text-accent-ink',
      false: 'bg-transparent',
    },
  },
  defaultVariants: { active: false },
});

export type SegmentedToggleItemVariant = VariantProps<typeof segmentedToggleItemRecipe>;
