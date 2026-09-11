import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { phaseLine } from '@bombfarm/domain/phases';
import type { AccountFidelity, AccountPayload, AccountView } from '@bombfarm/contracts';
import { buildOptimizerInputs, mitigationPctFor, optimizerDepKey } from './optimizer-inputs';

const NOW = '2026-08-12T00:00:00.000Z';

function resolvedFidelity(overrides: Partial<AccountFidelity> = {}): AccountFidelity {
  return {
    account: { status: 'resolved', capturedAt: NOW },
    heroes: { status: 'resolved', capturedAt: NOW },
    skills: { status: 'resolved', capturedAt: NOW },
    casa: { status: 'resolved', capturedAt: NOW },
    items: { status: 'resolved', capturedAt: NOW },
    ...overrides,
  };
}

function minimalRawHero(id: string, name = 'Hero') {
  const birth = {
    dmg: 100,
    energia: 100,
    speed: 50,
    crit_chance: 5,
    crit_dmg: 50,
    penetration: 0,
    cooldown_reduction: 0,
    luck: 0,
  };
  return { id, name, level: 10, rarity: 2, stars: 1, birth_stats: birth, stats: birth, stat_points_available: 0 };
}

function basePayload(fidelity: AccountFidelity = resolvedFidelity()): AccountPayload {
  return {
    account: { phase: 60, max_phase: 88, gold: 100 },
    heroes: [minimalRawHero('h1', 'Alpha')],
    skills: { totals: { dmg_static: 1.5, crit_dmg_mult: 1 } },
    casa: { active_casa: 1, levels: [10] },
    items: [{ id: 'i1', def_id: 'g1', rarity: 0, level: 1, upgrade: 0 }],
    fidelity,
  };
}

function viewOf(payload: AccountPayload): AccountView {
  return { payload, gameRunning: false, store: { status: 'ok', reason: null, binding: 'better-sqlite3' } };
}

const OFFLINE_FIXTURE = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'account-offline.json');

function offlineFixtureView(): AccountView {
  return viewOf(JSON.parse(readFileSync(OFFLINE_FIXTURE, 'utf8')) as AccountPayload);
}

function required<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}

describe('the per-section usability gate withholds rather than building from an untrusted section', () => {
  it.each(['account', 'heroes', 'skills', 'casa', 'items'] as const)(
    'a missing %s section withholds the whole record',
    (section) => {
      const payload = basePayload(resolvedFidelity({ [section]: { status: 'missing' } }));
      expect(buildOptimizerInputs(viewOf(payload), null)).toBeNull();
    },
  );
});

describe('no value is ever defaulted — a missing required input withholds', () => {
  it('withholds when the skill tree is absent', () => {
    const payload = { ...basePayload(), skills: undefined };
    expect(buildOptimizerInputs(viewOf(payload), null)).toBeNull();
  });

  // The parser resolves houseIdx and houseLevel together from `active_casa` — there is no save
  // shape where one resolves and the other does not, so one test covers both null-checks.
  it('withholds when the house index and level cannot be resolved (no active_casa)', () => {
    const payload = { ...basePayload(), casa: { levels: [10] } };
    expect(buildOptimizerInputs(viewOf(payload), null)).toBeNull();
  });

  it('withholds when the House recovery slots cannot be resolved (no casa block at all)', () => {
    const payload = { ...basePayload(), casa: undefined };
    expect(buildOptimizerInputs(viewOf(payload), null)).toBeNull();
  });
});

