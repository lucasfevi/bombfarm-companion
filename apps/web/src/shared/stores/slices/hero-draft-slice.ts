import type { StateCreator } from 'zustand';
import {
  ABILITIES,
  abilityPointBudget,
  HERO_MAX_LEVEL,
  type RarityKey,
} from '@bombfarm/domain/model';
import {
  defaultNaked,
  emptyLoadout,
  emptySheet,
  type Loadout,
  type SheetStats,
} from '@bombfarm/domain/gear';
import { ZERO_PTS, type SheetKey } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@/shared/lib/storage';
import type { PlannerStore } from '@/shared/stores/planner-store';

export type HeroDraftSlice = {
  heroName: string;
  rarity: RarityKey;
  level: number;
  stars: number;
  naked: SheetStats;
  loadout: Loadout;
  altLoadout: Loadout | null;
  gearedOverride: SheetStats;
  abilities: Record<string, number>;
  pts: Record<SheetKey, number>;
  /** Birth roll from import — undefined until a birth-capable save is applied. */
  birth: SheetStats | undefined;
  heroSourceId: string | undefined;
  heroRank: string | undefined;
  heroPower: number | undefined;
  heroDeployed: boolean;
  heroBattleAllowed: boolean;
  /**
   * Save `marketable`, carried through the draft untouched so the autosave can hand it back.
   * Three-state and never defaulted: `false` is "bound to the account", absence is "nobody has
   * asked the game". A default here would let the draft round-trip invent an answer, and a
   * missing field here silently strips the flag off the active hero on the next autosave.
   */
  heroMarketable: boolean | undefined;
  heroSkin: number;
  /** Banked, unspent stat points from the save (`HeroRecord.statPointsAvailable`). Display-only — not user-editable. */
  statPointsAvailable: number;
  /** Suppresses phase→mitigation sync during applyHero / reset. */
  skipPhaseMitigationSync: boolean;

  setHeroName: (value: string) => void;
  setRarity: (value: RarityKey) => void;
  setHeroLevel: (value: number) => void;
  setStars: (value: number) => void;
  setNaked: (value: SheetStats) => void;
  setLoadout: (value: Loadout) => void;
  setAltLoadout: (value: Loadout | null) => void;
  setGearedOverride: (value: SheetStats) => void;
  setAbilities: (value: Record<string, number>) => void;
  setPts: (value: Record<SheetKey, number>) => void;
  setBirth: (value: SheetStats | undefined) => void;
  setHeroSourceId: (value: string | undefined) => void;
  setHeroRank: (value: string | undefined) => void;
  setHeroPower: (value: number | undefined) => void;
  setHeroDeployed: (value: boolean) => void;
  setHeroBattleAllowed: (value: boolean) => void;
  setHeroSkin: (value: number) => void;
  setStatPointsAvailable: (value: number) => void;
  setSkipPhaseMitigationSync: (value: boolean) => void;
  applyHero: (hero: HeroRecord) => void;
  resetDraftToDefaults: () => void;
  buildHeroRecord: (id?: string | null) => Omit<HeroRecord, 'id' | 'updatedAt'> & { id?: string };
};

export const defaultHeroDraftFields = (): Pick<
  HeroDraftSlice,
  | 'heroName'
  | 'rarity'
  | 'level'
  | 'stars'
  | 'naked'
  | 'loadout'
  | 'altLoadout'
  | 'gearedOverride'
  | 'abilities'
  | 'pts'
  | 'birth'
  | 'heroSourceId'
  | 'heroRank'
  | 'heroPower'
  | 'heroDeployed'
  | 'heroBattleAllowed'
  | 'heroMarketable'
  | 'heroSkin'
  | 'statPointsAvailable'
  | 'skipPhaseMitigationSync'
> => ({
  heroName: 'Hero',
  rarity: 'Comum',
  level: 0,
  stars: 0,
  naked: defaultNaked('Comum', 0),
  loadout: emptyLoadout(),
  altLoadout: null,
  gearedOverride: defaultNaked('Comum', 0),
  abilities: {},
  pts: ZERO_PTS(),
  birth: undefined,
  heroSourceId: undefined,
  heroRank: undefined,
  heroPower: undefined,
  heroDeployed: false,
  heroBattleAllowed: true,
  heroMarketable: undefined,
  heroSkin: 0,
  statPointsAvailable: 0,
  skipPhaseMitigationSync: false,
});

function trimAbilitiesForRarity(
  abilities: Record<string, number>,
  rarity: RarityKey,
  level: number,
): Record<string, number> | null {
  const pointsMax = abilityPointBudget(rarity, level);
  const next = { ...abilities };
  let changed = false;
  const spent = Object.values(next).reduce((sum, points) => sum + (points || 0), 0);
  if (spent > pointsMax) {
    let remaining = spent - pointsMax;
    for (let index = ABILITIES.length - 1; index >= 0 && remaining > 0; index--) {
      const abilityId = ABILITIES[index].id;
      const current = next[abilityId] ?? 0;
      if (current <= 0) continue;
      const cut = Math.min(current, remaining);
      next[abilityId] = current - cut;
      remaining -= cut;
      changed = true;
    }
  }
  return changed ? next : null;
}

