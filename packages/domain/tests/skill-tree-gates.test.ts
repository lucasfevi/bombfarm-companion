import { describe, expect, it } from 'vitest';
import { GATE_SECS_POR_ATO } from '@bombfarm/domain/phase-wiki';
import {
  defaultGatePhase,
  fieldSlotsForSkillTree,
  gateWindowSecs,
  resolveGatePhase,
  skillTreeGateRosterIds,
  wikiGateLines,
} from '@bombfarm/domain/skill-tree';
import { FARM_OPTIMIZE_FIXTURE, loadFarmRateFixture } from './helpers/farm-rate-fixtures';

describe('skill-tree gate helpers', () => {
  it('lists only wiki rows marked as gates, never inventing a phase number', () => {
    const gates = wikiGateLines();
    expect(gates.length).toBeGreaterThan(0);
    expect(gates.every((line) => line.gate === true)).toBe(true);
    expect(gates.map((line) => line.phase)).toEqual([...new Set(gates.map((line) => line.phase))].sort((a, b) => a - b));
  });

  it('defaults to the nearest gate at or after the farm phase, else the first gate', () => {
    const gates = wikiGateLines();
    const first = gates[0]!.phase;
    expect(defaultGatePhase(1)).toBe(first);
    expect(defaultGatePhase(first)).toBe(first);
    const later = gates.find((line) => line.phase > first);
    if (later) expect(defaultGatePhase(later.phase - 1)).toBe(later.phase);
    expect(defaultGatePhase(10_000)).toBe(first);
    expect(resolveGatePhase(first, 80)).toBe(first);
    expect(resolveGatePhase(3, 1)).toBe(first);
    expect(resolveGatePhase(null, 1)).toBe(first);
  });

  it('reads the act timer from GATE_SECS_POR_ATO for a gate phase', () => {
    const line = wikiGateLines()[0]!;
    expect(gateWindowSecs(line.phase)).toBe(GATE_SECS_POR_ATO[line.ato - 1]);
  });

  it('picks the rankRosterByDps set sized to field slots, not the full farm pool', () => {
    const fixture = loadFarmRateFixture(FARM_OPTIMIZE_FIXTURE);
    const { teamBuffs: _teamBuffs, ...account } = fixture.account;
    const enabledHeroIds = fixture.heroes.map((hero) => hero.id);
    const fieldSlots = 6;
    const ids = skillTreeGateRosterIds({
      heroes: fixture.heroes,
      account,
      enabledHeroIds,
      phase: defaultGatePhase(fixture.account.context.phase ?? 1),
      fieldSlots,
    });
    expect(ids).toHaveLength(fieldSlots);
    expect(ids).not.toHaveLength(enabledHeroIds.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect(fieldSlotsForSkillTree({ ...account, fieldSlots: 6 })).toBe(6);
    expect(fieldSlotsForSkillTree({ ...account, fieldSlots: null, slots: 3 })).toBe(3);
  });
});
