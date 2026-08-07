import { FORJA_MAX } from '../gear/catalog';
import type { InventoryItem } from '../inventory';
import type { BuildPoolInput, GearPool, HeroPlanContext, PoolEntry, ScopeState } from './types';

const DEFAULT_FORGE_FLOOR = 10;

export function clampForgeFloor(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_FORGE_FLOOR;
  return Math.max(0, Math.min(FORJA_MAX, Math.round(value)));
}

export function effectiveUpgrade(upgrade: number, forgeFloor: number): number {
  const floor = clampForgeFloor(forgeFloor);
  const clampedUpgrade = Math.max(0, Math.min(FORJA_MAX, Math.round(upgrade)));
  return Math.min(FORJA_MAX, Math.max(clampedUpgrade, floor));
}

function poolKey(defId: string, rarityIdx: number, level: number, effectiveUp: number): string {
  return `${defId}|${rarityIdx}|${level}|${effectiveUp}`;
}

function ownerScope(scopeByHeroId: Record<string, ScopeState>, ownerId: string | null): ScopeState | null {
  if (!ownerId) return null;
  return scopeByHeroId[ownerId] ?? null;
}

export function buildPool(input: BuildPoolInput): GearPool {
  const floor = clampForgeFloor(input.forgeFloor);
  const excluded = {
    marketBlocked: 0,
    unresolvedDef: 0,
    leaveAlone: 0,
    foreignOwner: 0,
  };

  const groups = new Map<string, PoolEntry>();

  for (const item of input.inventory) {
    if (item.marketBlocked) {
      excluded.marketBlocked++;
      continue;
    }
    if (!item.defResolved) {
      excluded.unresolvedDef++;
      continue;
    }
    if (!item.slot) continue;

    const ownerId = item.equippedBy;
    if (ownerId && !input.rosterHeroIds.has(ownerId)) {
      excluded.foreignOwner++;
      continue;
    }

    const ownerScopeState = ownerScope(input.scopeByHeroId, ownerId);
    if (ownerScopeState === 'leaveAlone') {
      excluded.leaveAlone++;
      continue;
    }
    if (ownerId && ownerScopeState !== 'optimize' && ownerScopeState !== 'donate') {
      excluded.leaveAlone++;
      continue;
    }

    const effUp = effectiveUpgrade(item.upgrade, floor);
    const key = poolKey(item.defId, item.rarityIdx, item.level, effUp);
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      existing.itemIds.push(item.id);
      existing.upgrade = Math.min(existing.upgrade, item.upgrade);
    } else {
      groups.set(key, {
        key,
        defId: item.defId,
        rarityIdx: item.rarityIdx,
        level: item.level,
        upgrade: item.upgrade,
        effectiveUpgrade: effUp,
        slot: item.slot,
        count: 1,
        itemIds: [item.id],
      });
    }
  }

  const entries = [...groups.values()]
    .map((entry) => ({ ...entry, itemIds: [...entry.itemIds].sort() }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return { entries, excluded };
}

export function eligibleForHero(entry: PoolEntry, hero: HeroPlanContext, targetSlot?: string): boolean {
  const slot = targetSlot ?? entry.slot;
  return entry.level <= hero.level && entry.slot === slot;
}