export const createHeroDraftSlice: StateCreator<
  PlannerStore,
  [['zustand/subscribeWithSelector', never]],
  [],
  HeroDraftSlice
> = (set, get) => ({
  ...defaultHeroDraftFields(),

  setHeroName: (value) => {
    if (get().heroName === value) return;
    set({ heroName: value });
  },
  setRarity: (value) => {
    const state = get();
    if (state.rarity === value) return;
    const trimmed = state.booted ? trimAbilitiesForRarity(state.abilities, value, state.level) : null;
    if (trimmed) set({ rarity: value, abilities: trimmed });
    else set({ rarity: value });
  },
  setHeroLevel: (value) => {
    const clamped = Math.max(0, Math.min(HERO_MAX_LEVEL, Math.round(value)));
    if (get().level === clamped) return;
    set({ level: clamped });
  },
  setStars: (value) => {
    const clamped = Math.max(0, Math.min(3, Math.round(value)));
    if (get().stars === clamped) return;
    set({ stars: clamped });
  },
  setNaked: (value) => {
    if (Object.is(get().naked, value)) return;
    set({ naked: value });
  },
  setLoadout: (value) => {
    if (Object.is(get().loadout, value)) return;
    set({ loadout: value });
  },
  setAltLoadout: (value) => {
    if (Object.is(get().altLoadout, value)) return;
    set({ altLoadout: value });
  },
  setGearedOverride: (value) => {
    if (Object.is(get().gearedOverride, value)) return;
    set({ gearedOverride: value });
  },
  setAbilities: (value) => {
    if (Object.is(get().abilities, value)) return;
    set({ abilities: value });
  },
  setPts: (value) => {
    if (Object.is(get().pts, value)) return;
    set({ pts: value });
  },
  setBirth: (value) => {
    if (Object.is(get().birth, value)) return;
    set({ birth: value });
  },
  setHeroSourceId: (value) => {
    if (get().heroSourceId === value) return;
    set({ heroSourceId: value });
  },
  setHeroRank: (value) => {
    if (get().heroRank === value) return;
    set({ heroRank: value });
  },
  setHeroPower: (value) => {
    if (get().heroPower === value) return;
    set({ heroPower: value });
  },
  setHeroDeployed: (value) => {
    if (get().heroDeployed === value) return;
    set({ heroDeployed: value });
  },
  setHeroBattleAllowed: (value) => {
    if (get().heroBattleAllowed === value) return;
    set({ heroBattleAllowed: value });
  },
  setHeroSkin: (value) => {
    if (get().heroSkin === value) return;
    set({ heroSkin: value });
  },
  setStatPointsAvailable: (value) => {
    if (get().statPointsAvailable === value) return;
    set({ statPointsAvailable: value });
  },
  setSkipPhaseMitigationSync: (value) => {
    if (get().skipPhaseMitigationSync === value) return;
    set({ skipPhaseMitigationSync: value });
  },

  applyHero: (hero) => {
    set({
      heroName: hero.name,
      rarity: hero.rarity,
      level: hero.level,
      stars: hero.stars ?? 0,
      naked: hero.naked,
      loadout: hero.loadout ?? emptyLoadout(),
      altLoadout: hero.altLoadout ?? null,
      gearedOverride: hero.gearedOverride ?? emptySheet(),
      abilities: hero.abilities ?? {},
      pts: hero.pts ?? ZERO_PTS(),
      birth: hero.birth,
      heroSourceId: hero.sourceId,
      heroRank: hero.rank,
      heroPower: hero.power,
      heroDeployed: hero.deployed ?? false,
      heroBattleAllowed: hero.battleAllowed ?? true,
      heroMarketable: hero.marketable,
      heroSkin: hero.skin ?? 0,
      statPointsAvailable: hero.statPointsAvailable ?? 0,
    });
  },

  resetDraftToDefaults: () => {
    set({ ...defaultHeroDraftFields(), skipPhaseMitigationSync: false });
  },

  buildHeroRecord: (heroId) => {
    const state = get();
    return {
      id: heroId ?? undefined,
      name: state.heroName.trim() || 'Hero',
      rarity: state.rarity,
      level: state.level,
      stars: state.stars,
      naked: state.naked,
      loadout: state.loadout,
      altLoadout: state.altLoadout,
      gearedOverride: state.gearedOverride,
      abilities: state.abilities,
      pts: state.pts,
      birth: state.birth,
      sourceId: state.heroSourceId,
      rank: state.heroRank,
      power: state.heroPower,
      deployed: state.heroDeployed,
      battleAllowed: state.heroBattleAllowed,
      marketable: state.heroMarketable,
      skin: state.heroSkin,
      statPointsAvailable: state.statPointsAvailable,
    };
  },
});