describe('the offline fixture maps to the package input record', () => {
  it('carries the fixture roster, gear pool and account facts', () => {
    const inputs = required(buildOptimizerInputs(offlineFixtureView(), null), 'expected inputs');
    expect(inputs.heroes).toHaveLength(13);
    expect(inputs.inventory.items).toHaveLength(137);
    expect(inputs.slots).toBe(9);
    expect(inputs.fieldSlots).toBe(9);
    expect(inputs.houseCycleSecs).toBe(840);
    expect(inputs.phase).toBe(51);
    expect(inputs.maxPhase).toBe(137);
  });

  it('carries no team-buffs override — the package derives auras from the roster', () => {
    const inputs = required(buildOptimizerInputs(offlineFixtureView(), null), 'expected inputs');
    expect('teamBuffsOverride' in inputs).toBe(false);
    expect('effectiveTeamBuffs' in inputs).toBe(false);
  });

  it('every hero id is the game\'s own id from the payload', () => {
    const payload = JSON.parse(readFileSync(OFFLINE_FIXTURE, 'utf8')) as AccountPayload;
    const inputs = required(buildOptimizerInputs(viewOf(payload), null), 'expected inputs');
    const rawIds = (payload.heroes as { id: string }[]).map((h) => h.id);
    expect(inputs.heroes.map((h) => h.id)).toEqual(rawIds);
  });
});

describe('farmChosenPhase is written verbatim', () => {
  it('passes null through', () => {
    const inputs = required(buildOptimizerInputs(viewOf(basePayload()), null), 'expected inputs');
    expect(inputs.farmChosenPhase).toBeNull();
  });

  it('passes a chosen phase through', () => {
    const inputs = required(buildOptimizerInputs(viewOf(basePayload()), 42), 'expected inputs');
    expect(inputs.farmChosenPhase).toBe(42);
  });
});

describe('mitigationPctFor', () => {
  it('is 1 for a null phase', () => {
    expect(mitigationPctFor(null)).toBe(1);
  });

  it('matches the web store\'s own rounding for a phase in the wiki table', () => {
    const line = required(phaseLine(51) ?? null, 'expected a wiki line for phase 51');
    expect(mitigationPctFor(51)).toBe(+(line.mitig * 100).toFixed(2));
  });

  it('is 1 for a phase the wiki table has no line for', () => {
    // phaseLine clamps any finite phase into its populated 1-600 range, so the only input that
    // reaches this fallback is one it cannot index at all.
    expect(mitigationPctFor(Number.NaN)).toBe(1);
  });
});

describe('optimizerDepKey', () => {
  it('is equal for the same view read twice', () => {
    const view = offlineFixtureView();
    const first = required(buildOptimizerInputs(view, null), 'expected inputs');
    const second = required(buildOptimizerInputs(view, null), 'expected inputs');
    expect(optimizerDepKey(first)).toBe(optimizerDepKey(second));
  });

  it('moves when a hero levels up', () => {
    const before = required(buildOptimizerInputs(viewOf(basePayload()), null), 'expected inputs');
    const leveled = { ...basePayload(), heroes: [{ ...minimalRawHero('h1', 'Alpha'), level: 99 }] };
    const after = required(buildOptimizerInputs(viewOf(leveled), null), 'expected inputs');
    expect(optimizerDepKey(after)).not.toBe(optimizerDepKey(before));
  });

  it('does not move for a gold-only payload change', () => {
    const before = required(buildOptimizerInputs(viewOf(basePayload()), null), 'expected inputs');
    const goldChanged = { ...basePayload(), account: { phase: 60, max_phase: 88, gold: 999 } };
    const after = required(buildOptimizerInputs(viewOf(goldChanged), null), 'expected inputs');
    expect(optimizerDepKey(after)).toBe(optimizerDepKey(before));
  });

  it('does not move for a different farmChosenPhase', () => {
    const view = viewOf(basePayload());
    const withoutPhase = required(buildOptimizerInputs(view, null), 'expected inputs');
    const withPhase = required(buildOptimizerInputs(view, 42), 'expected inputs');
    expect(optimizerDepKey(withPhase)).toBe(optimizerDepKey(withoutPhase));
  });
});

describe('the mapper reads no storage', () => {
  it('the source file mentions no farm-view-storage import', () => {
    const source = readFileSync(path.join(__dirname, 'optimizer-inputs.ts'), 'utf8');
    expect(source.match(/farm-view-storage/g) ?? []).toHaveLength(0);
  });
});
