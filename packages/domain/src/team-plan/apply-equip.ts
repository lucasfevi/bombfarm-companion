import type { ApplyConflictReason, ApplyEquipUnit, ApplyUnitVerdict } from '@bombfarm/contracts';
import type { MoveAction } from './types';

export type LiveGearState = {
  wearerByItemId: ReadonlyMap<string, string | null>;
  heroIds: ReadonlySet<string>;
};

export type ApplyVerdictCounts = {
  pending: number;
  done: number;
  conflict: number;
  byReason: Record<ApplyConflictReason, number>;
};

type ItemMoveInfo = {
  itemId: string;
  defId: string;
  slot: string;
  origin: string | null;
  target: string | null;
};

function indexMoveList(moveList: readonly MoveAction[]): Map<string, ItemMoveInfo> {
  const byItem = new Map<string, { defId: string; slot: string; unequip?: MoveAction; equip?: MoveAction }>();
  for (const action of moveList) {
    const entry = byItem.get(action.itemId) ?? { defId: action.defId, slot: action.slot };
    if (action.phase === 'unequip') entry.unequip = action;
    else entry.equip = action;
    byItem.set(action.itemId, entry);
  }
  const infos = new Map<string, ItemMoveInfo>();
  for (const [itemId, entry] of byItem) {
    const origin = entry.unequip ? entry.unequip.fromHeroId : (entry.equip?.fromHeroId ?? null);
    const target = entry.equip ? entry.equip.toHeroId : null;
    if (origin === target) continue;
    infos.set(itemId, { itemId, defId: entry.defId, slot: entry.slot, origin, target });
  }
  return infos;
}

/**
 * Turns a plan's `moveList` into an ordered, executable equip/unequip call list under swap
 * semantics: an equip requires its piece bag-resident and bags whatever currently occupies the
 * target slot; an unequip bags its piece. Greedy — each hero-bound piece is equipped exactly
 * once, after which nothing displaces it (one piece per hero/slot in the plan), and each
 * bag-bound piece is bagged either by a displacement or by the trailing pass below, so the end
 * state always equals the plan for the emitted order. The call count is not provably minimal
 * (the greedy only breaks a cycle with an explicit unequip when no pending equip is ready).
 */
export function deriveEquipUnits(moveList: readonly MoveAction[]): ApplyEquipUnit[] {
  const infoByItem = indexMoveList(moveList);

  const wearer = new Map<string, string | null>();
  const occupant = new Map<string, string>();
  for (const info of infoByItem.values()) {
    wearer.set(info.itemId, info.origin);
    if (info.origin !== null) occupant.set(`${info.origin}/${info.slot}`, info.itemId);
  }

  const pending: string[] = [];
  for (const action of moveList) {
    if (action.phase !== 'equip') continue;
    if (!infoByItem.has(action.itemId)) continue;
    if (pending.includes(action.itemId)) continue;
    pending.push(action.itemId);
  }

  const units: ApplyEquipUnit[] = [];
  const freedByIndexOf = new Map<string, number>();

  while (pending.length > 0) {
    const readyIdx = pending.findIndex((itemId) => wearer.get(itemId) === null);
    if (readyIdx === -1) {
      const itemId = pending[0];
      const info = infoByItem.get(itemId)!;
      const index = units.length;
      units.push({
        index,
        call: 'unequip',
        itemId,
        defId: info.defId,
        slot: info.slot,
        fromHeroId: info.origin,
        toHeroId: null,
        displacesItemId: null,
        freedByIndex: null,
        pendingAt: [info.origin],
        doneAt: [null, info.target],
      });
      if (info.origin !== null) occupant.delete(`${info.origin}/${info.slot}`);
      wearer.set(itemId, null);
      freedByIndexOf.set(itemId, index);
      continue;
    }

    const itemId = pending[readyIdx];
    pending.splice(readyIdx, 1);
    const info = infoByItem.get(itemId)!;
    const index = units.length;
    const targetKey = `${info.target}/${info.slot}`;
    const displacesItemId = occupant.get(targetKey) ?? null;
    if (displacesItemId !== null) {
      wearer.set(displacesItemId, null);
      freedByIndexOf.set(displacesItemId, index);
    }
    units.push({
      index,
      call: 'equip',
      itemId,
      defId: info.defId,
      slot: info.slot,
      fromHeroId: info.origin,
      toHeroId: info.target,
      displacesItemId,
      freedByIndex: freedByIndexOf.get(itemId) ?? null,
      pendingAt: info.origin !== null ? [info.origin, null] : [null],
      doneAt: [info.target],
    });
    wearer.set(itemId, info.target);
    occupant.set(targetKey, itemId);
  }

  const bagBoundIds: string[] = [];
  for (const action of moveList) {
    if (action.phase !== 'unequip') continue;
    const info = infoByItem.get(action.itemId);
    if (!info || info.target !== null) continue;
    if (bagBoundIds.includes(action.itemId)) continue;
    bagBoundIds.push(action.itemId);
  }
  for (const itemId of bagBoundIds) {
    if (wearer.get(itemId) === null) continue;
    const info = infoByItem.get(itemId)!;
    const index = units.length;
    units.push({
      index,
      call: 'unequip',
      itemId,
      defId: info.defId,
      slot: info.slot,
      fromHeroId: info.origin,
      toHeroId: null,
      displacesItemId: null,
      freedByIndex: null,
      pendingAt: [info.origin],
      doneAt: [null],
    });
    wearer.set(itemId, null);
  }

  return units;
}

