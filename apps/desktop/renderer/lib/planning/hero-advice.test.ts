import { describe, expect, it } from 'vitest';
import type { AccountFidelity, AccountPayload, AccountView } from '@bombfarm/contracts';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { buildPlanningModel } from './account-model';
import { adviceForHero } from './hero-advice';

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

function rawHero(id: string, name = 'Hero') {
  const birth = {
    dmg: 200,
    energia: 300,
    speed: 40,
    crit_chance: 10,
    crit_dmg: 60,
    penetration: 2,
    cooldown_reduction: 1,
    luck: 0,
  };
  return {
    id,
    name,
    level: 20,
    rarity: 2,
    stars: 1,
    birth_stats: birth,
    stats: birth,
    stat_points_available: 0,
  };
}

function payload(fidelity: AccountFidelity, heroes = [rawHero('h1', 'Alpha')]): AccountPayload {
  return {
    account: { phase: 30 },
    heroes,
    skills: { totals: { dmg_static: 2.1, crit_dmg_mult: 1 } },
    casa: { active_casa: 1, levels: [10] },
    items: [],
    fidelity,
  };
}

function view(p: AccountPayload): AccountView {
  return { payload: p, gameRunning: false, store: { status: 'ok', reason: null, binding: 'better-sqlite3' } };
}

describe('adviceForHero — withhold gate', () => {
  it('withholds when skills is not usable, naming skills among the withheld sections', () => {
    const model = buildPlanningModel(view(payload(resolvedFidelity({ skills: { status: 'missing' } }))));
    const advice = adviceForHero(model, 'h1');
    expect(advice.withheld).toBe(true);
    if (advice.withheld) {
      expect(advice.sections.some((s) => s.section === 'skills')).toBe(true);
    }
  });

  it('withholds when items is not usable', () => {
    const model = buildPlanningModel(view(payload(resolvedFidelity({ items: { status: 'missing' } }))));
    const advice = adviceForHero(model, 'h1');
    expect(advice.withheld).toBe(true);
  });

  it("withholds this hero's advice only when candidate.blocked, even though every section is usable", () => {
    // No `stats` block ⇒ `parseAccountPayload` blocks the hero (cannot infer spent points).
    const blockedHeroPayload = {
      ...payload(resolvedFidelity()),
      heroes: [{ id: 'h1', name: 'Blocked', birth_stats: rawHero('h1').birth_stats }],
    };
    const model = buildPlanningModel(view(blockedHeroPayload));
    const [entry] = model.heroes;
    if (!entry) throw new Error('expected the blocked hero to still appear in the roster');
    expect(entry.blocked).toBe(true);
    const advice = adviceForHero(model, 'h1');
    expect(advice.withheld).toBe(true);
  });

  it('computes real advice, identical to a direct pipelineForHero call, when everything is usable', () => {
    const model = buildPlanningModel(view(payload(resolvedFidelity())));
    const advice = adviceForHero(model, 'h1');
    expect(advice.withheld).toBe(false);
    if (advice.withheld) throw new Error('expected advice to be computed, not withheld');

    const [entry] = model.heroes;
    if (!entry) throw new Error('expected at least one hero in the model');
    const { shared, phase, mitigationPct } = model;
    if (shared === null || phase === null || mitigationPct === null) {
      throw new Error('expected a fully usable account for this fixture');
    }

    const direct = pipelineForHero(entry.hero, shared, phase, mitigationPct);
    expect(advice.dps).toBe(direct.dps);
    expect(advice.ranking).toEqual(direct.ranking);
    expect(advice.best).toEqual(direct.best);
    expect(advice.resetAdvice).toEqual(direct.resetAdvice);
  });

  it('throws (never fabricates a Withheld) when asked for a heroId not in the model — a wiring bug, not an account-data problem', () => {
    const model = buildPlanningModel(view(payload(resolvedFidelity())));
    expect(() => adviceForHero(model, 'not-a-real-id')).toThrow();
  });
});
