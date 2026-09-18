import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccountPayload, AccountView } from '@bombfarm/contracts';
import { parseSkillTreeState, PVP_WINDOW_SECS, type SkillTreeState } from '@bombfarm/domain/skill-tree';
import type { FarmInputs } from '@bombfarm/farm/core';
import { buildFarmInputs, DEFAULT_FARM_CONTROLS } from '../farm/farm-inputs';
import { priceSkillsView, skillsPricingKey, skillsTotalsOf } from './skills-pricing';

const OFFLINE_FIXTURE = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'account-offline.json');

function offlineView(): AccountView {
  const payload = JSON.parse(readFileSync(OFFLINE_FIXTURE, 'utf8')) as AccountPayload;
  return { payload, gameRunning: false, store: { status: 'ok', reason: null, binding: 'better-sqlite3' } };
}

function offlineInputs(view = offlineView()): { inputs: FarmInputs; state: SkillTreeState } {
  const inputs = buildFarmInputs(view, DEFAULT_FARM_CONTROLS);
  const state = parseSkillTreeState(view.payload.skills);
  if (inputs === null || state === null) throw new Error('expected the committed offline account to price');
  return { inputs, state };
}

describe('priceSkillsView', () => {
  it('prices the committed offline account: a baseline, a gain per buyable node, and the phase it was asked for', () => {
    const { inputs, state } = offlineInputs();
    const squad = inputs.heroes.slice(0, 3).map((hero) => hero.id);
    const pricing = priceSkillsView(inputs, state, skillsTotalsOf(state), 51, 50, { windowSecs: PVP_WINDOW_SECS, heroIds: squad, phase: 120 });

    expect(pricing.phase).toBe(51);
    expect(pricing.baseline.goldPerHour).toBeGreaterThan(0);
    expect(pricing.baseline.gate?.phase).toBe(50);
    expect(pricing.baseline.gate?.dps).toBeGreaterThan(0);
    expect(pricing.baseline.pvp).toMatchObject({ phase: 120, windowSecs: PVP_WINDOW_SECS });
    expect(pricing.baseline.pvp?.dps).toBeGreaterThan(0);
    expect(priceSkillsView(inputs, state, skillsTotalsOf(state), 51, 50, null).baseline.pvp).toBeNull();
    expect(pricing.gains.length).toBeGreaterThan(0);
    for (const gain of pricing.gains) {
      expect(gain.cost).toBeGreaterThan(0);
      expect(Number.isFinite(gain.goldPerHourDelta)).toBe(true);
    }
  });

  it('takes the totals the server reported when it sent them', () => {
    const { state } = offlineInputs();
    expect(state.totals).not.toBeNull();
    expect(skillsTotalsOf(state)).toBe(state.totals);
  });
});

describe('skillsPricingKey', () => {
  it('is the same key for a re-read that changed only the capture time', () => {
    const view = offlineView();
    const fidelity = view.payload.fidelity;
    if (fidelity === undefined) throw new Error('expected the committed offline account to carry fidelity');
    const later: AccountView = {
      ...view,
      payload: {
        ...view.payload,
        fidelity: { ...fidelity, heroes: { status: 'resolved', capturedAt: '2026-09-17T12:00:00.000Z' } },
      },
    };
    const first = offlineInputs(view);
    const second = offlineInputs(later);
    expect(first.inputs.heroes[0]?.updatedAt).not.toBe(second.inputs.heroes[0]?.updatedAt);
    const windows = { gatePhase: 50, pvp: null };
    expect(skillsPricingKey(first.inputs, first.state, 51, windows)).toBe(skillsPricingKey(second.inputs, second.state, 51, windows));
  });

  it('moves with the phase, the tree levels and the farm controls', () => {
    const { inputs, state } = offlineInputs();
    const windows = { gatePhase: 50, pvp: null };
    const base = skillsPricingKey(inputs, state, 51, windows);
    expect(skillsPricingKey(inputs, state, 52, windows)).not.toBe(base);
    expect(skillsPricingKey(inputs, { ...state, levels: { ...state.levels, X99: 1 } }, 51, windows)).not.toBe(base);
    expect(skillsPricingKey({ ...inputs, farmReturnBonus: 'vip' }, state, 51, windows)).not.toBe(base);
    expect(skillsPricingKey(inputs, state, 51, { ...windows, gatePhase: 60 })).not.toBe(base);
    expect(skillsPricingKey(inputs, state, 51, { ...windows, pvp: { windowSecs: PVP_WINDOW_SECS, heroIds: ['a'], phase: 120 } })).not.toBe(base);
  });
});
