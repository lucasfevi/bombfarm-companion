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
import { TEAM_AURA_SWITCH_IDS } from '@bombfarm/domain/team-buffs';
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
  const combatWindowSecs = gateWindowSecs(gatePhase);
  const combatHeroIds = skillTreeGateRosterIds({
    heroes,
    account,
    enabledHeroIds,
    phase: gatePhase,
    fieldSlots: fieldSlotsForSkillTree(account),
  });

  function price(overrides: Partial<Parameters<typeof priceSkillTree>[0]> = {}) {
    return priceSkillTree({
      heroes,
      account,
      enabledHeroIds,
      returnBonus: 'off',
      phase,
      totals,
      state,
      combatWindowSecs,
      combatHeroIds,
      combatPhase: gatePhase,
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
    expect(pricing.baseline.teamDps).toBeGreaterThan(0);
    expect(pricing.combatPhase).toBe(gatePhase);
    expect(pricing.combatWindowSecs).toBe(combatWindowSecs);
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
    expect(coin!.teamDpsDelta).toBe(0);
    const luck = pricing.gains.find((gain) => skillNode(gain.id)!.effects.every((effect) => effect.kind === 'g_luck'));
    if (luck) {
      expect(luck.goldPerHourDelta).toBe(0);
      expect(luck.teamDpsDelta).toBe(0);
      expect(luck.unpriced).toEqual(['g_luck']);
    }
    const damage = pricing.gains.find((gain) => skillNode(gain.id)!.effects.some((effect) => effect.kind === 'team_dmg' || effect.kind === 'team_geo'));
    expect(damage, 'a buyable damage node').toBeDefined();
    expect(damage!.teamDpsDelta).toBeGreaterThan(0);
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
      expect(gate[i - 1]!.dpsPerMillion ?? -Infinity).toBeGreaterThanOrEqual(gate[i]!.dpsPerMillion ?? -Infinity);
    }
    expect(rankSkillGains(pricing.gains, 'pvp').map((gain) => gain.id)).toEqual(gate.map((gain) => gain.id));
  });

  it('prices only the candidates it is handed', () => {
    const pricing = price({ candidates: ['H01'] });
    expect(pricing.gains.map((gain) => gain.id)).toEqual(state.levels.H01 === 10 ? [] : ['H01']);
  });

  it('leaves energy near zero on a window the roster already covers, while a damage node still moves', () => {
    const pricing = price({
      combatHeroIds: combatHeroIds.slice(0, 1),
      combatWindowSecs: 1,
      combatPhase: gatePhase,
      account: { ...account, aurasAtCap: TEAM_AURA_SWITCH_IDS },
    });
    const energy = pricing.gains.find((gain) => {
      const node = skillNode(gain.id);
      return node !== null && node.effects.length > 0 && node.effects.every((effect) => effect.kind === 'team_energia');
    });
    const damage = pricing.gains.find((gain) => skillNode(gain.id)!.effects.some((effect) => effect.kind === 'team_dmg' || effect.kind === 'team_geo'));
    expect(energy, 'a buyable energy-only node').toBeDefined();
    expect(damage, 'a buyable damage node').toBeDefined();
    expect(Math.abs(energy!.teamDpsDelta ?? 0)).toBeLessThan(1e-6);
    expect(damage!.teamDpsDelta).toBeGreaterThan(0);
  });

  it('uses the ranked gate roster, not the full farm pool, for the combat figure', () => {
    const rankedIds = skillTreeGateRosterIds({
      heroes,
      account,
      enabledHeroIds,
      phase: gatePhase,
      fieldSlots: 6,
    });
    const full = price({ combatHeroIds: enabledHeroIds });
    const ranked = price({ combatHeroIds: rankedIds });
    expect(rankedIds).toHaveLength(6);
    expect(rankedIds.length).toBeLessThan(enabledHeroIds.length);
    expect(ranked.baseline.teamDps).not.toBe(full.baseline.teamDps);
  });

  it('does not invent a combat team when the PVP squad is empty', () => {
    const pricing = price({ combatHeroIds: [], combatWindowSecs: PVP_WINDOW_SECS, combatPhase: 50 });
    expect(pricing.baseline.teamDps).toBeNull();
    expect(pricing.gains.every((gain) => gain.teamDpsDelta === null)).toBe(true);
    expect(pricing.baseline.goldPerHour).toBeGreaterThan(0);
  });

  it('keeps gold ranking the same when the combat roster is empty', () => {
    const gold = rankSkillGains(price().gains, 'goldPerHour').map((gain) => [gain.id, gain.goldPerHourDelta]);
    const emptyCombat = rankSkillGains(price({ combatHeroIds: [] }).gains, 'goldPerHour').map((gain) => [
      gain.id,
      gain.goldPerHourDelta,
    ]);
    expect(emptyCombat).toEqual(gold);
  });
});
