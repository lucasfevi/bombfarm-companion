import type { AccountPayload, DataIssue } from '@bombfarm/contracts';
import { absentBirthStatsKeys } from './save-units';

export const HERO_NUMBER_KEYS = ['level', 'stars', 'stat_points_available'] as const;

/** What a piece of gear is worth is its rarity, level and forge level; a default for any of them
 *  is a different item. */
export const GEAR_FORGE_KEYS = ['rarity', 'level', 'upgrade'] as const;

/** The kinds that leave a hero out of calculations, and so earn the flag on its portrait. */
export function isHeroBlockingIssue(
  issue: DataIssue,
): issue is DataIssue & { readonly heroId: string; readonly kind: 'hero_field_absent' | 'gear_field_absent' } {
  return (issue.kind === 'hero_field_absent' || issue.kind === 'gear_field_absent') && issue.heroId !== undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordsOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function idOf(value: unknown): string {
  if (typeof value === 'string') return value;
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

export function absentNumbers(record: Record<string, unknown>, keys: readonly string[]): string[] {
  return keys.filter((key) => typeof record[key] !== 'number' || !Number.isFinite(record[key]));
}

export interface RosterScan {
  readonly issues: DataIssue[];
  /** Gear that lost its `equipped_on`: the hero whose own record names it, or `null` when no
   *  single hero does. Gear that still says who wears it is not in this map. */
  readonly ownerOfOrphan: ReadonlyMap<string, string | null>;
}

function heroIdsClaiming(heroes: readonly Record<string, unknown>[]): Map<string, string[]> {
  const claims = new Map<string, string[]>();
  for (const hero of heroes) {
    const heroId = idOf(hero.id);
    if (heroId === '' || !Array.isArray(hero.slots)) continue;
    for (const reference of hero.slots) {
      const itemId = idOf(reference);
      if (itemId !== '') claims.set(itemId, [...(claims.get(itemId) ?? []), heroId]);
    }
  }
  return claims;
}

function sortedUnion(lists: readonly (readonly string[])[]): string[] {
  return [...new Set(lists.flat())].sort();
}

/**
 * Every field a hero or a piece of gear lacks that the importer builds a sheet from, as typed
 * records. The parser blocks exactly what is reported here and nothing else on this ground, so
 * the log, the banner and the flag on a hero's portrait cannot disagree with the numbers.
 *
 * A hero's `slots` lists the ids of the 8 pieces it wears, and in every committed capture it
 * agrees with each piece's `equipped_on`. When a piece loses `equipped_on`, the one hero whose
 * `slots` names it wears it; a piece nobody (or more than one hero) names is left out.
 */
export function scanRosterIssues(payload: AccountPayload): RosterScan {
  const raw: Record<string, unknown> = isRecord(payload) ? payload : {};
  const heroes = recordsOf(raw.heroes);
  const gear = recordsOf(raw.items).filter((item) => item.category === 0);
  const issues: DataIssue[] = [];

  const claims = heroIdsClaiming(heroes);
  const ownerOfOrphan = new Map<string, string | null>();
  const ownerKeyOf = (item: Record<string, unknown>): string => {
    if (item.equipped_on !== undefined) return idOf(item.equipped_on);
    return ownerOfOrphan.get(idOf(item.id)) ?? '';
  };

  for (const item of gear) {
    if (item.equipped_on !== undefined) continue;
    const itemId = idOf(item.id);
    const claimants = claims.get(itemId) ?? [];
    const owner = claimants.length === 1 ? (claimants[0] ?? null) : null;
    ownerOfOrphan.set(itemId, owner);
    issues.push(
      owner === null
        ? { kind: 'gear_owner_unknown', section: 'items', keys: ['equipped_on'], itemId }
        : { kind: 'gear_owner_recovered', section: 'items', keys: ['equipped_on'], itemId, heroId: owner },
    );
  }

  const gearKeysByOwner = new Map<string, string[][]>();
  const poolGearKeys: string[][] = [];
  for (const item of gear) {
    const absent = absentNumbers(item, GEAR_FORGE_KEYS);
    if (absent.length === 0) continue;
    const owner = ownerKeyOf(item);
    if (owner === '') {
      if (item.equipped_on !== undefined) poolGearKeys.push(absent);
      continue;
    }
    gearKeysByOwner.set(owner, [...(gearKeysByOwner.get(owner) ?? []), absent]);
  }

  for (const hero of heroes) {
    const heroId = idOf(hero.id);
    if (heroId === '') continue;
    const absentHero = [
      ...absentNumbers(hero, HERO_NUMBER_KEYS),
      ...absentBirthStatsKeys(hero),
      ...(isRecord(hero.stats) ? [] : ['stats']),
    ];
    if (absentHero.length > 0) issues.push({ kind: 'hero_field_absent', section: 'heroes', keys: absentHero, heroId });
    const gearKeys = gearKeysByOwner.get(heroId);
    if (gearKeys !== undefined) {
      issues.push({ kind: 'gear_field_absent', section: 'items', keys: sortedUnion(gearKeys), heroId });
    }
  }
  if (poolGearKeys.length > 0) issues.push({ kind: 'gear_field_absent', section: 'items', keys: sortedUnion(poolGearKeys) });

  return { issues, ownerOfOrphan };
}

function skillTreeIssueOf(payload: AccountPayload): DataIssue[] {
  const fidelity = payload.fidelity?.skills;
  if (fidelity === undefined || fidelity.status === 'resolved' || fidelity.status === 'degraded') return [];
  const keys = fidelity.lostKeys ?? [];
  if (keys.length === 0) return [];
  return [{ kind: fidelity.status === 'stale' ? 'skill_tree_stale' : 'skill_tree_withheld', section: 'skills', keys }];
}

/** Everything the app can tell about a payload that the game stopped sending, in one list. */
export function dataIssuesOf(payload: AccountPayload): DataIssue[] {
  return [...skillTreeIssueOf(payload), ...scanRosterIssues(payload).issues];
}
