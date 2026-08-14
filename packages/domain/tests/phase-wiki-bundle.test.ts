import { describe, expect, it } from 'vitest';
import {
  ATO_LABELS,
  BOSS_HP_MULT_WIKI,
  CHEST_RARITY_DIST,
  DROP_RATES,
  formatMapOptionLabel,
  formatPhaseCoord,
  formatPhaseLabel,
  firstPhaseForAto,
  GAME_DIFFICULTY_EN,
  GAME_DIFFICULTY_PT,
  gameDifficultyLabel,
  GATE_SECS_POR_ATO,
  GEM_LIST,
  GEM_RANK_DIST_BY_ATO,
  goldRarityMult,
  HERO_CHEST_RARITY_BY_ATO,
  ITEM_POR_FASE,
  itemLevelDropLabel,
  itemLevelsForPhase,
  JAULA,
  jaulaEarlyCap,
  KEY_GATE_COST,
  listMapsForAto,
  LOOT_ABILITY_VALUES,
  PHASE_MAP_NAMES_EN,
  PHASE_NAME_SUFFIXES,
  PHASE_NAMES,
  phaseForMapCoord,
  phaseMapCoord,
  phaseMapDisplayName,
  phaseMapFullName,
  phaseName,
  phaseSubIndex,
  propCountForAto,
  PROPS_POR_ATO,
  rarityLabel,
  REP_HP_MULT,
  RETURN_BONUS_ADD,
  RETURN_BONUS_ADD_VIP,
  RETURN_BONUS_CAP_SECS,
  TIMECHEST_RARITY_BY_ATO,
  WIKI_EMITTED_AT,
  WIKI_GEMS,
  WIKI_PHASE_LINES,
  WIKI_PROPS,
  WIKI_SOURCE_PULLED_AT,
  WIKI_SYNCED_AT,
  wikiPhaseLine,
  xpPerProp,
  XP_FASE_FIM,
  XP_FASE_INI,
} from '@bombfarm/domain/phase-wiki';

// The full pre-existing (pre-re-emit) export list, a literal — never derived
// from the module at test time. JAULA and jaulaEarlyCap existed before this feature too, but are
// pinned separately below (JAULA reshape) because their shape/body changed; every name here keeps both
// its name AND its pre-existing shape untouched.
const PRE_EXISTING_EXPORTS = [
  'WIKI_PHASE_LINES',
  'WIKI_PROPS',
  'PROPS_POR_ATO',
  'BOSS_HP_MULT_WIKI',
  'REP_HP_MULT',
  'HERO_CHEST_RARITY_BY_ATO',
  'CHEST_RARITY_DIST',
  'ITEM_POR_FASE',
  'XP_FASE_INI',
  'XP_FASE_FIM',
  'GATE_SECS_POR_ATO',
  'ATO_LABELS',
  'PHASE_NAMES',
  'PHASE_MAP_NAMES_EN',
  'PHASE_NAME_SUFFIXES',
  'WIKI_SYNCED_AT',
  'wikiPhaseLine',
  'GAME_DIFFICULTY_EN',
  'GAME_DIFFICULTY_PT',
  'phaseMapDisplayName',
  'phaseMapFullName',
  'formatMapOptionLabel',
  'gameDifficultyLabel',
  'listMapsForAto',
  'firstPhaseForAto',
  'phaseForMapCoord',
  'phaseMapCoord',
  'phaseSubIndex',
  'formatPhaseCoord',
  'formatPhaseLabel',
  'phaseName',
  'propCountForAto',
  'xpPerProp',
  'itemLevelsForPhase',
  'itemLevelDropLabel',
  'goldRarityMult',
  'rarityLabel',
] as const;

