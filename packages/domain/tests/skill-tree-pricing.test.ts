import { describe, expect, it } from 'vitest';
import { computeFarmRateRow, computeFarmRates, type FarmAccount } from '@bombfarm/domain/farm-rate';
import {
  defaultGatePhase,
  fieldSlotsForSkillTree,
  gateWindowSecs,
  parseSkillTreeState,
  priceSkillTree,
  PVP_WINDOW_SECS,
  rankSkillGains,
  skillNode,
  skillTreeGateRosterIds,
  totalsFromLevels,
  type SkillTreeState,
} from '@bombfarm/domain/skill-tree';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';
import { FARM_OPTIMIZE_FIXTURE, loadFarmRateFixture } from './helpers/farm-rate-fixtures';

function load(filename: string): { account: FarmAccount; heroes: ReturnType<typeof loadFarmRateFixture>['heroes']; state: SkillTreeState; phase: number } {
  const fixture = loadFarmRateFixture(filename);
  const raw = loadFixtureJson(filename, 'sheet-math') as { skills: unknown };
  const state = parseSkillTreeState(raw.skills);
  if (!state) throw new Error('no skills block');
  const { teamBuffs: _teamBuffs, ...account } = fixture.account;
  return { account, heroes: fixture.heroes, state, phase: fixture.account.context.phase ?? 1 };
}

