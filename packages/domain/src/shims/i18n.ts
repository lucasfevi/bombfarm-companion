/** Minimal i18n surface used by domain (formerly `@/shared/i18n`). */
export type Lang = 'pt' | 'en';

/** Loose strings bag — domain only `Pick`s specific keys. */
export type Strings = { [key: string]: string };

/** Tiny template helper: sub('a {x}', { x: 1 }) → 'a 1'. */
export function sub(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(vars[key] ?? ''));
}

/** EN fixture strings for domain unit tests (full catalogs stay in apps/web). */
const EN: Strings = {
  setupNeedGear: 'Equip at least one item',
  setupNeedSheet: 'Enter your geared sheet (defaults are not your hero)',
  setupNeedUnspentPts: 'Spend remaining points ({left} left of {max})',
  setupNeedUnspentAbilities: 'Spend remaining ability points ({left} left of {max})',
  setupBannerTitle: 'Finish setup before trusting the ranking',
  tabHeroWarnTitle: 'Abilities need attention',
  tabGearWarnTitle: 'Gear needs attention',
  tabAccountWarnTitle: 'Account needs attention',
  tabPointsWarnTitle: 'Points need attention',
  tabPointsResetAdvice: 'A points reset may raise sustained DPS — try Optimize build',
};

export const STRINGS = {
  en: EN,
  pt: EN,
} as const;
