import { describe, expect, it } from 'vitest';
import type { AccountFidelity, AccountPayload, AccountSection, AccountView, SectionStatus } from '@bombfarm/contracts';
import { deriveAccountFidelity } from '@bombfarm/domain/account-fidelity';
import { ADVICE_REQUIRES, buildPlanningModel, isUsable } from './account-model';

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
  return {
    id,
    name,
    level: 10,
    rarity: 2,
    stars: 1,
    birth_stats: birth,
    stats: birth,
    stat_points_available: 0,
  };
}

function basePayload(fidelity: AccountFidelity): AccountPayload {
  return {
    account: { phase: 60 },
    heroes: [minimalRawHero('h1', 'Alpha')],
    skills: { totals: { dmg_static: 1.5, crit_dmg_mult: 1 } },
    casa: { active_casa: 1, levels: [10] },
    items: [],
    fidelity,
  };
}

function store(overrides: Partial<AccountView['store']> = {}): AccountView['store'] {
  return { status: 'ok', reason: null, binding: 'better-sqlite3', ...overrides };
}

function view(payload: AccountPayload, storeOverrides: Partial<AccountView['store']> = {}): AccountView {
  return { payload, gameRunning: false, store: store(storeOverrides) };
}

function required<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}

describe('isUsable (AD-036)', () => {
  const cases: [SectionStatus, boolean][] = [
    ['resolved', true],
    ['stale', true],
    ['missing', false],
    ['degraded', false],
  ];
  it.each(cases)('status "%s" is usable=%s', (status, expected) => {
    expect(isUsable(status)).toBe(expected);
  });
});

describe('ADVICE_REQUIRES (AD-041 table)', () => {
  it('matches design.md §3 exactly', () => {
    expect(ADVICE_REQUIRES).toEqual({
      rosterRow: ['heroes'],
      gearSummary: ['heroes', 'items'],
      dps: ['heroes', 'items', 'skills', 'casa', 'account'],
      nextPointRanking: ['heroes', 'items', 'skills', 'casa', 'account'],
      resetAdvice: ['heroes', 'items', 'skills', 'casa', 'account'],
    });
  });
});

describe('buildPlanningModel has no React import (design §4)', () => {
  it('the source file does not import "react"', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.join(__dirname, 'account-model.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"]react['"]/);
  });
});

describe('availability (AD-036 six-row table)', () => {
  it('nothing-persisted when store.reason is "empty"', () => {
    const model = buildPlanningModel(view(basePayload(resolvedFidelity()), { reason: 'empty' }));
    expect(model.availability).toBe('nothing-persisted');
  });

  it('nothing-persisted when the payload carries no section at all', () => {
    const empty: AccountPayload = { fidelity: resolvedFidelity({ heroes: { status: 'missing' } }) };
    const model = buildPlanningModel(view(empty));
    expect(model.availability).toBe('nothing-persisted');
  });

  it('rejected when parseAccountPayload rejects (missingBirthStats), naming the reason not a generic empty roster', () => {
    // Deliberately malformed: no birth_stats.
    const payload = { ...basePayload(resolvedFidelity()), heroes: [{ id: 'h1', name: 'NoBirth' }] };
    const model = buildPlanningModel(view(payload));
    expect(model.availability).toBe('rejected');
    expect(model.rejected).toEqual({ reason: 'missingBirthStats', heroNames: ['NoBirth'] });
  });

  it('no-roster when heroes is not usable', () => {
    const payload = basePayload(resolvedFidelity({ heroes: { status: 'missing' } }));
    const model = buildPlanningModel(view(payload));
    expect(model.availability).toBe('no-roster');
  });

  it('no-roster when heroes is usable but zero candidates parsed', () => {
    const payload = { ...basePayload(resolvedFidelity()), heroes: [] };
    const model = buildPlanningModel(view(payload));
    expect(model.availability).toBe('no-roster');
  });

  it('store-unavailable when heroes usable but store.status is "unavailable" (edge case: still shows live-resolved advice)', () => {
    const model = buildPlanningModel(view(basePayload(resolvedFidelity()), { status: 'unavailable', reason: 'no_sqlite_binding' }));
    expect(model.availability).toBe('store-unavailable');
  });

  it('complete when all five sections are usable', () => {
    const model = buildPlanningModel(view(basePayload(resolvedFidelity())));
    expect(model.availability).toBe('complete');
  });

  it('partial when the roster is usable but at least one dependency section is not', () => {
    const payload = basePayload(resolvedFidelity({ skills: { status: 'missing' } }));
    const model = buildPlanningModel(view(payload));
    expect(model.availability).toBe('partial');
  });
});

