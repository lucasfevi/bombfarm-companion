/** `@bombfarm/hero/copy` — user-facing strings for the hero and roster views. */
import { heroEn } from './en';
import { heroPtBR } from './pt-BR';
import { gearPanelEn, statPanelEn } from './panel-en';
import { gearPanelPtBR, statPanelPtBR } from './panel-pt-BR';
import type { GearPanelCopy } from './gear-panel-copy';
import type { StatPanelCopy } from './stat-panel-copy';

export { sub } from './format';
export type { RosterCopy } from './roster-copy';
export type { HeroPanelCopy } from './hero-panel-copy';
export type { StatPanelCopy } from './stat-panel-copy';
export type { GearPanelCopy } from './gear-panel-copy';
export { heroEn } from './en';
export { heroPtBR } from './pt-BR';
export { gearPanelEn, statPanelEn } from './panel-en';
export { gearPanelPtBR, statPanelPtBR } from './panel-pt-BR';

/** The two languages these screens ship in. Spelled as the literal union `@bombfarm/domain`'s
 *  own formatters declare, so the two stay structurally identical. */
export type Lang = 'en' | 'pt';

/**
 * A value-widening mapped type, one line. `en.ts` keeps its `as const` (so its own values stay
 * string *literals* for every other purpose); `HeroCopy`'s own values widen to plain `string` so
 * `pt-BR.ts`'s `const heroPtBR: HeroCopy = { … }` annotation can be satisfied by different
 * (Portuguese) string values while still requiring the exact same key set — a missing key is
 * `TS2741`, an extra/typo'd key is `TS2353`, both naming the key.
 *
 * Rejected, and why: `as HeroCopy` on `heroPtBR` would suppress both errors — a typo'd key would
 * leave the real key silently missing. `satisfies HeroCopy` checks assignability but keeps the
 * literal type and, critically, gives a weaker (sometimes absent) message on an *extra* key. An
 * index signature (`[key: string]: string`) makes every key optional-by-construction, destroying
 * the fail-the-build-on-a-missing-key guarantee outright. All three are forbidden here: when a
 * missing key makes this type error, the fix is to add the key.
 */
export type HeroCopy = { readonly [K in keyof typeof heroEn]: string };
export type HeroCopyKey = keyof HeroCopy;

export const HERO_STRINGS: Record<Lang, HeroCopy> = { en: heroEn, pt: heroPtBR };

export function heroCopyFor(lang: Lang): HeroCopy {
  return HERO_STRINGS[lang];
}

/**
 * Defaults for the two contracts a host may instead satisfy from its own dictionary.
 *
 * These two annotations are what type-check `panel-en.ts`: its objects are `as const` and
 * unannotated in their own file, so a member missing there is reported HERE, naming it. The
 * Portuguese objects carry their own annotation and fail in their own file.
 */
export const STAT_PANEL_STRINGS: Record<Lang, StatPanelCopy> = { en: statPanelEn, pt: statPanelPtBR };
export const GEAR_PANEL_STRINGS: Record<Lang, GearPanelCopy> = { en: gearPanelEn, pt: gearPanelPtBR };

export function statPanelCopyFor(lang: Lang): StatPanelCopy {
  return STAT_PANEL_STRINGS[lang];
}

export function gearPanelCopyFor(lang: Lang): GearPanelCopy {
  return GEAR_PANEL_STRINGS[lang];
}
