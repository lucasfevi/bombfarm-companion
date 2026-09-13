import { describe, expect, it } from 'vitest';
import { judgeStoredSection } from './stale-sections.js';

/** A post-patch `skills.totals` — every current key. */
function cleanTotals(): Record<string, unknown> {
  return {
    team_dmg_add: 1,
    crit_chance_add: 1,
    crit_dmg_add: 1,
    speed_add: 1,
    coin_add: 1,
    luck_add: 1,
    energia_add: 1,
    xp_mult: 1,
    geo_mult: 1,
    dmg_static: 1,
    vagas_campo: 1,
    bag_tabs_bonus: 1,
  };
}

/** A post-patch `skills` section body — matches `SECTION_FINGERPRINTS.skills` exactly. */
function cleanSkillsBody(totals: Record<string, unknown> = cleanTotals()): Record<string, unknown> {
  return {
    levels: { s1: 3 },
    refunds: {},
    field_slots: 5,
    bag_tabs: 2,
    gold: 100,
    max_phase: 50,
    totals,
  };
}

/** A post-patch `heroes` section element — matches `SECTION_FINGERPRINTS.heroes`'s element exactly. */
function cleanHero(): Record<string, unknown> {
  return {
    id: 'h1',
    name: 'Bellatrix',
    level: 1,
    xp: 0,
    rarity: 1,
    rank: 1,
    stars: 0,
    skin: 0,
    skin_birth: 0,
    in_field: true,
    battle_allowed: true,
    marketable: false,
    in_market: false,
    slots: {},
    stats: {},
    birth_stats: {},
    stat_ranges: {},
    abilities: {},
    ability_points_total: 0,
    ability_points_spent: 0,
    ability_reroll_cost: 0,
    ability_reroll_stone: 0,
    stat_points_available: 0,
  };
}

describe('judgeStoredSection', () => {
  it('does not drop a clean post-patch skills body', () => {
    expect(judgeStoredSection('skills', cleanSkillsBody())).toEqual({ drop: false });
  });

  it('does not drop a clean post-patch heroes body', () => {
    expect(judgeStoredSection('heroes', [cleanHero()])).toEqual({ drop: false });
  });

  it('does not drop an empty heroes array — not vacuous, a real mid-refresh state', () => {
    expect(judgeStoredSection('heroes', [])).toEqual({ drop: false });
  });

  it('an unrecognized skills.totals key drops, naming the path — presence, not truthiness', () => {
    const verdict = judgeStoredSection('skills', cleanSkillsBody({ ...cleanTotals(), retired_total: 0 }));
    expect(verdict.drop).toBe(true);
    if (!verdict.drop) throw new Error('unreachable');
    expect(verdict.triggers).toEqual(['skills.totals.retired_total']);
  });

  it('several unrecognized skills.totals keys are each named individually', () => {
    const verdict = judgeStoredSection(
      'skills',
      cleanSkillsBody({ ...cleanTotals(), retired_list: [], retired_base: 0, retired_mult: 1 }),
    );
    expect(verdict.drop).toBe(true);
    if (!verdict.drop) throw new Error('unreachable');
    expect(verdict.triggers).toContain('skills.totals.retired_list');
    expect(verdict.triggers).toContain('skills.totals.retired_base');
    expect(verdict.triggers).toContain('skills.totals.retired_mult');
  });

  it('the shape check is an ADDED-key check only: a skills body merely missing refunds is NOT dropped on shape alone', () => {
    // The rule: "neither [trigger] is 'the new keys are missing' — that's the export path's
    // question, not this one." A body missing a key the store never required is not, by itself,
    // evidence of staleness — plenty of this store's OWN test suite seeds partial bodies like
    // this deliberately, and none of that is retired-mechanic drift.
    const body = cleanSkillsBody();
    delete (body as { refunds?: unknown }).refunds;
    expect(judgeStoredSection('skills', body)).toEqual({ drop: false });
  });

  it('an unrecognized future key anywhere in the section also drops on shape alone', () => {
    const body = cleanSkillsBody();
    body.some_future_key = 'x';
    const verdict = judgeStoredSection('skills', body);
    expect(verdict.drop).toBe(true);
    if (!verdict.drop) throw new Error('unreachable');
    expect(verdict.triggers).toContain('skills.some_future_key');
  });

  it('the shape check is scoped to skills only: a heroes element with a missing OR an added key is never dropped on shape', () => {
    // The 2026-08-13 patch changed exactly one section's schema (skills). `heroes`/`casa`/
    // `items`/`account` never drifted, so their fingerprints are deliberately never consulted
    // here — checking them would only produce false positives against this codebase's own
    // long-standing partial/synthetic stored bodies elsewhere in the suite.
    const missingKey = cleanHero();
    delete (missingKey as { in_market?: unknown }).in_market;
    expect(judgeStoredSection('heroes', [cleanHero(), missingKey])).toEqual({ drop: false });

    const addedKey = { ...cleanHero(), some_future_hero_field: 'x' };
    expect(judgeStoredSection('heroes', [cleanHero(), addedKey])).toEqual({ drop: false });
  });

  it('PRE-CONTRACT STRUCTURAL TRIGGER: a stored casa body with no nested casa house object is dropped, naming casa.casa', () => {
    // A row written before `/rotation` started yielding its whole body holds the bare house
    // object directly — under the current contract that reads as a rotation body missing
    // field_size/heroes/rescues_left/rescues_max, so it is dropped rather than served as if it
    // were four-fifths of a rotation body.
    const verdict = judgeStoredSection('casa', {
      active_casa: 0,
      levels: [],
      cycle_secs: [],
      slots: 1,
      slots_per_house: [],
      cycle_secs_per_house: [],
      upgrade_cost: [],
    });
    expect(verdict.drop).toBe(true);
    if (!verdict.drop) throw new Error('unreachable');
    expect(verdict.triggers).toEqual(['casa.casa']);
  });

  it('PRE-CONTRACT STRUCTURAL TRIGGER is scoped to casa only — a non-casa section is never judged by it', () => {
    // `heroes`/`skills`/`items`/`account` never had a "whole body vs. one nested key" contract
    // change, so this structural check must never fire for them even when their body happens to
    // lack a `casa` key (which is every one of them, by construction).
    expect(judgeStoredSection('account', { phase: 1 })).toEqual({ drop: false });
    expect(judgeStoredSection('heroes', [{ id: 'h1' }])).toEqual({ drop: false });
  });

  it('a stored casa body carrying a nested casa object survives the structural check regardless of what else it is missing', () => {
    // Narrow, positive-only: this checks for the nested house object's PRESENCE, never at what
    // else the body lacks — a partial/synthetic stored casa row (this suite seeds several
    // elsewhere) with a nested `casa` key must not be falsely dropped.
    expect(judgeStoredSection('casa', { casa: { active_casa: 1 } })).toEqual({ drop: false });
  });

  it('triggers are path-qualified key names only, never a stored value', () => {
    const verdict = judgeStoredSection(
      'skills',
      cleanSkillsBody({ ...cleanTotals(), retired_total: 918273645 }),
    );
    expect(verdict.drop).toBe(true);
    if (!verdict.drop) throw new Error('unreachable');
    const payload = JSON.stringify(verdict.triggers);
    expect(payload).not.toContain('918273645');
  });
});
