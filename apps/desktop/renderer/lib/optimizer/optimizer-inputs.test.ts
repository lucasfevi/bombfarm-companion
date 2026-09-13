import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { phaseLine } from '@bombfarm/domain/phases';
import type { AccountFidelity, AccountPayload, AccountView } from '@bombfarm/contracts';
import { buildAccountRoster } from '../account/account-roster';
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

function offlineFixturePayload(): AccountPayload {
  return JSON.parse(readFileSync(OFFLINE_FIXTURE, 'utf8')) as AccountPayload;
}

function offlineFixtureView(): AccountView {
  return viewOf(offlineFixturePayload());
}

function required<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}

function requiredInputs(view: AccountView, farmChosenPhase: number | null) {
  return required(buildOptimizerInputs(view, farmChosenPhase), 'expected inputs').inputs;
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

// The checked-in fixture already carries eight heroes a sheet-inversion mismatch blocks (pinned
// in `account-roster.test.ts`) — five of its thirteen parse cleanly.
const FIXTURE_BLOCKED_IDS = ['41990', '52562', '45497', '72601', '73099', '74555', '76184', '59925-roster'];
const FIXTURE_SURVIVING_IDS = ['26863', '59925', '71038', '71128', '71129'];

describe('the offline fixture maps to the package input record', () => {
  it('carries the fixture roster, gear pool and account facts', () => {
    const inputs = requiredInputs(offlineFixtureView(), null);
    expect(inputs.heroes).toHaveLength(FIXTURE_SURVIVING_IDS.length);
    expect(inputs.inventory.items).toHaveLength(137);
    expect(inputs.slots).toBe(9);
    expect(inputs.fieldSlots).toBe(9);
    expect(inputs.houseCycleSecs).toBe(840);
    expect(inputs.phase).toBe(51);
    expect(inputs.maxPhase).toBe(137);
  });

  it('carries no team-buffs override — the package derives auras from the roster', () => {
    const inputs = requiredInputs(offlineFixtureView(), null);
    expect('teamBuffsOverride' in inputs).toBe(false);
    expect('effectiveTeamBuffs' in inputs).toBe(false);
  });

  it('every hero id in inputs.heroes is one of the payload\'s own, minus the ones left out', () => {
    const payload = offlineFixturePayload();
    const inputs = requiredInputs(viewOf(payload), null);
    expect(inputs.heroes.map((h) => h.id)).toEqual(FIXTURE_SURVIVING_IDS);
  });

  it('the fixture\'s own eight already-blocked heroes are named in leftOut', () => {
    const result = required(buildOptimizerInputs(offlineFixtureView(), null), 'expected a result');
    expect(result.leftOut.map((hero) => hero.id)).toEqual(FIXTURE_BLOCKED_IDS);
  });
});

function missingStatsRawHero(id: string, name: string): Record<string, unknown> {
  const hero: Record<string, unknown> = { ...minimalRawHero(id, name) };
  delete hero.stats;
  return hero;
}

describe('a hero whose spent points could not be read is left out of the search', () => {
  function payloadWithOneBlockedHero(): AccountPayload {
    return { ...basePayload(), heroes: [minimalRawHero('h1', 'Alpha'), missingStatsRawHero('h2', 'Beta')] };
  }

  it('names the hero in leftOut and drops it from inputs.heroes, keeping the clean one', () => {
    const result = required(buildOptimizerInputs(viewOf(payloadWithOneBlockedHero()), null), 'expected a result');
    expect(result.leftOut).toEqual([{ id: 'h2', name: 'Beta' }]);
    expect(result.inputs.heroes.map((hero) => hero.id)).toEqual(['h1']);
  });

  it('the excluded hero would otherwise have reached the solver with zero spent points', () => {
    // Documents WHY the exclusion is required: `buildAccountRoster` zeroes a blocked candidate's
    // `pts` (the sheet could not be inverted), so a search that saw it unfiltered would read a
    // levelled hero as one with nothing spent and propose spending it all over again.
    const view = viewOf(payloadWithOneBlockedHero());
    const roster = required(buildAccountRoster(view), 'expected a roster');
    const blockedHero = required(roster.heroes.find((hero) => hero.id === 'h2') ?? null, 'expected the blocked hero in heroes');
    const spentPoints = Object.values(blockedHero.pts).reduce((sum, value) => sum + value, 0);
    expect(spentPoints).toBe(0);

    const result = required(buildOptimizerInputs(view, null), 'expected a result');
    expect(result.inputs.heroes.some((hero) => hero.id === 'h2')).toBe(false);
  });

  it('a payload with no blocked hero yields an empty leftOut', () => {
    const payload = { ...basePayload(), heroes: [minimalRawHero('h1', 'Alpha')] };
    const result = required(buildOptimizerInputs(viewOf(payload), null), 'expected a result');
    expect(result.leftOut).toEqual([]);
  });

  it('the merged scope map never gains an entry for a left-out hero', async () => {
    const { mergeScopeForRoster } = await import('@bombfarm/team-plan/core');
    const result = required(buildOptimizerInputs(viewOf(payloadWithOneBlockedHero()), null), 'expected a result');
    const merged = mergeScopeForRoster([...result.inputs.heroes], { h2: 'donate' });
    expect('h2' in merged).toBe(false);
  });
});

describe('farmChosenPhase is written verbatim', () => {
  it('passes null through', () => {
    const inputs = requiredInputs(viewOf(basePayload()), null);
    expect(inputs.farmChosenPhase).toBeNull();
  });

  it('passes a chosen phase through', () => {
    const inputs = requiredInputs(viewOf(basePayload()), 42);
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
    const first = requiredInputs(view, null);
    const second = requiredInputs(view, null);
    expect(optimizerDepKey(first)).toBe(optimizerDepKey(second));
  });

  it('moves when a hero levels up', () => {
    const before = requiredInputs(viewOf(basePayload()), null);
    const leveled = { ...basePayload(), heroes: [{ ...minimalRawHero('h1', 'Alpha'), level: 99 }] };
    const after = requiredInputs(viewOf(leveled), null);
    expect(optimizerDepKey(after)).not.toBe(optimizerDepKey(before));
  });

  it('does not move for a gold-only payload change', () => {
    const before = requiredInputs(viewOf(basePayload()), null);
    const goldChanged = { ...basePayload(), account: { phase: 60, max_phase: 88, gold: 999 } };
    const after = requiredInputs(viewOf(goldChanged), null);
    expect(optimizerDepKey(after)).toBe(optimizerDepKey(before));
  });

  it('does not move for a different farmChosenPhase', () => {
    const view = viewOf(basePayload());
    const withoutPhase = requiredInputs(view, null);
    const withPhase = requiredInputs(view, 42);
    expect(optimizerDepKey(withPhase)).toBe(optimizerDepKey(withoutPhase));
  });

  it('takes only TeamPlanInputs, so a settled snapshot\'s leftOut can never move it', () => {
    // Structural, not a value comparison: leftOut is not a parameter of this function at all —
    // see `OptimizerSettledSnapshot` in `optimizer-snapshot-store.ts`, where leftOut is carried
    // beside the dep-keyed inputs rather than folded into them.
    expect(optimizerDepKey).toHaveLength(1);
  });
});

describe('the mapper reads no storage', () => {
  it('the source file mentions no farm-view-storage import', () => {
    const source = readFileSync(path.join(__dirname, 'optimizer-inputs.ts'), 'utf8');
    expect(source.match(/farm-view-storage/g) ?? []).toHaveLength(0);
  });
});
