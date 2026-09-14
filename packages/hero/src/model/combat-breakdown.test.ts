import { describe, expect, it } from 'vitest';
import { ABILITIES } from '@bombfarm/domain/model';
import { SHEET_DISPLAY_KEYS } from '@bombfarm/domain/planner-constants';
import { BREAKDOWN_DERIVED_IDS, buildStatBreakdown, type BreakdownStatId } from '@bombfarm/domain/stat-breakdown';
import { TEAM_BUFF_ABILITY_IDS, noTeamAuraSwitches } from '@bombfarm/domain/team-buffs';
import {
  COMBAT_BREAKDOWN_CARDS,
  COMBAT_BREAKDOWN_EDGES,
  COMBAT_BREAKDOWN_ROWS,
  cardBadgesFor,
  cardForAbility,
  cardInputChips,
  cardInputs,
  cardNoteFor,
  ledgerLines,
  matrixRowsFor,
  matrixShowsRunes,
} from './combat-breakdown';
import { factsForHero, fixtureHero, loadBreakdownFixture } from './combat-breakdown.test-fixture';

const fixture = loadBreakdownFixture();
const minato = fixtureHero(fixture, 'Minato');
const switchesOff = noTeamAuraSwitches();

describe('the pipeline\'s rows and wires', () => {
  it('draws every derived figure and every combat sheet stat exactly once — twenty cards', () => {
    expect(COMBAT_BREAKDOWN_CARDS.length).toBe(20);
    expect(new Set(COMBAT_BREAKDOWN_CARDS).size).toBe(20);
    for (const key of SHEET_DISPLAY_KEYS) expect(COMBAT_BREAKDOWN_CARDS).toContain(key);
    for (const id of BREAKDOWN_DERIVED_IDS) expect(COMBAT_BREAKDOWN_CARDS).toContain(id);
    expect(COMBAT_BREAKDOWN_CARDS).not.toContain('luck');
  });

  it('the four rows are Sheet, Factors, Per hit · cadence, DPS', () => {
    expect(COMBAT_BREAKDOWN_ROWS.map((row) => row.id)).toEqual(['sheet', 'factors', 'perHit', 'dps']);
    expect(COMBAT_BREAKDOWN_ROWS[3]?.cards).toEqual(['activeDps', 'sustainedDps']);
  });

  it('every wire joins two cards, never runs upward, and names an input the formula actually reads', () => {
    const rowOf = new Map<BreakdownStatId, number>();
    COMBAT_BREAKDOWN_ROWS.forEach((row, index) => row.cards.forEach((card) => rowOf.set(card, index)));
    const facts = factsForHero(fixture, minato);
    for (const edge of COMBAT_BREAKDOWN_EDGES) {
      expect(rowOf.has(edge.from), edge.from).toBe(true);
      expect(rowOf.has(edge.to), edge.to).toBe(true);
      expect(rowOf.get(edge.from)!, `${edge.from} → ${edge.to}`).toBeLessThanOrEqual(rowOf.get(edge.to)!);
      const target = buildStatBreakdown(edge.to, facts);
      expect(target.kind).toBe('formula');
      if (target.kind !== 'formula') return;
      const keys = target.parts.filter((part) => typeof part !== 'string').map((part) => part.key);
      const named = {
        attack: 'attack', energy: 'energy', speed: 'walk', critChance: 'critChance', critDmg: 'critDmg',
        penetration: 'penetration', cdr: 'cdr', mitF: 'mitF', dmg: 'dmg', critFactor: 'critFactor',
        fuse: 'fuse', fieldSeconds: 'field', rest: 'restSeconds', hit: 'hit', avgHit: 'avgHit',
        bombsPerSecond: 'bombs', uptime: 'field', activeDps: 'activeDps',
      }[edge.from];
      expect(keys, `${edge.to} reads ${edge.from} as ${named}`).toContain(named);
    }
  });

  it('Speed wires to Bombs/s, and the damage multiplier reaches Active DPS through Hit rather than twice', () => {
    expect(cardInputs('bombsPerSecond')).toEqual(['fuse', 'speed']);
    expect(cardInputs('hit')).toEqual(['attack', 'mitF', 'dmg']);
    expect(cardInputs('activeDps')).toEqual(['avgHit', 'bombsPerSecond']);
    expect(cardInputs('attack')).toEqual([]);
  });
});