describe('priceSkillTree', () => {
  const { account, heroes, state, phase } = load(FARM_OPTIMIZE_FIXTURE);
  const totals = totalsFromLevels(state);
  const enabledHeroIds = heroes.map((hero) => hero.id);
  const gatePhase = defaultGatePhase(phase);
  const gateHeroIds = skillTreeGateRosterIds({
    heroes,
    account,
    enabledHeroIds,
    phase: gatePhase,
    fieldSlots: fieldSlotsForSkillTree(account),
  });
  const gate = { windowSecs: gateWindowSecs(gatePhase), heroIds: gateHeroIds, phase: gatePhase };
  const pvp = { windowSecs: PVP_WINDOW_SECS, heroIds: gateHeroIds.slice(0, 5), phase: 220 };

  function price(overrides: Partial<Parameters<typeof priceSkillTree>[0]> = {}) {
    return priceSkillTree({
      heroes,
      account,
      enabledHeroIds,
      returnBonus: 'off',
      phase,
      totals,
      state,
      gate,
      pvp,
      ...overrides,
    });
  }

  it('prices the baseline exactly as the farm board does, then every buyable node', () => {
    const started = performance.now();
    const pricing = price();
    const elapsed = performance.now() - started;

    const board = computeFarmRates({ heroes, account, enabledHeroIds, returnBonus: 'off', maxPhase: account.maxPhase ?? null });
    const row = computeFarmRateRow(phase, board.squad, { returnBonus: 'off', maxPhase: account.maxPhase ?? null });
    expect(pricing.baseline.goldPerHour).toBeCloseTo(row!.goldPerHour, 6);
    expect(pricing.baseline.gate?.dps).toBeGreaterThan(0);
    expect(pricing.baseline.gate).toMatchObject({ phase: gatePhase, windowSecs: gate.windowSecs, leftOut: [] });
    expect(pricing.baseline.pvp?.dps).toBeGreaterThan(0);
    expect(pricing.baseline.pvp).toMatchObject({ phase: 220, windowSecs: PVP_WINDOW_SECS });
    expect(pricing.dpsLeftOut).toEqual([]);

    expect(pricing.gains.length).toBeGreaterThan(5);
    for (const gain of pricing.gains) {
      expect(gain.cost).toBeGreaterThan(0);
      expect(Number.isFinite(gain.goldPerHourDelta)).toBe(true);
      expect(gain.goldPerMillion).toBeCloseTo(gain.goldPerHourDelta / (gain.cost / 1e6), 6);
    }
    // eslint-disable-next-line no-console
    console.info(`priced ${pricing.gains.length} nodes over ${heroes.length} heroes in ${elapsed.toFixed(0)} ms`);
  });

  it('gives a coin node a positive gold gain and no combat delta, a luck node nothing on either', () => {
    const pricing = price();
    const byId = new Map(pricing.gains.map((gain) => [gain.id, gain]));
    const coin = pricing.gains.find((gain) => skillNode(gain.id)!.effects.some((effect) => effect.kind === 'team_coin'));
    expect(coin, 'a buyable coin node').toBeDefined();
    expect(coin!.goldPerHourDelta).toBeGreaterThan(0);
    expect(coin!.gateDpsDelta).toBe(0);
    expect(coin!.pvpDpsDelta).toBe(0);
    const luck = pricing.gains.find((gain) => skillNode(gain.id)!.effects.every((effect) => effect.kind === 'g_luck'));
    if (luck) {
      expect(luck.goldPerHourDelta).toBe(0);
      expect(luck.gateDpsDelta).toBe(0);
      expect(luck.unpriced).toEqual(['g_luck']);
    }
    const damage = pricing.gains.find((gain) => skillNode(gain.id)!.effects.some((effect) => effect.kind === 'team_dmg' || effect.kind === 'team_geo'));
    expect(damage, 'a buyable damage node').toBeDefined();
    expect(damage!.gateDpsDelta).toBeGreaterThan(0);
    expect(damage!.pvpDpsDelta).toBeGreaterThan(0);
    expect(byId.size).toBe(pricing.gains.length);
  });

  it('ranks by gain per million, cheapest first on a tie, and by combat window when asked', () => {
    const pricing = price();
    const gold = rankSkillGains(pricing.gains, 'goldPerHour');
    for (let i = 1; i < gold.length; i++) {
      expect(gold[i - 1]!.goldPerMillion).toBeGreaterThanOrEqual(gold[i]!.goldPerMillion);
    }
    const gate = rankSkillGains(pricing.gains, 'gateClear');
    for (let i = 1; i < gate.length; i++) {
      expect(gate[i - 1]!.gatePerMillion ?? -Infinity).toBeGreaterThanOrEqual(gate[i]!.gatePerMillion ?? -Infinity);
    }
    const duel = rankSkillGains(pricing.gains, 'pvp');
    for (let i = 1; i < duel.length; i++) {
      expect(duel[i - 1]!.pvpPerMillion ?? -Infinity).toBeGreaterThanOrEqual(duel[i]!.pvpPerMillion ?? -Infinity);
    }
  });

  it('prices only the candidates it is handed', () => {
    const pricing = price({ candidates: ['H01'] });
    expect(pricing.gains.map((gain) => gain.id)).toEqual(state.levels.H01 === 10 ? [] : ['H01']);
  });

  it('prices energy at exactly nothing on a window every squad hero already covers, while a damage node still moves', () => {
    // The squad deploys full when the window opens, and nobody on it runs out inside 60 s — so
    // more max energy changes nothing a duel can see. The auras, Matilha's allies and the Baton
    // Pass pulse are weighted by presence in the window, not by rotation duty, or a longer stint
    // would lift every ally's damage through them and price energy as if it fought.
    const pricing = price();
    const energy = pricing.gains.find((gain) => {
      const node = skillNode(gain.id);
      return node !== undefined && node.effects.length > 0 && node.effects.every((effect) => effect.kind === 'team_energia');
    });
    const damage = pricing.gains.find((gain) => skillNode(gain.id)!.effects.some((effect) => effect.kind === 'team_dmg' || effect.kind === 'team_geo'));
    expect(energy, 'a buyable energy-only node').toBeDefined();
    expect(damage, 'a buyable damage node').toBeDefined();
    expect(energy!.pvpDpsDelta).toBe(0);
    expect(energy!.gateDpsDelta).toBe(0);
    expect(damage!.pvpDpsDelta).toBeGreaterThan(0);
    expect(damage!.gateDpsDelta).toBeGreaterThan(0);
  });

  it('prices energy once a squad hero runs out inside the window', () => {
    const pricing = price({ pvp: { ...pvp, windowSecs: 1e6 } });
    const energy = pricing.gains.find((gain) => {
      const node = skillNode(gain.id);
      return node !== undefined && node.effects.length > 0 && node.effects.every((effect) => effect.kind === 'team_energia');
    });
    expect(energy!.pvpDpsDelta).toBeGreaterThan(0);
  });

  it('uses the ranked gate roster, not the full farm pool, for the combat figure', () => {
    const rankedIds = skillTreeGateRosterIds({
      heroes,
      account,
      enabledHeroIds,
      phase: gatePhase,
      fieldSlots: 6,
    });
    const full = price({ gate: { ...gate, heroIds: enabledHeroIds } });
    const ranked = price({ gate: { ...gate, heroIds: rankedIds } });
    expect(rankedIds).toHaveLength(6);
    expect(rankedIds.length).toBeLessThan(enabledHeroIds.length);
    expect(ranked.baseline.gate?.dps).not.toBe(full.baseline.gate?.dps);
  });

  it('does not invent a combat team when the PVP squad is empty', () => {
    const pricing = price({ pvp: null });
    expect(pricing.baseline.pvp).toBeNull();
    expect(pricing.gains.every((gain) => gain.pvpDpsDelta === null && gain.pvpPerMillion === null)).toBe(true);
    expect(pricing.baseline.gate?.dps).toBeGreaterThan(0);
    expect(pricing.baseline.goldPerHour).toBeGreaterThan(0);
    const emptySquad = price({ pvp: { ...pvp, heroIds: [] } });
    expect(emptySquad.baseline.pvp?.dps).toBeNull();
  });

  it('keeps gold ranking the same when the combat roster is empty', () => {
    const gold = rankSkillGains(price().gains, 'goldPerHour').map((gain) => [gain.id, gain.goldPerHourDelta]);
    const emptyCombat = rankSkillGains(price({ gate: null, pvp: null }).gains, 'goldPerHour').map((gain) => [
      gain.id,
      gain.goldPerHourDelta,
    ]);
    expect(emptyCombat).toEqual(gold);
  });
});
