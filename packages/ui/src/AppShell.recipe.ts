import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Root viewport grid — header / nav / main / status-bar (DESIGN_SYSTEM §4-§5).
 * `withNav` toggles the sidebar column; omitted `items` (SHL-04) collapses to
 * a single column so the content + status bar never show an empty rail.
 * Collapse to icon-only nav is pure CSS at the `compact` breakpoint token
 * wired by `m2-tokens-theme` (`--breakpoint-compact: 1180px` in styles.css) —
 * no raw `@media (max-width: 1179px)` literal here.
 */
export const appShellRootRecipe = cva('grid h-dvh grid-rows-[auto_1fr_auto] bg-bg text-ink font-sans', {
  variants: {
    withNav: {
      true: 'grid-cols-[auto_1fr]',
      false: 'grid-cols-1',
    },
  },
  defaultVariants: { withNav: false },
});

export type AppShellRootVariant = VariantProps<typeof appShellRootRecipe>;

export const appShellHeaderClass = 'col-span-full row-start-1 border-b border-line px-6 py-4';

/**
 * Sidebar nav — icon rail below `compact` (<1180px), full width + labels at
 * `compact:` (>=1180px, the token's "regular" boundary). `overflow-y-auto`
 * keeps long nav lists scrollable without the body ever scrolling.
 */
export const appShellNavClass =
  'row-start-2 col-start-1 w-14 shrink-0 overflow-y-auto border-r border-line px-2 py-4 compact:w-56 compact:px-3';

export const appShellMainRecipe = cva('row-start-2 overflow-y-auto px-6 py-6', {
  variants: {
    withNav: {
      true: 'col-start-2',
      false: 'col-start-1',
    },
  },
  defaultVariants: { withNav: false },
});

export const appShellStatusBarClass =
  'col-span-full row-start-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-6 py-3 text-sm';

/**
 * Nav item button — active item gets `aria-current="page"` from the caller;
 * this recipe only carries the visual tone.
 */
export const appShellNavItemRecipe = cva(
  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium motion-safe:transition-colors motion-safe:duration-[120ms]',
  {
    variants: {
      active: {
        true: 'bg-surface text-ink',
        false: 'text-muted hover:bg-bg-2 hover:text-ink',
      },
    },
    defaultVariants: { active: false },
  },
);

export type AppShellNavItemVariant = VariantProps<typeof appShellNavItemRecipe>;

/** Label stays in the a11y tree at every width; only visually hidden below `compact:` (SHL-06). */
export const appShellNavLabelClass = 'sr-only truncate compact:not-sr-only';
