/**
 * The hover card every item, hero and ability icon opens — one skeleton, the way Wowhead draws
 * one: the art small at the head with the name in its rarity colour beside it, a hairline, then
 * the lines. Dressed on `Tooltip.Popup`'s own recipe, so it is the app's tooltip grown up rather
 * than a second surface.
 */
export const peekPopupClass = 'w-[17rem]';

/**
 * The trigger wraps the art in place — it lays out exactly as the bare icon did — and on hover
 * the art itself answers: the tile brightens and lifts two pixels onto a soft shadow. Nothing is
 * drawn around it; an accent ring read as a selection on a strip of eight, which it is not.
 * `tabIndex={-1}` on it keeps one tab stop per row, as the roster icons always had.
 */
export const peekTriggerClass =
  'inline-flex cursor-default rounded-sm border-0 bg-transparent p-0 align-top [&>*]:transition-[filter,transform,box-shadow] [&>*]:duration-100 hover:[&>*]:-translate-y-0.5 hover:[&>*]:brightness-[1.18] hover:[&>*]:saturate-[1.1] hover:[&>*]:shadow-[0_4px_10px_rgb(0_0_0/0.45)] motion-reduce:[&>*]:transition-none motion-reduce:hover:[&>*]:translate-y-0';

/** Art, then name and subtitle stacked beside it. */
export const peekHeadClass = 'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5';
export const peekNameClass = 'flex min-w-0 items-baseline gap-1.5 text-[13px] leading-tight font-bold text-ink';
export const peekNameTextClass = 'min-w-0 truncate';
export const peekSubClass = 'mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-1 text-[11px] leading-snug';
/** The one figure a player ranks a roster by, at the head's right edge: the label small above
 *  the number, the number as loud as the name. */
export const peekPowerClass = 'flex shrink-0 flex-col items-end gap-0.5 self-start pl-1';
export const peekPowerLabelClass = 'font-mono text-[9.5px] uppercase leading-none tracking-[0.06em] text-muted';
export const peekPowerValueClass = 'font-mono text-[13px] leading-none font-bold tabular-nums text-accent';
export const peekRuleClass = 'my-2 h-px bg-line';
export const peekRowsClass = 'flex flex-col gap-[3px] text-[11px] leading-snug tabular-nums';
export const peekRowsGridClass = 'grid grid-cols-2 gap-x-3.5 gap-y-[3px] text-[11px] leading-snug tabular-nums';
export const peekRowClass = 'flex items-baseline justify-between gap-2 text-muted [&_b]:shrink-0 [&_b]:font-semibold [&_b]:text-ink';
export const peekEffectClass = 'text-[11.5px] leading-[1.4] text-ink';
export const peekFootClass = 'mt-2 flex items-baseline justify-between gap-2 text-[10.5px] leading-snug text-muted';
export const peekStripClass = 'flex flex-wrap gap-0.5';
export const peekTagClass =
  'inline-block rounded-[3px] border border-line px-[5px] py-px font-mono text-[9.5px] uppercase tracking-[0.06em] text-muted';
export const peekTagTeamClass =
  'inline-block rounded-[3px] border border-[color-mix(in_oklch,var(--accent)_45%,var(--line))] px-[5px] py-px font-mono text-[9.5px] uppercase tracking-[0.06em] text-accent';
