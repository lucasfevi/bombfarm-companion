/**
 * Roster-level team-aura acceptance tests (PR #139, judgement call #3). The old
 * `computeTeamBuffsFromDeployed(heroes, excludeHeroId)` excluded one hero from the stored
 * total, so which hero happened to be "active" when the total was computed changed the answer
 * every OTHER hero read. The fixed shape: the stored total excludes nobody, and a live editor
 * substitutes ONE hero's own contribution instead of excluding it.
 */
import { describe, expect, it } from 'vitest';
import { emptyLoadout, emptySheet } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import {
  combineTeamAuraPct,
  computeCombatMults,
} from '@bombfarm/domain/derive';
import { abilityMods } from '@bombfarm/domain/model';
import {
  TEAM_BUFF_CAP,
  computeTeamBuffsAroundHero,
  computeTeamBuffsFromDeployed,
  noTeamAuraSwitches,
  substituteHeroAbilities,
  teamAurasAroundHero,
  zeroTeamBuffs,
  type TeamBuffId,
} from '@bombfarm/domain/team-buffs';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';

function hero(id: string, abilities: Record<string, number>, deployed = true): HeroRecord {
  return {
    id,
    name: id,
    updatedAt: 0,
    rarity: 'Comum',
    level: 1,
    stars: 0,
    naked: emptySheet(),
    loadout: emptyLoadout(),
    altLoadout: null,
    gearedOverride: emptySheet(),
    abilities,
    pts: ZERO_PTS(),
    deployed,
  };
}

/** The total a hero standing in the field actually experiences, end to end. */
function experiencedPct(total: Record<TeamBuffId, number>, buffId: 'folego_mineiro' | 'grito_guerra') {
  const mults = computeCombatMults({ mods: abilityMods({}), teamBuffs: total, extraDmgPct: 0 });
  return buffId === 'folego_mineiro' ? (1 - mults.teamDrainMult) * 100 : (mults.attackMult - 1) * 100;
}

describe('computeTeamBuffsFromDeployed — the roster-wide total (PR #139)', () => {
  it('excludes nobody: sums every deployed hero, including whichever one a caller might otherwise call "active"', () => {
    const a = hero('a', { grito_guerra: 10 });
    const b = hero('b', { grito_guerra: 5, marcha_acelerada: 10 });
    const c = hero('c', { grito_guerra: 3 });
    const benched = hero('benched', { grito_guerra: 10 }, false);

    const result = computeTeamBuffsFromDeployed([a, b, c, benched]);

    // grito_guerra perLevel 1 -> (10+5+3)*1 = 18; benched excluded, nobody else is.
    expect(result.grito_guerra).toBe(18);
    // marcha_acelerada perLevel 0.185 -> 10*0.185 = 1.85
    expect(result.marcha_acelerada).toBeCloseTo(1.85, 6);
    expect(result.pressagio_mortal).toBe(0);
    expect(result.folego_mineiro).toBe(0);
    // contra_relogio is a self ability, not a team aura (Fault 1) — no key on the Record.
    expect('contra_relogio' in result).toBe(false);
  });

  it('stores the RAW, UNCAPPED sum — the cap applies once, at the combination site, not here', () => {
    const heroes = Array.from({ length: 5 }, (_, i) => hero(`h${i}`, { folego_mineiro: 20 }));
    const result = computeTeamBuffsFromDeployed(heroes);
    // 5 x 20 = 100, well past the cap (20) — stored uncapped so the UI field can show the true
    // total rather than silently rounding it off before the user ever sees it.
    expect(result.folego_mineiro).toBe(100);
    expect(combineTeamAuraPct(0, result.folego_mineiro, TEAM_BUFF_CAP.folego_mineiro)).toBe(
      TEAM_BUFF_CAP.folego_mineiro,
    );
  });

  it('returns all zeros with an empty or fully-benched roster', () => {
    const result = computeTeamBuffsFromDeployed([hero('a', { grito_guerra: 10 }, false)]);
    expect(Object.values(result).every((v) => v === 0)).toBe(true);
    expect(Object.values(computeTeamBuffsFromDeployed([])).every((v) => v === 0)).toBe(true);
  });
});