export function liveGearStateFromRows(
  itemRows: readonly unknown[] | null | undefined,
  heroRows: readonly unknown[] | null | undefined,
): LiveGearState | null {
  if (itemRows == null || heroRows == null) return null;

  const wearerByItemId = new Map<string, string | null>();
  for (const row of itemRows) {
    if (typeof row !== 'object' || row === null) continue;
    const id = (row as Record<string, unknown>).id;
    if (typeof id !== 'string') continue;
    const equippedOn = (row as Record<string, unknown>).equipped_on;
    wearerByItemId.set(id, typeof equippedOn === 'string' && equippedOn.length > 0 ? equippedOn : null);
  }

  const heroIds = new Set<string>();
  for (const row of heroRows) {
    if (typeof row !== 'object' || row === null) continue;
    const id = (row as Record<string, unknown>).id;
    if (typeof id === 'string') heroIds.add(id);
  }

  return { wearerByItemId, heroIds };
}

function freedUnitBlocksItemMoved(
  freedByIndex: number,
  verdicts: readonly ApplyUnitVerdict[],
  settled: ReadonlyMap<number, 'ok' | 'skipped'> | undefined,
): boolean {
  const settledStatus = settled?.get(freedByIndex);
  if (settledStatus !== undefined) return settledStatus === 'skipped';
  return verdicts[freedByIndex]?.status === 'conflict';
}

export function preflightEquipUnits(
  units: readonly ApplyEquipUnit[],
  live: LiveGearState,
  settled?: ReadonlyMap<number, 'ok' | 'skipped'>,
): ApplyUnitVerdict[] {
  const verdicts: ApplyUnitVerdict[] = [];
  for (const unit of units) {
    if (unit.call === 'equip' && (unit.toHeroId === null || !live.heroIds.has(unit.toHeroId))) {
      verdicts.push({ index: unit.index, status: 'conflict', reason: 'heroMissing' });
      continue;
    }
    if (!live.wearerByItemId.has(unit.itemId)) {
      verdicts.push({ index: unit.index, status: 'conflict', reason: 'itemMissing' });
      continue;
    }
    const location = live.wearerByItemId.get(unit.itemId) ?? null;
    if (unit.doneAt.includes(location)) {
      verdicts.push({ index: unit.index, status: 'done' });
      continue;
    }
    if (
      unit.call === 'equip' &&
      unit.freedByIndex !== null &&
      location !== null &&
      location !== unit.toHeroId &&
      freedUnitBlocksItemMoved(unit.freedByIndex, verdicts, settled)
    ) {
      verdicts.push({ index: unit.index, status: 'conflict', reason: 'itemMoved' });
      continue;
    }
    if (unit.pendingAt.includes(location)) {
      verdicts.push({ index: unit.index, status: 'pending' });
      continue;
    }
    verdicts.push({ index: unit.index, status: 'conflict', reason: 'itemMoved' });
  }
  return verdicts;
}

export function summarizeApplyVerdicts(verdicts: readonly ApplyUnitVerdict[]): ApplyVerdictCounts {
  const byReason: Record<ApplyConflictReason, number> = {
    itemMissing: 0,
    heroMissing: 0,
    itemMoved: 0,
    allocationChanged: 0,
  };
  let pending = 0;
  let done = 0;
  let conflict = 0;
  for (const verdict of verdicts) {
    if (verdict.status === 'done') {
      done += 1;
    } else if (verdict.status === 'conflict') {
      conflict += 1;
      if (verdict.reason) byReason[verdict.reason] += 1;
    } else {
      pending += 1;
    }
  }
  return { pending, done, conflict, byReason };
}
