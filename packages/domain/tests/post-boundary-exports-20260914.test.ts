/**
 * The two 2026-09-14 save exports, the first SAVE-FILE captures past every regime boundary
 * (`payload-20260913-20heroes-runes.json` is past them too, but is an assembled payload, a
 * different root shape). One is the main account at phase 101; the other is the second account,
 * which is what keeps a cross-account claim cross-account now that its 2026-08-19 predecessor sits
 * behind the damage and penetration boundaries. See both manifest rows in
 * `fixtures/sheet-math/README.md` for what each may and may not prove.
 *
 * The claim pinned here is the one every value suite rests on: every hero imports with no issue,
 * inverts to whole-number points landing exactly on its budget, and composing those points back
 * reproduces the game's own exported sheet to float precision — including four Ponta de Diamante
 * owners (one held part-way, at rank 5), nine starred heroes, and gear from level 30 to 130.
 */
import { describe, expect, it } from 'vitest';
import { composeSheetFromBirth } from '@bombfarm/domain/birth-sheet';
import { parseSaveFile, type ImportCandidate } from '@bombfarm/domain/import-save';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { spentPointsOf } from '@bombfarm/domain/point-inference';
import { assertOptionalKeyWitnessedBothWays, checkSchema, EXPORT_FINGERPRINT } from '@bombfarm/domain/save-schema';
import { capSheetValue } from '@bombfarm/domain/sheet-view';
import { assertInRegime } from './helpers/capture-regime';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';

const SECOND_ACCOUNT = 'save-20260914-9heroes-second-account.json';
const MAIN_ACCOUNT = 'save-20260914-20heroes-phase101.json';

type RawHero = { name: string; abilities: { code: string; level: number }[]; stars: number; battle_allowed: boolean };

function budgetOf(candidate: ImportCandidate): number {
  return Math.max(0, candidate.level - (candidate.record.statPointsAvailable ?? 0));
}

function abilityRank(hero: RawHero, code: string): number | undefined {
  return hero.abilities.find((ability) => ability.code === code)?.level;
}

function loadExport(file: string) {
  assertInRegime(`sheet-math/${file}`, 'sheet');
  const raw = loadFixtureJson(file);
  return { raw, parsed: parseSaveFile(raw, []), heroes: raw.heroes as RawHero[] };
}

describe.each([
  { file: SECOND_ACCOUNT, rosterSize: 9 },
  { file: MAIN_ACCOUNT, rosterSize: 20 },
])('$file — the whole roster round-trips', ({ file, rosterSize }) => {
  const { raw, parsed } = loadExport(file);

  it('is a save export whose account block carries the placeholder identity keys, and still fingerprints ok', () => {
    expect(checkSchema(raw, EXPORT_FINGERPRINT)).toEqual({ ok: true });
    const account = raw.account as Record<string, unknown>;
    expect(typeof account.account_id).toBe('number');
    expect(typeof account.player_name).toBe('string');
  });

  it('imports every hero with no rejection, no warning and no blocked hero', () => {
    expect(parsed.rejected).toBeNull();
    expect(parsed.warnings).toEqual([]);
    expect(parsed.candidates).toHaveLength(rosterSize);
    expect(parsed.candidates.filter((c) => c.blocked).map((c) => c.name)).toEqual([]);
  });

  it('every hero inverts with no issue to exactly its spend budget', () => {
    for (const candidate of parsed.candidates) {
      expect(candidate.pointIssues, candidate.name).toEqual([]);
      expect(spentPointsOf(candidate.record.pts), candidate.name).toBe(budgetOf(candidate));
    }
  });

  it('composing the recovered points back reproduces the exported sheet to 1e-9 on every statistic', () => {
    const tree = treeTotalsFromSave((raw.skills as Record<string, unknown>).totals as Record<string, unknown>);
    for (const candidate of parsed.candidates) {
      const hero = extractHero(raw, candidate.name, candidate.level);
      const composed = composeSheetFromBirth({
        birth: hero.birth!,
        level: hero.level,
        stars: hero.stars,
        sheetOther: hero.sheetOther,
        loadout: hero.loadout,
        pts: candidate.record.pts,
        tree,
        runes: candidate.record.runes,
      });
      for (const key of SHEET_KEYS) {
        const observed = hero.sheet[key];
        const relative = Math.abs(capSheetValue(key, composed[key]) - observed) / Math.max(1, Math.abs(observed));
        expect(relative, `${candidate.name} L${candidate.level}.${key}`).toBeLessThan(1e-9);
      }
    }
  });
});

describe(`${SECOND_ACCOUNT} — what only the second account witnesses`, () => {
  const { parsed, heroes } = loadExport(SECOND_ACCOUNT);

  it('holds Ponta de Diamante on four heroes, one of them part-way at rank 5', () => {
    const ranks = heroes.map((hero) => [hero.name, abilityRank(hero, 'ponta_diamante')] as const).filter(([, rank]) => rank !== undefined);
    expect(ranks).toEqual([
      ['Lyra', 20],
      ['Dara', 20],
      ['Nyx', 5],
      ['Isolde', 20],
    ]);
  });

  it('Isolde carries her whole budget unspent: no gear, no points, and the inversion recovers zero', () => {
    const isolde = parsed.candidates.find((c) => c.name === 'Isolde')!;
    expect(isolde.level).toBe(67);
    expect(isolde.record.statPointsAvailable).toBe(67);
    expect(Object.values(isolde.record.loadout).filter(Boolean)).toEqual([]);
    expect(spentPointsOf(isolde.record.pts)).toBe(0);
  });
});

describe(`${MAIN_ACCOUNT} — what the thick main-account export witnesses`, () => {
  const { raw, parsed, heroes } = loadExport(MAIN_ACCOUNT);

  it('nine starred heroes, thirteen geared beside seven naked ones that are not battle-allowed', () => {
    expect(heroes.filter((hero) => hero.stars === 1)).toHaveLength(4);
    expect(heroes.filter((hero) => hero.stars === 2)).toHaveLength(5);
    const naked = parsed.candidates.filter((c) => Object.values(c.record.loadout).filter(Boolean).length === 0);
    expect(naked).toHaveLength(7);
    for (const candidate of naked) {
      expect(candidate.level, candidate.name).toBeLessThanOrEqual(24);
      expect(heroes.find((hero) => hero.name === candidate.name)?.battle_allowed, candidate.name).toBe(false);
    }
    expect(parsed.candidates.length - naked.length).toBe(13);
  });

  it('starred heroes spend real points on the crit and cooldown axes, and still reproduce', () => {
    const bellatrix = parsed.candidates.find((c) => c.name === 'Bellatrix')!;
    expect(bellatrix.record.pts.critChance).toBe(20);
    expect(bellatrix.record.pts.critDmg).toBe(69);
    const jon = parsed.candidates.find((c) => c.name === 'Jon')!;
    expect(jon.record.pts).toMatchObject({ critChance: 3, cdr: 11, critDmg: 47 });
  });

  it('two heroes share a name and both import', () => {
    expect(parsed.candidates.filter((c) => c.name === 'Torin').map((c) => c.level).sort((a, b) => a - b)).toEqual([45, 98]);
  });

  it('soulbound is witnessed both ways on items and on heroes', () => {
    assertOptionalKeyWitnessedBothWays(raw.items as Record<string, unknown>[], 'soulbound', 'save.items[].soulbound');
    assertOptionalKeyWitnessedBothWays(raw.heroes as Record<string, unknown>[], 'soulbound', 'save.heroes[].soulbound');
  });
});