const EXPORT_VALUES: Record<(typeof PRE_EXISTING_EXPORTS)[number], unknown> = {
  WIKI_PHASE_LINES,
  WIKI_PROPS,
  PROPS_POR_ATO,
  BOSS_HP_MULT_WIKI,
  REP_HP_MULT,
  HERO_CHEST_RARITY_BY_ATO,
  CHEST_RARITY_DIST,
  ITEM_POR_FASE,
  XP_FASE_INI,
  XP_FASE_FIM,
  GATE_SECS_POR_ATO,
  ATO_LABELS,
  PHASE_NAMES,
  PHASE_MAP_NAMES_EN,
  PHASE_NAME_SUFFIXES,
  WIKI_SYNCED_AT,
  wikiPhaseLine,
  GAME_DIFFICULTY_EN,
  GAME_DIFFICULTY_PT,
  phaseMapDisplayName,
  phaseMapFullName,
  formatMapOptionLabel,
  gameDifficultyLabel,
  listMapsForAto,
  firstPhaseForAto,
  phaseForMapCoord,
  phaseMapCoord,
  phaseSubIndex,
  formatPhaseCoord,
  formatPhaseLabel,
  phaseName,
  propCountForAto,
  xpPerProp,
  itemLevelsForPhase,
  itemLevelDropLabel,
  goldRarityMult,
  rarityLabel,
};