describe('acceptance: the field is a property of the roster, not of whichever hero is asking (PR #139)', () => {
  it('one carrier at rank 20 deployed alone receives 20', () => {
    const total = computeTeamBuffsFromDeployed([hero('a', { folego_mineiro: 20 })]);
    expect(experiencedPct(total, 'folego_mineiro')).toBeCloseTo(20, 6);
  });

  it('one carrier at rank 20 plus a non-carrier: BOTH receive 20', () => {
    const total = computeTeamBuffsFromDeployed([hero('carrier', { folego_mineiro: 20 }), hero('bystander', {})]);
    expect(experiencedPct(total, 'folego_mineiro')).toBeCloseTo(20, 6);
    // Nothing hero-specific enters this computation — computeCombatMults for the bystander
    // reads the exact same `total`, so there is only one number to check.
  });

  it('two carriers at rank 10 receive 20, matching one carrier at rank 20', () => {
    const twoRank10 = computeTeamBuffsFromDeployed([
      hero('a', { folego_mineiro: 10 }),
      hero('b', { folego_mineiro: 10 }),
    ]);
    const oneRank20 = computeTeamBuffsFromDeployed([hero('a', { folego_mineiro: 20 })]);
    expect(experiencedPct(twoRank10, 'folego_mineiro')).toBeCloseTo(20, 6);
    expect(experiencedPct(twoRank10, 'folego_mineiro')).toBeCloseTo(
      experiencedPct(oneRank20, 'folego_mineiro'),
      6,
    );
  });

  it('two carriers at rank 20 receive 20, not 40', () => {
    const total = computeTeamBuffsFromDeployed([
      hero('a', { folego_mineiro: 20 }),
      hero('b', { folego_mineiro: 20 }),
    ]);
    expect(experiencedPct(total, 'folego_mineiro')).toBeCloseTo(20, 6);
    expect(experiencedPct(total, 'folego_mineiro')).not.toBeCloseTo(40, 6);
  });

  it('REGRESSION: the computed total does not change depending on which hero is treated as "the one being edited"', () => {
    // The defect: the OLD computeTeamBuffsFromDeployed(heroes, excludeHeroId) excluded one
    // hero, so the total two OTHER heroes read depended on who that was. The new signature has
    // no such parameter — prove the total is identical no matter which of the roster's carriers
    // a caller happens to be editing right now, by round-tripping substituteHeroAbilities for
    // each in turn: substituting a hero's OWN unchanged ranks back into the roster total must
    // be a no-op, regardless of which hero that is.
    const a = hero('a', { grito_guerra: 20 });
    const b = hero('b', { grito_guerra: 20 });
    const total = computeTeamBuffsFromDeployed([a, b]);

    const asIfEditingA = substituteHeroAbilities(total, a.abilities, a.abilities);
    const asIfEditingB = substituteHeroAbilities(total, b.abilities, b.abilities);
    expect(asIfEditingA).toEqual(total);
    expect(asIfEditingB).toEqual(total);
    expect(asIfEditingA).toEqual(asIfEditingB);

    // And the pre-fix failure mode this replaces, spelled out: excluding "a" used to leave "b"
    // (and every other non-excluded hero) reading only 20 where the rule gives 40 (raw, capped
    // to the aura's 20 maximum either way here) — i.e. a completely different number depending
    // on who got excluded. The new shape has no exclusion left to reproduce that with.
    expect(total.grito_guerra).toBe(40); // raw roster sum: 20 (a) + 20 (b), uncapped
  });

  it('editor path: changing the edited hero’s own rank still moves that hero’s preview', () => {
    const roster = hero('active', { grito_guerra: 5 });
    const other = hero('other', { grito_guerra: 5 });
    const total = computeTeamBuffsFromDeployed([roster, other]); // 10 raw

    // Live-edit "active" from 5 to 15 without touching the persisted roster.
    const preview = substituteHeroAbilities(total, roster.abilities, { grito_guerra: 15 });
    expect(preview.grito_guerra).toBe(20); // 10 - 5 + 15
    expect(preview.grito_guerra).not.toBe(total.grito_guerra);

    const beforeMult = computeCombatMults({ mods: abilityMods({}), teamBuffs: total, extraDmgPct: 0 }).attackMult;
    const afterMult = computeCombatMults({ mods: abilityMods({}), teamBuffs: preview, extraDmgPct: 0 }).attackMult;
    expect(afterMult).toBeGreaterThan(beforeMult);
  });
});

