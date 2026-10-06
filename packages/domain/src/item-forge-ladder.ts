import forgeWiki from './data/forge-wiki.json' with { type: 'json' };

export const ITEM_FORGE_MAX = 15;

/**
 * The ladder the wiki published on 2026-10-05. The 2026-10-06 patch moved `upgrade_mult` past it,
 * but the game still scales the two sheet-capped stats (crit chance, cooldown) on this one: wire
 * items read x1.95 at +13 and x2.20 at +14 for those, and hero-sheet inversion is exact only with
 * the split. The wiki does not publish the split. Only +13 and +14 are witnessed; +11, +12 and
 * +15 here are inferred from them.
 */
export const CAPPED_STAT_UPGRADE_MULT: readonly number[] = [
  1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5, 1.6, 1.75, 1.95, 2.2, 2.5,
];

const CAPPED_STATS: ReadonlySet<string> = new Set(['crit', 'cooldown']);

function clampUpgrade(upgrade: number): number {
  return Math.max(0, Math.min(ITEM_FORGE_MAX, Math.round(upgrade)));
}

export function statUsesCappedLadder(stat: string): boolean {
  return CAPPED_STATS.has(stat);
}

export function itemStatUpgradeMult(stat: string, upgrade: number): number {
  const table = statUsesCappedLadder(stat) ? CAPPED_STAT_UPGRADE_MULT : forgeWiki.upgrade_mult;
  return table[clampUpgrade(upgrade)] ?? 1;
}
