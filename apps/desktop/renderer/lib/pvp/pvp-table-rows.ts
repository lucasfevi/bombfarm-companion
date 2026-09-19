/**
 * The two PVP tables' row geometry. Each table shows this many rows under its sticky header and
 * scrolls the rest, mounting only a window of them; the heights are what the rows are pinned to
 * and what the window math and spacer rows assume, so the assumed and rendered heights cannot
 * drift apart.
 *
 * Measured in the running app at the design system's table recipe (2026-09-19): the header row
 * is 28.33px, a rival row 30.33px (a 13px name over the table's 12px line height), a duel row
 * 37px with a text Film cell and 39px with a Replay button in it. Each pin is the next whole
 * pixel at or above the tallest natural row, so no row ever outgrows its pin.
 */
export const VISIBLE_ROWS = 10;
export const HEADER_HEIGHT_PX = 29;
export const RIVAL_ROW_HEIGHT_PX = 31;
export const DUEL_ROW_HEIGHT_PX = 39;