describe('substituteHeroAbilities', () => {
  it('total - oldRank×perLevel + newRank×perLevel, per aura', () => {
    const total = { ...zeroTeamBuffs(), grito_guerra: 20, folego_mineiro: 15 };
    const result = substituteHeroAbilities(
      total,
      { grito_guerra: 5, folego_mineiro: 5 },
      { grito_guerra: 0, folego_mineiro: 10 },
    );
    expect(result.grito_guerra).toBe(15); // 20 - 5 + 0
    expect(result.folego_mineiro).toBe(20); // 15 - 5 + 10
    expect(result.marcha_acelerada).toBe(0);
    expect(result.pressagio_mortal).toBe(0);
  });

  it('floors each aura at 0 — never trusts a negative result from an out-of-sync total', () => {
    const total = { ...zeroTeamBuffs(), grito_guerra: 2 };
    // A hand-typed `total` that never actually counted this hero's rank 20 — subtracting it
    // would go negative without the floor.
    const result = substituteHeroAbilities(total, { grito_guerra: 20 }, {});
    expect(result.grito_guerra).toBe(0);
  });

  it('is a no-op when old and new ranks are identical (the "nothing changed" case)', () => {
    const total = { ...zeroTeamBuffs(), grito_guerra: 33, pressagio_mortal: 12 };
    const abilities = { grito_guerra: 7, pressagio_mortal: 3 };
    expect(substituteHeroAbilities(total, abilities, abilities)).toEqual(total);
  });
});

describe('teamAurasAroundHero — one aura from one hero’s seat', () => {
  it('splits own from others, counting only OTHER heroes the game will field', () => {
    const me = hero('me', { grito_guerra: 5 }, false);
    const roster = [
      me,
      hero('a', { grito_guerra: 20 }, false),
      { ...hero('b', { grito_guerra: 20 }), battleAllowed: false },
      hero('c', { folego_mineiro: 10 }),
    ];
    const around = teamAurasAroundHero(me, roster);
    expect(around.grito_guerra).toEqual({ own: 5, others: 20, carriers: 1 });
    expect(around.folego_mineiro).toEqual({ own: 0, others: 10, carriers: 1 });
    expect(around.pressagio_mortal).toEqual({ own: 0, others: 0, carriers: 0 });
  });

  it('ignores `deployed` entirely — the field as read is not what a hero’s detail prices', () => {
    const me = hero('me', {}, false);
    const benched = hero('a', { grito_guerra: 20 }, false);
    const fielded = hero('b', { grito_guerra: 20 }, true);
    expect(teamAurasAroundHero(me, [me, benched]).grito_guerra.others).toBe(20);
    expect(teamAurasAroundHero(me, [me, fielded]).grito_guerra.others).toBe(20);
  });

  it('counts the hero’s own rank whatever its own battleAllowed flag says', () => {
    const me = { ...hero('me', { folego_mineiro: 12 }), battleAllowed: false };
    expect(teamAurasAroundHero(me, [me]).folego_mineiro.own).toBe(12);
  });
});

describe('computeTeamBuffsAroundHero — the per-hero screen’s total', () => {
  const me = hero('me', { grito_guerra: 5 });
  const roster = [me, hero('a', { grito_guerra: 20 }), hero('b', { folego_mineiro: 20 })];

  it('with every switch off, only the hero’s own aura counts', () => {
    const total = computeTeamBuffsAroundHero(me, roster, noTeamAuraSwitches());
    expect(total).toEqual({ ...zeroTeamBuffs(), grito_guerra: 5 });
  });

  it('a switched-on aura adds every other carrier at FULL presence, uncapped like the snapshot', () => {
    const switches = { ...noTeamAuraSwitches(), grito_guerra: true };
    const total = computeTeamBuffsAroundHero(me, [...roster, hero('c', { grito_guerra: 20 })], switches);
    expect(total.grito_guerra).toBe(45);
    expect(total.folego_mineiro).toBe(0);
    expect(experiencedPct(total, 'grito_guerra')).toBeCloseTo(TEAM_BUFF_CAP.grito_guerra, 12);
  });

  it('switches are independent per aura', () => {
    const switches = { ...noTeamAuraSwitches(), folego_mineiro: true };
    const total = computeTeamBuffsAroundHero(me, roster, switches);
    expect(total).toEqual({ ...zeroTeamBuffs(), grito_guerra: 5, folego_mineiro: 20 });
  });

  it('a hero absent from the roster is still priced with its own aura', () => {
    const stranger = hero('stranger', { pressagio_mortal: 3 });
    const total = computeTeamBuffsAroundHero(stranger, roster, noTeamAuraSwitches());
    expect(total.pressagio_mortal).toBe(3);
  });

  it('substituteHeroAbilities still moves the hero’s own contribution inside this total', () => {
    const total = computeTeamBuffsAroundHero(me, roster, noTeamAuraSwitches());
    expect(substituteHeroAbilities(total, me.abilities, { grito_guerra: 9 }).grito_guerra).toBe(9);
  });
});
