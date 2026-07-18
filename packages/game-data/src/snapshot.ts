import type {
  HeroSummary,
  RawGameState,
  RawHeroEnergy,
  RawHeroRecord,
  RawInventoryBag,
  Snapshot,
} from '@bombfarm/contracts';
import { classifyHeroEnergy, classifyHeroRecord, mapHeroEnergy, mapHeroRecord, mergeHeroSummaries } from './parsers/heroes.js';
import { parseInventoryBag } from './parsers/inventory.js';
import { parseGameState } from './parsers/state.js';

export interface BuildSnapshotInput {
  takenAt: string;
  source?: Snapshot['source'];
  state?: RawGameState | null;
  inventory?: RawInventoryBag | null;
  heroRecords?: RawHeroRecord[];
  heroEnergies?: RawHeroEnergy[];
}

export interface BuildSnapshotOutput {
  snapshot: Snapshot | null;
  errors: string[];
}

export function buildSnapshot(input: BuildSnapshotInput): BuildSnapshotOutput {
  const errors: string[] = [];
  let gold = 0;
  let phase: number | undefined;
  let bagTabs = 0;
  let bagCapacity = 0;
  let items: Snapshot['items'] = [];

  if (input.state) {
    const parsedState = parseGameState(input.state);
    if (parsedState.ok) {
      gold = parsedState.gold;
      phase = typeof parsedState.state.phase === 'number' ? parsedState.state.phase : undefined;
    } else {
      errors.push(parsedState.reason);
    }
  }

  if (input.inventory) {
    const parsedInventory = parseInventoryBag(input.inventory);
    if (parsedInventory.ok) {
      items = parsedInventory.items;
      bagTabs = parsedInventory.bagTabs;
      bagCapacity = parsedInventory.bagCapacity;
    } else {
      errors.push(parsedInventory.reason);
    }
  }

  const heroRecords = (input.heroRecords ?? []).filter(classifyHeroRecord).map(mapHeroRecord);
  const energyMap = new Map<string, ReturnType<typeof mapHeroEnergy>>();
  for (const raw of input.heroEnergies ?? []) {
    if (classifyHeroEnergy(raw)) {
      energyMap.set(raw.id, mapHeroEnergy(raw));
    }
  }

  const heroes: HeroSummary[] = mergeHeroSummaries(heroRecords, energyMap);

  if (gold === 0 && items.length === 0 && !input.state) {
    return { snapshot: null, errors: errors.length > 0 ? errors : ['empty_snapshot'] };
  }

  const snapshot: Snapshot = {
    takenAt: input.takenAt,
    source: input.source ?? 'live',
    gold,
    bagTabs,
    bagCapacity,
    items,
    heroes,
    ...(phase !== undefined ? { phase } : {}),
  };

  return { snapshot, errors };
}

export function classifyParsedObjects(objects: unknown[]): {
  state: RawGameState | null;
  inventory: RawInventoryBag | null;
  heroRecords: RawHeroRecord[];
  heroEnergies: RawHeroEnergy[];
} {
  let state: RawGameState | null = null;
  let inventory: RawInventoryBag | null = null;
  const heroRecords: RawHeroRecord[] = [];
  const heroEnergies: RawHeroEnergy[] = [];

  for (const obj of objects) {
    if (!state && parseGameState(obj).ok) {
      state = obj as RawGameState;
      continue;
    }
    if (!inventory && parseInventoryBag(obj).ok) {
      inventory = obj as RawInventoryBag;
      continue;
    }
    if (classifyHeroRecord(obj)) {
      heroRecords.push(obj);
      continue;
    }
    if (classifyHeroEnergy(obj)) {
      heroEnergies.push(obj);
    }
  }

  return { state, inventory, heroRecords, heroEnergies };
}