describe("a fully-stale restored account is available, not unavailable (AD-036's resolution of the MPV-01/MPV-11 contradiction)", () => {
  it('deriveAccountFidelity grades "unavailable" while the model computes availability "partial"/"complete" from the same fidelity — see account-restart.spec.mjs:117-130, which already asserts this post-restart shape in CI', () => {
    const allStale: AccountFidelity = {
      account: { status: 'stale', capturedAt: NOW },
      heroes: { status: 'stale', capturedAt: NOW },
      skills: { status: 'stale', capturedAt: NOW },
      casa: { status: 'stale', capturedAt: NOW },
      items: { status: 'stale', capturedAt: NOW },
    };

    // The grade question and the availability question are not the same question (AD-036).
    expect(deriveAccountFidelity(allStale).grade).toBe('unavailable');

    const model = buildPlanningModel(view(basePayload(allStale), { status: 'ok', reason: null }));
    expect(['partial', 'complete']).toContain(model.availability);
    // All five sections are `stale`, which is usable — so this is the "complete" case in
    // practice: every dependency is present, just not live.
    expect(model.availability).toBe('complete');
    expect(model.shared).not.toBeNull();
  });
});

describe('candidate completion is the only synthesis performed (design §4.2)', () => {
  it('id = candidate.sourceId, stable across two builds of the same payload', () => {
    const payload = basePayload(resolvedFidelity());
    const first = buildPlanningModel(view(payload));
    const second = buildPlanningModel(view(payload));
    expect(first.heroes).toHaveLength(1);
    const firstEntry = required(first.heroes[0], 'expected a candidate');
    const secondEntry = required(second.heroes[0], 'expected a candidate');
    expect(firstEntry.hero.id).toBe('h1');
    expect(firstEntry.hero.id).toBe(secondEntry.hero.id);
  });

  it('updatedAt is derived from the heroes section capturedAt, never invented', () => {
    const payload = basePayload(resolvedFidelity());
    const model = buildPlanningModel(view(payload));
    const entry = required(model.heroes[0], 'expected a candidate');
    expect(entry.hero.updatedAt).toBe(Date.parse(NOW));
  });
});

describe('no DEFAULT_TREE()/DEFAULT_CONTEXT() — a null input withholds instead of falling back (design §4.3)', () => {
  it('shared is null when skills is not usable, even though heroes/items/casa/account all are', () => {
    const payload = basePayload(resolvedFidelity({ skills: { status: 'missing' } }));
    const model = buildPlanningModel(view(payload));
    expect(model.shared).toBeNull();
  });

  it('shared is null when casa is not usable', () => {
    const payload = basePayload(resolvedFidelity({ casa: { status: 'missing' } }));
    const model = buildPlanningModel(view(payload));
    expect(model.shared).toBeNull();
  });

  it('shared is null when account is not usable (phase unknown)', () => {
    const payload = basePayload(resolvedFidelity({ account: { status: 'missing' } }));
    const model = buildPlanningModel(view(payload));
    expect(model.shared).toBeNull();
    expect(model.phase).toBeNull();
  });

  it('shared is null when the skill tree itself is absent from the payload, even if fidelity claims skills resolved', () => {
    const payload = { ...basePayload(resolvedFidelity()), skills: undefined };
    const model = buildPlanningModel(view(payload));
    expect(model.shared).toBeNull();
  });

  it('mitigationPct is derived as phaseLine(phase).mitig * 100, never invented', async () => {
    const { phaseLine } = await import('@bombfarm/domain/phases');
    const payload = basePayload(resolvedFidelity());
    const model = buildPlanningModel(view(payload));
    const line = required(phaseLine(60), 'expected a phase line for phase 60');
    const expected = line.mitig * 100;
    expect(model.mitigationPct).toBeCloseTo(expected, 9);
  });
});

describe('sections are in ACCOUNT_SECTIONS order and carry capturedAt/missingKeys correctly (MPV-04, MPV-07, MPV-08)', () => {
  it('a degraded section surfaces missingKeys, distinct from a missing one', () => {
    const payload = basePayload(
      resolvedFidelity({
        skills: { status: 'degraded', capturedAt: NOW, missingKeys: ['totals.dmg_static'] },
      }),
    );
    const model = buildPlanningModel(view(payload));
    const skillsSection = required(model.sections.find((s) => s.section === 'skills'), 'expected a skills section');
    expect(skillsSection.status).toBe('degraded');
    expect(skillsSection.missingKeys).toEqual(['totals.dmg_static']);
    expect(skillsSection.usable).toBe(false);
  });

  it('a missing section has no capturedAt and no missingKeys', () => {
    const payload = basePayload(resolvedFidelity({ items: { status: 'missing' } }));
    const model = buildPlanningModel(view(payload));
    const itemsSection = required(model.sections.find((s) => s.section === 'items'), 'expected an items section');
    expect(itemsSection.capturedAt).toBeNull();
    expect(itemsSection.missingKeys).toEqual([]);
  });

  it('sections appear in ACCOUNT_SECTIONS order', () => {
    const payload = basePayload(resolvedFidelity());
    const model = buildPlanningModel(view(payload));
    const order: AccountSection[] = model.sections.map((s) => s.section);
    expect(order).toEqual(['account', 'heroes', 'skills', 'casa', 'items']);
  });
});
