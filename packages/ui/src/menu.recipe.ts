/**
 * Menu chrome — the same popup surface `Select` already draws (bordered `surface` card, accent
 * highlight, one shadow), so a menu opened from the top bar and a select opened from a form read
 * as the same object rather than as two conventions.
 */

export const menuPositionerClass = 'z-50 outline-none';

export const menuPopupClass =
  'flex max-h-[min(24rem,var(--available-height))] min-w-[13rem] origin-[var(--transform-origin)] flex-col overflow-y-auto rounded-sm border border-line bg-surface py-1 text-ink shadow-[0_8px_24px_color-mix(in_oklch,var(--bg)_80%,transparent)] outline-none';

export const menuItemClass =
  'flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[13px] text-ink no-underline outline-none select-none data-[highlighted]:bg-[color-mix(in_oklch,var(--accent)_18%,var(--surface))] data-[highlighted]:text-accent data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40';

export const menuGroupLabelClass =
  'px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-muted uppercase';

export const menuSeparatorClass = 'my-1 h-px shrink-0 bg-line';

/**
 * The tick column on a radio row. Mounted on every row and merely hidden on the unselected ones,
 * so the labels stay in one column instead of stepping left as the selection moves.
 */
export const menuRadioIndicatorClass =
  'grid size-3.5 shrink-0 place-items-center text-accent data-[unchecked]:invisible';
