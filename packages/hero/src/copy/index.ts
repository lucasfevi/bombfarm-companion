/** `@bombfarm/hero/copy` — user-facing strings for the hero and roster views. */
export { sub } from './format';
export type { RosterCopy } from './roster-copy';
export type { HeroPanelCopy } from './hero-panel-copy';

/** The two languages these screens ship in. Spelled as the literal union `@bombfarm/domain`'s
 *  own formatters declare, so the two stay structurally identical. */
export type Lang = 'en' | 'pt';
