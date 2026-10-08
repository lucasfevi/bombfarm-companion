import type { EquippedItem, Loadout, SheetStats } from '@bombfarm/domain/gear';
import { emptyLoadout } from '@bombfarm/domain/gear';
import type { StatRanges } from '@bombfarm/domain/birth-sheet';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import type { HeroRune } from '@bombfarm/domain/runes';
import { normalizeHero, type HeroRecord } from '@/shared/lib/storage';

function sheetStartingAt(seed: number): SheetStats {
  return Object.fromEntries(SHEET_KEYS.map((key, index) => [key, seed + index + 1])) as SheetStats;
}

function statRangesStartingAt(seed: number): StatRanges {
  return Object.fromEntries(
    SHEET_KEYS.map((key, index) => [key, { min: seed + index * 10, max: seed + index * 10 + 7 }]),
  );
}

function item(defId: string, rarityIdx: number, level: number, upgrade: number): EquippedItem {
  return { defId, rarityIdx, level, upgrade };
}

const RUNES: readonly HeroRune[] = [
  { axis: 'attack', strengthPct: 5, playSecondsLeft: 3600, rarity: 1 },
  { axis: 'critdmg', strengthPct: 12.5, playSecondsLeft: 1800, rarity: 3 },
  { axis: 'cdr', strengthPct: 20, playSecondsLeft: 450, rarity: 4 },
  { axis: 'gold', strengthPct: 8, playSecondsLeft: 7200, rarity: 2 },
];

/**
 * A normalized hero with every stored field holding a value that no default, fallback or
 * neighbouring field could produce — so a field the draft store drops, defaults or swaps with
 * another reads back as different, not as the same value by coincidence.
 */
export function populatedHeroRecord(): HeroRecord {
  const loadout: Loadout = {
    ...emptyLoadout(),
    arma: item('ember_arma', 3, 100, 5),
    elmo: item('gold_elmo', 2, 60, 3),
    anel: item('coal_anel', 4, 200, 10),
    peito: item('ember_peito', 1, 30, 1),
  };
  const altLoadout: Loadout = {
    ...emptyLoadout(),
    arma: item('gold_arma', 5, 300, 15),
    luva: item('coal_luva', 2, 150, 7),
    bota: item('ember_bota', 3, 90, 2),
  };
  return normalizeHero({
    id: 'hero-round-trip',
    name: 'Round Trip',
    updatedAt: 1_700_000_000_000,
    rarity: 'Épico',
    level: 42,
    stars: 3,
    naked: sheetStartingAt(100),
    loadout,
    altLoadout,
    gearedOverride: sheetStartingAt(200),
    abilities: { bateria_extra: 6, marcha_acelerada: 11 },
    pts: sheetStartingAt(0),
    statPointsAvailable: 9,
    sourceId: 'save-hero-7',
    rank: 'S',
    power: 123_456,
    deployed: true,
    battleAllowed: false,
    marketable: false,
    skin: 5,
    birth: sheetStartingAt(300),
    statRanges: statRangesStartingAt(120),
    runes: RUNES,
  });
}