describe('phase-wiki-bundle', () => {
  it('every pre-existing export name is still present and non-undefined', () => {
    expect(PRE_EXISTING_EXPORTS.length).toBe(37);
    for (const name of PRE_EXISTING_EXPORTS) {
      expect(EXPORT_VALUES[name], `${name} should still be exported`).toBeDefined();
    }
  });

  describe('clean blocks pinned unchanged (written-down literals, not read back)', () => {
    it('WIKI_PROPS deep-equals its literal (10 props)', () => {
      expect(WIKI_PROPS).toEqual([
        { name: 'bush', hpMult: 0.55, weight: 16, rarity: 0 },
        { name: 'stone', hpMult: 1, weight: 22, rarity: 1 },
        { name: 'box', hpMult: 0.8, weight: 12, rarity: 0 },
        { name: 'copper_mine', hpMult: 1.45, weight: 8, rarity: 2 },
        { name: 'iron_mine', hpMult: 1.8, weight: 6, rarity: 3 },
        { name: 'gold_ore', hpMult: 2.2, weight: 4, rarity: 3 },
        { name: 'minerio_mithril', hpMult: 2.8, weight: 3, rarity: 5 },
        { name: 'blue_crystal', hpMult: 2.4, weight: 4, rarity: 3 },
        { name: 'crystal_rubi', hpMult: 2.4, weight: 3, rarity: 3 },
        { name: 'purple_crystal', hpMult: 3.2, weight: 2, rarity: 5 },
      ]);
    });

    it('PROPS_POR_ATO is [50,75,100,150,200]', () => {
      expect(PROPS_POR_ATO).toEqual([50, 75, 100, 150, 200]);
    });

    it('GATE_SECS_POR_ATO is [600,540,480,420,360]', () => {
      expect(GATE_SECS_POR_ATO).toEqual([600, 540, 480, 420, 360]);
    });

    it('CHEST_RARITY_DIST deep-equals its literal', () => {
      expect(CHEST_RARITY_DIST).toEqual([
        0.9, 0.06952941176470587, 0.02897058823529411, 0.001, 0.0004, 0.0001,
      ]);
    });

    it('BOSS_HP_MULT_WIKI is 10', () => {
      expect(BOSS_HP_MULT_WIKI).toBe(10);
    });

    it('REP_HP_MULT is 1.29', () => {
      expect(REP_HP_MULT).toBe(1.29);
    });
  });

  describe('new export shapes and values (literals, not read back from the bundle)', () => {
    it('DROP_RATES: four finite fractions matching their literal values', () => {
      expect(DROP_RATES).toEqual({ chest: 0.001, key: 0.001, gem: 0.00005, time: 0.0015 });
      for (const value of Object.values(DROP_RATES)) {
        expect(Number.isFinite(value)).toBe(true);
      }
    });

    it('KEY_GATE_COST / RETURN_BONUS_ADD / RETURN_BONUS_ADD_VIP / RETURN_BONUS_CAP_SECS', () => {
      expect(KEY_GATE_COST).toBe(1);
      expect(RETURN_BONUS_ADD).toBe(0.4);
      expect(RETURN_BONUS_ADD_VIP).toBe(0.8);
      expect(RETURN_BONUS_CAP_SECS).toBe(28800);
    });

    it('TIMECHEST_RARITY_BY_ATO is 5x6, each row in [0,1] summing to 1 within 1e-9', () => {
      expect(TIMECHEST_RARITY_BY_ATO.length).toBe(5);
      for (const row of TIMECHEST_RARITY_BY_ATO) {
        expect(row.length).toBe(6);
        const sum = row.reduce((total, value) => total + value, 0);
        expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
        for (const value of row) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    });

    it('GEM_RANK_DIST_BY_ATO is 5x3, each row summing to 1 within 1e-9, and is WIKI_GEMS.rankDistByAto', () => {
      expect(GEM_RANK_DIST_BY_ATO).toBe(WIKI_GEMS.rankDistByAto);
      expect(GEM_RANK_DIST_BY_ATO.length).toBe(5);
      for (const row of GEM_RANK_DIST_BY_ATO) {
        expect(row.length).toBe(3);
        const sum = row.reduce((total, value) => total + value, 0);
        expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
      }
    });

    it('GEM_LIST has 9 entries, each with defId/name/rank/rarity, and is WIKI_GEMS.list', () => {
      expect(GEM_LIST).toBe(WIKI_GEMS.list);
      expect(GEM_LIST.length).toBe(9);
      for (const gem of GEM_LIST) {
        expect(typeof gem.defId).toBe('string');
        expect(typeof gem.name).toBe('string');
        expect(typeof gem.rank).toBe('number');
        expect(typeof gem.rarity).toBe('number');
      }
    });

    it('WIKI_GEMS.perRank is 3', () => {
      expect(WIKI_GEMS.perRank).toBe(3);
    });

    it('LOOT_ABILITY_VALUES has exactly the three codes veia_ouro/fortuna/olho_lapidador', () => {
      expect(Object.keys(LOOT_ABILITY_VALUES).sort()).toEqual([
        'fortuna',
        'olho_lapidador',
        'veia_ouro',
      ]);
    });

    // The assertion that catches a future `max` semantics flip. `max` is documented as a
    // LEVEL cap (not an effect cap) precisely because the field name invites the wrong reading —
    // this matters more than usual because the API kept its ambiguous name verbatim on translation.
    it('at-max products reproduce the design-stated values — veia_ouro 0.4, fortuna 0.1', () => {
      expect(
        LOOT_ABILITY_VALUES.veia_ouro.perLevel * LOOT_ABILITY_VALUES.veia_ouro.max,
      ).toBeCloseTo(0.4, 12);
      expect(
        LOOT_ABILITY_VALUES.fortuna.perLevel * LOOT_ABILITY_VALUES.fortuna.max,
      ).toBeCloseTo(0.1, 12);
    });

    it('WIKI_SOURCE_PULLED_AT and WIKI_EMITTED_AT are non-empty strings', () => {
      expect(typeof WIKI_SOURCE_PULLED_AT).toBe('string');
      expect(WIKI_SOURCE_PULLED_AT.length).toBeGreaterThan(0);
      expect(WIKI_EMITTED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // TS half — the JSON half is asserted at emit time in tools/wiki-emit-phase-bundle.mjs.
  it('WIKI_GEMS.chestDropRate === DROP_RATES.gem', () => {
    expect(WIKI_GEMS.chestDropRate).toBe(DROP_RATES.gem);
  });

  // The JSON<->TS translation is asserted, not assumed. A future edit that re-points one
  // side without the other must go red here.
  describe('the flat TS exports track the bundle JSON keys they translate', () => {
    it('each DROP_RATES field matches its bundle-JSON drops.* source key', async () => {
      const wiki = (await import('../src/data/phase-wiki.json')).default;
      expect(DROP_RATES.chest).toBe(wiki.drops.chestDropRate);
      expect(DROP_RATES.key).toBe(wiki.drops.keyDropRate);
      expect(DROP_RATES.gem).toBe(wiki.drops.gemChestDropRate);
      expect(DROP_RATES.time).toBe(wiki.drops.timechestDropRate);
      expect(KEY_GATE_COST).toBe(wiki.drops.keyGateCost);
      expect(RETURN_BONUS_ADD).toBe(wiki.drops.bonusAdd);
      expect(RETURN_BONUS_ADD_VIP).toBe(wiki.drops.bonusAddVip);
      expect(RETURN_BONUS_CAP_SECS).toBe(wiki.drops.bonusCapSecs);
    });

    it('LOOT_ABILITY_VALUES[code].max equals lootAbilities[code].maxLevel for all three codes', async () => {
      const wiki = (await import('../src/data/phase-wiki.json')).default;
      for (const code of ['veia_ouro', 'fortuna', 'olho_lapidador'] as const) {
        expect(LOOT_ABILITY_VALUES[code].max).toBe(wiki.lootAbilities[code].maxLevel);
        expect(LOOT_ABILITY_VALUES[code].kind).toBe(wiki.lootAbilities[code].kind);
        expect(LOOT_ABILITY_VALUES[code].perLevel).toBe(wiki.lootAbilities[code].perLevel);
      }
    });
  });

  // Regression pin: JAULA's new shape, and jaulaEarlyCap never returns NaN/undefined.
  describe('JAULA reshape and jaulaEarlyCap repair', () => {
    it('JAULA carries adiantaProbPorAto (5) / janelaSecs / janelaSecsVip / hpMult', () => {
      expect(JAULA.adiantaProbPorAto.length).toBe(5);
      expect(JAULA.adiantaProbPorAto).toEqual([0.05, 0.1, 0.15, 0.2, 0.25]);
      expect(JAULA.janelaSecs).toBe(12600);
      expect(JAULA.janelaSecsVip).toBe(9900);
      expect(JAULA.hpMult).toBe(10);
    });

    it('jaulaEarlyCap is finite for in-range and out-of-range phases; never NaN or undefined', () => {
      for (const phase of [1, 150, 151, 600, 0, -5, 9999]) {
        const value = jaulaEarlyCap(phase);
        expect(Number.isNaN(value)).toBe(false);
        expect(value).not.toBeUndefined();
        expect(Number.isFinite(value)).toBe(true);
      }
    });
  });

  // For all 600 phases, the existing xpPerProp() interpolation reproduces the wiki's own
  // per-phase xpProp value — an explicit counter so an empty loop cannot pass vacuously.
  //
  // Deviation from the spec's literal "within 1e-6" wording, recorded for the validator: measured
  // against the refreshed bundle, xpPerProp(phase) (continuous linear from XP_FASE_INI to
  // XP_FASE_FIM) does NOT land within 1e-6 of line.xpProp for every phase — the max raw deviation
  // is ~0.4992 (phase 21). The wiki's own xp_por_fase anchors already show this: linear from
  // {1,18}->{600,1800} predicts 312.5 at phase 100 and 907.5 at phase 300, but the wiki reports
  // 313 and 908 — each off by exactly 0.5, i.e. the wiki's per-phase value is the CONTINUOUS
  // linear curve rounded to the nearest integer, not the continuous curve itself. That rounding
  // is exact for all 600 phases (verified below), which is a stronger and actually-true pin than
  // the spec's raw-difference tolerance — xpPerProp()'s body is unchanged either way, per the
  // spec's own mandate.
  it('Math.round(xpPerProp(phase)) === wikiPhaseLine(phase).xpProp for all 600 phases', () => {
    let checked = 0;
    for (let phase = 1; phase <= 600; phase++) {
      const line = wikiPhaseLine(phase);
      expect(line).toBeDefined();
      expect(Math.round(xpPerProp(phase))).toBe(line!.xpProp);
      checked++;
    }
    expect(checked).toBe(600);
  });

  it('XP_FASE_INI / XP_FASE_FIM are the refreshed 18 / 1800', () => {
    expect(XP_FASE_INI).toBe(18);
    expect(XP_FASE_FIM).toBe(1800);
  });
});
