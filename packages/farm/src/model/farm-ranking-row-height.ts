/**
 * Single source of truth for the Farm Ranking table's body row height, shared by the
 * virtualized window math, the top/bottom spacer rows, the `DataTable.Root` scroll-container
 * sizing and the row's own CSS — so the assumed height and the rendered height can never drift
 * apart. 33px is the row's real, measured rendered height (padding + line-height + border at the
 * table's 12.5px base font size) — not the earlier 2.75rem/44px guess a hardcoded row height was
 * silently wrong against. Expressed in px, not rem: the value here has no clean rem equivalent
 * and pixel-exact scroll math is the point.
 */
export const ROW_HEIGHT_PX = 33;
export const ROW_HEIGHT_CSS = `${ROW_HEIGHT_PX}px`;