describe('which card an ability lands on', () => {
  it('is decided by the catalog\'s effect kind, so every modelled ability has a card and the loot ones have none', () => {
    for (const ability of ABILITIES) {
      const card = cardForAbility(ability.id);
      if (ability.effect.kind === 'none') expect(card, ability.id).toBeNull();
      else expect(card, ability.id).not.toBeNull();
    }
    expect(cardForAbility('grito_guerra')).toBe('attack');
    expect(cardForAbility('marcha_acelerada')).toBe('speed');
    expect(cardForAbility('pressagio_mortal')).toBe('critChance');
    expect(cardForAbility('brecha')).toBe('penetration');
    expect(cardForAbility('detonacao_dupla')).toBe('dmg');
    expect(cardForAbility('misericordia')).toBe('dmg');
    expect(cardForAbility('matilha')).toBe('dmg');
    expect(cardForAbility('passagem_bastao')).toBe('dmg');
    expect(cardForAbility('folego_mineiro')).toBe('fieldSeconds');
    expect(cardForAbility('bateria_extra')).toBe('fieldSeconds');
    expect(cardForAbility('explosao_ampla')).toBe('activeDps');
    expect(cardForAbility('contra_relogio')).toBe('attack');
    expect(cardForAbility('no-such-ability')).toBeNull();
  });

  it('every team aura is badged on its card whether or not it is on, dimmed while its switch is off', () => {
    const off = cardBadgesFor({ abilities: {} }, 1, switchesOff);
    for (const buffId of TEAM_BUFF_ABILITY_IDS) {
      const card = cardForAbility(buffId)!;
      expect(off.get(card)?.find((badge) => badge.abilityId === buffId)?.on, buffId).toBe(false);
    }
    const on = cardBadgesFor({ abilities: {} }, 1, { ...switchesOff, folego_mineiro: true });
    expect(on.get('fieldSeconds')?.find((badge) => badge.abilityId === 'folego_mineiro')?.on).toBe(true);
    const carried = cardBadgesFor({ abilities: { grito_guerra: 3 } }, 1, switchesOff);
    expect(carried.get('attack')?.find((badge) => badge.abilityId === 'grito_guerra')?.on).toBe(true);
  });

  it('the hero\'s own abilities are badged lit, and Contra o Relógio only on a gate phase', () => {
    const hero = { abilities: { bateria_extra: 5, explosao_ampla: 2, contra_relogio: 4, veia_ouro: 20 } };
    const plain = cardBadgesFor(hero, 1, switchesOff);
    expect(plain.get('fieldSeconds')?.map((badge) => badge.abilityId)).toContain('bateria_extra');
    expect(plain.get('activeDps')?.map((badge) => badge.abilityId)).toEqual(['explosao_ampla']);
    expect(plain.get('attack')?.map((badge) => badge.abilityId)).not.toContain('contra_relogio');
    const gate = cardBadgesFor(hero, 10, switchesOff);
    expect(gate.get('attack')?.map((badge) => badge.abilityId)).toContain('contra_relogio');
    for (const badges of plain.values()) {
      expect(badges.map((badge) => badge.abilityId)).not.toContain('veia_ouro');
    }
  });

  it('a card\'s chips name the cards that feed it and then the abilities that land on it', () => {
    const hero = { abilities: { bateria_extra: 5 } };
    const badges = cardBadgesFor(hero, 1, switchesOff);
    const chips = cardInputChips('fieldSeconds', (id) => `label:${id}`, badges, 'en');
    expect(chips.map((chip) => chip.label)).toEqual(['label:energy', "Miner's Breath", 'Extra Battery']);
    const pt = cardInputChips('fieldSeconds', (id) => `label:${id}`, badges, 'pt');
    expect(pt.map((chip) => chip.label)).toEqual(['label:energy', 'Fôlego de Mineiro', 'Bateria Extra']);
    expect(chips.map((chip) => chip.on)).toEqual([true, false, true]);
  });
});

