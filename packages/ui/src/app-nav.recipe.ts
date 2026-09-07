import { cva, type VariantProps } from 'class-variance-authority';

/** Pill container — verbatim from the web's former `site-header.tsx` `<nav>` classes. */
export const appNavRootClass =
  'inline-flex items-stretch gap-1 rounded-md border border-line bg-[color-mix(in_oklch,var(--surface-2)_55%,transparent)] p-1 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--line)_35%,transparent)]';

/**
 * Item classes — verbatim from the web's former `site-nav-link.tsx`, plus a button-reset trio
 * (`cursor-pointer border-0 bg-transparent`) so the default `<button>` rendering matches the
 * anchor it replaces; those three are no-ops on the `<a>` the web supplies via `renderItem`.
 */
export const appNavItemRecipe = cva(
  'cursor-pointer rounded-[3px] border-0 bg-transparent px-3 py-1.5 text-[11px] font-bold tracking-[0.07em] uppercase no-underline transition-[color,background,box-shadow]',
  {
    variants: {
      active: {
        true: 'bg-[color-mix(in_oklch,var(--accent)_18%,var(--surface))] text-ink shadow-[0_1px_0_color-mix(in_oklch,var(--line)_80%,transparent),inset_0_0_0_1px_color-mix(in_oklch,var(--accent)_35%,var(--line))]',
        false: 'text-muted hover:bg-[color-mix(in_oklch,var(--line)_28%,transparent)] hover:text-ink',
      },
      /**
       * `label` adds nothing, so a caller that asks for words gets the byte-identical class string
       * the web's header has always emitted. Only the two narrow forms lay a glyph beside text and
       * therefore need the box to be a flex row.
       */
      layout: {
        label: '',
        'icon-and-label': 'inline-flex items-center gap-1.5',
        icon: 'inline-flex items-center justify-center px-2',
      },
    },
    defaultVariants: { active: false, layout: 'label' },
  },
);

export type AppNavItemVariant = VariantProps<typeof appNavItemRecipe>;
