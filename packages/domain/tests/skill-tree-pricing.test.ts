import { describe, expect, it } from 'vitest';
import { computeFarmRateRow, computeFarmRates, type FarmAccount } from '@bombfarm/domain/farm-rate';
import {
  parseSkillTreeState,
  priceSkillTree,
  rankSkillGains,
  skillNode,
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

  it('prices the baseline exactly as the farm board does, then every buyable node', () => {
    const started = performance.now();
    const pricing = priceSkillTree({ heroes, account, enabledHeroIds, returnBonus: 'off', phase, totals, state });
    const elapsed = performance.now() - started;

    const board = computeFarmRates({ heroes, account, enabledHeroIds, returnBonus: 'off', maxPhase: account.maxPhase ?? null });
    const row = computeFarmRateRow(phase, board.squad, { returnBonus: 'off', maxPhase: account.maxPhase ?? null });
    expect(pricing.baseline.goldPerHour).toBeCloseTo(row!.goldPerHour, 6);
    expect(pricing.baseline.teamDps).toBeGreaterThan(0);
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

  it('gives a coin node a positive gold gain and no DPS, a luck node nothing on either', () => {
    const pricing = priceSkillTree({ heroes, account, enabledHeroIds, returnBonus: 'off', phase, totals, state });
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

  it('ranks by gain per million, cheapest first on a tie, and by DPS when asked', () => {
    const pricing = priceSkillTree({ heroes, account, enabledHeroIds, returnBonus: 'off', phase, totals, state });
    const gold = rankSkillGains(pricing.gains, 'goldPerHour');
    for (let i = 1; i < gold.length; i++) {
      expect(gold[i - 1]!.goldPerMillion).toBeGreaterThanOrEqual(gold[i]!.goldPerMillion);
    }
    const dps = rankSkillGains(pricing.gains, 'teamDps');
    for (let i = 1; i < dps.length; i++) {
      expect(dps[i - 1]!.dpsPerMillion ?? -Infinity).toBeGreaterThanOrEqual(dps[i]!.dpsPerMillion ?? -Infinity);
    }
  });

  it('prices only the candidates it is handed', () => {
    const pricing = priceSkillTree({ heroes, account, enabledHeroIds, returnBonus: 'off', phase, totals, state, candidates: ['H01'] });
    expect(pricing.gains.map((gain) => gain.id)).toEqual(state.levels.H01 === 10 ? [] : ['H01']);
  });
});