describe('the sheet-stat matrix', () => {
  const facts = factsForHero(fixture, minato);
  const rows = matrixRowsFor(facts, minato, switchesOff);

  it('has all seven combat sheet stats in sheet order, whatever the auras move', () => {
    expect(rows.map((row) => row.key)).toEqual([...SHEET_DISPLAY_KEYS]);
  });

  it('the Hero cell folds base, level, stars and points — the steps the game lists under Hero — and nothing else', () => {
    const attack = rows.find((row) => row.key === 'attack')!;
    const attackLedger = buildStatBreakdown('attack', facts);
    if (attackLedger.kind !== 'ledger') throw new Error('expected ledger');
    const heroSteps = attackLedger.steps.filter((step) => ['base', 'level', 'stars', 'points'].includes(step.source));
    expect(attack.hero.steps).toEqual(heroSteps);
    expect(attack.hero.steps.map((step) => step.source)).toContain('points');
    expect(attack.hero.steps.map((step) => step.source)).not.toContain('gear');
    let folded = 0;
    for (const step of heroSteps) folded = step.op === '×' ? folded * step.amount : folded + step.amount;
    expect(attack.hero.value).toBeCloseTo(folded, 6);
  });

  it('sheet total and effective are the pipeline\'s own adjusted and effective values', () => {
    for (const row of rows) {
      expect(row.sheetTotal).toBe(facts.adjusted[row.key]);
      expect(row.effective).toBe(facts.effective[row.key]);
    }
  });

  it('an aura the hero does not carry reads "off" on the stat it would move, and "—" elsewhere', () => {
    const attack = rows.find((row) => row.key === 'attack')!;
    expect(attack.aura).toEqual({ kind: 'off' });
    const energy = rows.find((row) => row.key === 'energy')!;
    expect(energy.aura).toEqual({ kind: 'none' });
    const pricedFacts = factsForHero(fixture, minato, { ...switchesOff, grito_guerra: true });
    const priced = matrixRowsFor(pricedFacts, minato, { ...switchesOff, grito_guerra: true });
    const cell = priced.find((row) => row.key === 'attack')!.aura;
    expect(cell.kind).toBe('step');
    if (cell.kind === 'step') expect(cell.step.amount).toBeCloseTo(1.2, 6);
  });

  it('the Rune column appears only while a rune is on the sheet', () => {
    expect(matrixShowsRunes(rows)).toBe(false);
  });

  it('a ledger\'s lines fold consecutive steps of one game line', () => {
    const attack = buildStatBreakdown('attack', facts);
    if (attack.kind !== 'ledger') throw new Error('expected ledger');
    const lines = ledgerLines(attack.steps);
    expect(lines[0]?.group).toBe('hero');
    const leadingHero = attack.steps.findIndex((step) => !['base', 'level', 'stars'].includes(step.source));
    expect(lines[0]?.steps).toEqual(attack.steps.slice(0, leadingHero));
    expect(lines[0]?.running).toBe(attack.steps[leadingHero - 1]?.running);
    expect(lines.at(-1)?.running).toBe(attack.steps.at(-1)?.running);
  });
});

describe('the notes a card carries', () => {
  const facts = factsForHero(fixture, minato);

  it('the Mitigation factor card reads the penetration verdict', () => {
    const note = cardNoteFor('mitF', facts, minato, switchesOff);
    expect(note?.kind).toBe('penetration');
    if (note?.kind !== 'penetration') return;
    const gap = facts.context.mitigation * 100 - facts.effective.penetration;
    if (gap > 0) {
      expect(note.reading.kind).toBe('short');
      if (note.reading.kind === 'short') expect(note.reading.gapPct).toBeCloseTo(gap, 6);
    } else {
      expect(note.reading).toEqual({ kind: 'covers' });
    }
  });

  it('the Fuse card says whether the ceiling is reached, with the floor and cap named', () => {
    const note = cardNoteFor('fuse', facts, minato, switchesOff);
    expect(note && (note.kind === 'fuseFloor' || note.kind === 'fuseAtCeiling')).toBe(true);
    if (!note || (note.kind !== 'fuseFloor' && note.kind !== 'fuseAtCeiling')) return;
    expect(note.floorSecs).toBe(0.4);
    expect(note.capPct).toBe(80);
    const capped = { ...facts, effective: { ...facts.effective, cdr: 80 } };
    expect(cardNoteFor('fuse', capped, minato, switchesOff)?.kind).toBe('fuseAtCeiling');
  });

  it('the Average hit card explains itself only when no hit can crit', () => {
    expect(cardNoteFor('avgHit', facts, minato, switchesOff)).toBeNull();
    const noCrit = { ...facts, effective: { ...facts.effective, critChance: 0 } };
    expect(cardNoteFor('avgHit', noCrit, minato, switchesOff)).toEqual({ kind: 'avgHitEqualsHit' });
  });

  it('the Field time card says what it would read without the team\'s Fôlego, only while Fôlego is on', () => {
    expect(cardNoteFor('fieldSeconds', facts, minato, switchesOff)).toBeNull();
    const on = { ...switchesOff, folego_mineiro: true };
    const withFolego = factsForHero(fixture, minato, on);
    const note = cardNoteFor('fieldSeconds', withFolego, minato, on);
    expect(note?.kind).toBe('fieldWithoutTeamDrain');
    if (note?.kind !== 'fieldWithoutTeamDrain') return;
    expect(note.seconds).toBeCloseTo(facts.effective.energy / facts.context.drainMult, 6);
    expect(note.seconds).toBeLessThan(withFolego.effective.energy / withFolego.context.drainMult);
  });

  it('a sheet card and the DPS cards carry no note', () => {
    for (const id of ['attack', 'energy', 'activeDps', 'sustainedDps'] as const) {
      expect(cardNoteFor(id, facts, minato, switchesOff), id).toBeNull();
    }
  });
});

describe('the Baton Pass switch on the pipeline', () => {
  it('lands on the Damage multiplier card as a named pulse term, and Hit moves with it', () => {
    const on = { ...switchesOff, passagem_bastao: true };
    const before = factsForHero(fixture, minato);
    const after = factsForHero(fixture, minato, on);
    expect(after.dmgMult).toBeGreaterThan(before.dmgMult);
    const dmg = buildStatBreakdown('dmg', after);
    const hit = buildStatBreakdown('hit', after);
    const plainHit = buildStatBreakdown('hit', before);
    if (dmg.kind !== 'formula' || hit.kind !== 'formula' || plainHit.kind !== 'formula') throw new Error('expected formulas');
    expect(dmg.parts.filter((part) => typeof part !== 'string').map((part) => part.key)).toContain('pulse');
    expect(dmg.value).toBeCloseTo(after.dmgMult, 9);
    expect(hit.value).toBeGreaterThan(plainHit.value);
    expect(cardBadgesFor(minato, fixture.phase, on).get('dmg')?.find((badge) => badge.abilityId === 'passagem_bastao')?.on).toBe(true);
    const offDmg = buildStatBreakdown('dmg', before);
    if (offDmg.kind !== 'formula') throw new Error('expected formula');
    expect(offDmg.parts.filter((part) => typeof part !== 'string').map((part) => part.key)).not.toContain('pulse');
  });
});

describe('the Damage multiplier card says how Baton Pass is counted', () => {
  it('carries the held-up note at the pulse’s percent while a pulse is on, and none without one', () => {
    expect(cardNoteFor('dmg', factsForHero(fixture, minato), minato, switchesOff)).toBeNull();
    const on = { ...switchesOff, passagem_bastao: true };
    const note = cardNoteFor('dmg', factsForHero(fixture, minato, on), minato, on);
    expect(note).toEqual({ kind: 'batonHeld', pct: expect.closeTo(80, 6) as number });
  });
});
