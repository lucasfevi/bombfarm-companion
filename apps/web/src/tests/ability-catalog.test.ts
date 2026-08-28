/**
 * Ability catalog sync (36, 36a, 37 family, 38) — W3.
 * Grows across T1 → T4 as the catalog completes; each task adds only the ACs it proves.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ABILITIES,
  COMBAT_ABILITIES,
  SHEET_ABILITIES,
  abilityMods,
  isSheetAbility,
} from '@bombfarm/domain/model';
import { TEAM_BUFF_PER_LEVEL } from '@bombfarm/domain/team-buffs';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

const root = resolve(__dirname, '../../../../packages/domain');
const readSrc = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const IDENTITY_MODS = {
  drainMult: 1,
  penetrationPp: 0,
  rangeCells: 0,
  dmgMult: 1,
  gateAttackMult: 1,
};

describe('catalog completeness (T2)', () => {
  it('ABILITIES has exactly 20 entries in slot order', () => {
    expect(ABILITIES.map((a) => a.id)).toEqual([
      'bateria_extra',
      'caca_hero',
      'marcha_acelerada',
      'pressagio_mortal',
      'fantasma',
      'ponta_diamante',
      'misericordia',
      'explosao_ampla',
      'contra_relogio',
      'olho_clinico',
      'detonacao_dupla',
      'folego_mineiro',
      'passagem_bastao',
      'olho_lapidador',
      'veia_ouro',
      'grito_guerra',
      'golpe_brutal',
      'matilha',
      'fortuna',
      'brecha',
    ]);
  });

  it('save slot === ABILITIES.findIndex(id) + 1 for every owned code in the fixture', () => {
    // Re-pointed onto payload-20260812-8heroes.json (the ground-truth rule's class (b) — structural).
    // RECORDED LOSS: the payload's 8 heroes own 11 distinct ability codes, not the deleted
    // fixture's 13 — two codes (of the 20-entry catalog) lose their in-fixture slot check.
    // The claim itself (slot === catalog index + 1) still re-points cleanly for every code
    // that IS owned. See docs/fixture-corpus.md.
    const raw = loadFixtureJson('payload-20260812-8heroes.json');
    const heroes = raw.heroes as Array<Record<string, unknown>>;
    const seen = new Map<string, number>();
    for (const hero of heroes) {
      const abilities = (hero.abilities as Array<Record<string, unknown>>) ?? [];
      for (const a of abilities) {
        const code = a.code as string;
        const slot = a.slot as number;
        if (!seen.has(code)) seen.set(code, slot);
      }
    }
    // Driven from the fixture, not a hand-copied list — 11/11 owned codes.
    expect(seen.size).toBe(11);
    for (const [code, slot] of seen) {
      const index = ABILITIES.findIndex((a) => a.id === code);
      expect(index, `${code} missing from ABILITIES`).toBeGreaterThanOrEqual(0);
      expect(index + 1, `${code}: catalog slot`).toBe(slot);
    }
  });

  it('brecha is { kind: none }, not penetrationPp — on-sheet status not proven', () => {
    const brecha = ABILITIES.find((a) => a.id === 'brecha');
    expect(brecha?.effect).toEqual({ kind: 'none' });
  });

  it("SHEET_ABILITIES is unchanged by the three new kind:'none' entries (re-asserted)", () => {
    expect(SHEET_ABILITIES.map((a) => a.id)).toEqual(['ponta_diamante', 'olho_clinico', 'golpe_brutal']);
  });
});

describe('rank-20 migration', () => {
  it('every AbilityDef.max is 20', () => {
    for (const a of ABILITIES) {
      expect(a.max, a.id).toBe(20);
    }
  });

  // Every row traces to a wiki citation; perLevel x 20 reproduces the wiki's
  // "total at cap" column exactly — including marcha_acelerada at 3.7, not the naive-halved 4.0.
  const MID_CURVE_ABILITIES: Array<{
    id: string;
    perLevel: number;
    wikiTotalAtCap: number;
    citation: string;
  }> = [
    { id: 'bateria_extra', perLevel: 1, wikiTotalAtCap: 20, citation: 'wiki ability table' },
    { id: 'marcha_acelerada', perLevel: 0.185, wikiTotalAtCap: 3.7, citation: 'wiki ability table' },
    // 2026-08-23 patch restated both crit-chance abilities in FLAT crit points, and the patch
    // note states the at-cap totals outright: "+40 pontos de Crítico" and "+20 pontos".
    {
      id: 'pressagio_mortal',
      perLevel: 1,
      wikiTotalAtCap: 20,
      citation: 'wiki habilidades 2026-08-23 (published; no capture owns this ability)',
    },
    { id: 'ponta_diamante', perLevel: 1, wikiTotalAtCap: 20, citation: 'wiki ability table' },
    { id: 'misericordia', perLevel: 1.25, wikiTotalAtCap: 25, citation: 'wiki ability table' },
    { id: 'explosao_ampla', perLevel: 0.1, wikiTotalAtCap: 2, citation: 'wiki ability table' },
    { id: 'contra_relogio', perLevel: 2, wikiTotalAtCap: 40, citation: 'wiki ability table' },
    {
      id: 'olho_clinico',
      perLevel: 2,
      wikiTotalAtCap: 40,
      citation: 'measured, account 486 2026-08-23 export',
    },
    { id: 'detonacao_dupla', perLevel: 1.5, wikiTotalAtCap: 30, citation: 'wiki ability table' },
    { id: 'folego_mineiro', perLevel: 1, wikiTotalAtCap: 20, citation: 'wiki ability table' },
    { id: 'grito_guerra', perLevel: 1, wikiTotalAtCap: 20, citation: 'wiki ability table' },
  ];

  it.each(MID_CURVE_ABILITIES)(
    '$id perLevel is $perLevel and x20 equals the wiki total at cap ($wikiTotalAtCap) — $citation',
    ({ id, perLevel, wikiTotalAtCap }) => {
      const def = ABILITIES.find((a) => a.id === id)!;
      expect(def.effect).toMatchObject({ perLevel });
      expect(perLevel * 20).toBeCloseTo(wikiTotalAtCap, 10);
    },
  );

  it('marcha_acelerada at rank 13 is 2.405, not the naive-halved 2.6', () => {
    // Marcha Acelerada is a team aura (issue #132) — abilityMods no longer folds it into a
    // hero's own mods at all; TEAM_BUFF_PER_LEVEL is the live rate the roster-wide total uses.
    expect(TEAM_BUFF_PER_LEVEL.marcha_acelerada * 13).toBeCloseTo(2.405, 10);
    // Naive halving (0.2 x 13 = 2.6) is outside tolerance of the correct 0.185 x 13 = 2.405.
    expect(TEAM_BUFF_PER_LEVEL.marcha_acelerada * 13).not.toBeCloseTo(2.6, 6);
  });

  it('every changed SELF ability at rank 13 matches perLevel x 13, not old-value x 13', () => {
    // Grito de Guerra, Marcha Acelerada, Fôlego de Mineiro and Presságio Mortal are team auras
    // (issue #132) — abilityMods no longer folds any of them into a hero's own mods, so they
    // are covered by TEAM_BUFF_PER_LEVEL (above) and the MID_CURVE_ABILITIES catalog check
    // instead of here. This test is now SELF abilities only.
    expect(abilityMods({ bateria_extra: 13 }).drainMult).toBeCloseTo(1 - 13 / 100, 10);
    expect(abilityMods({ ponta_diamante: 13 }).sheetPenetrationRaw).toBeCloseTo(13, 10);
    expect(abilityMods({ misericordia: 13 }).dmgMult).toBeCloseTo(1 / (1 - 16.25 / 100), 10);
    expect(abilityMods({ explosao_ampla: 13 }).rangeCells).toBeCloseTo(1.3, 10);
    expect(abilityMods({ contra_relogio: 13 }).gateAttackMult).toBeCloseTo(1.26, 10);
    expect(abilityMods({ olho_clinico: 13 }).sheetCritChanceFlat).toBeCloseTo(2 * 13, 10);
    expect(abilityMods({ detonacao_dupla: 13 }).dmgMult).toBeCloseTo(1 + (19.5 / 100) * 0.5, 10);
  });

  it('a hero\'s own rank in a team aura never touches that hero\'s own AbilityMods (issue #132)', () => {
    const mods = abilityMods({
      grito_guerra: 20,
      marcha_acelerada: 20,
      folego_mineiro: 20,
      pressagio_mortal: 20,
    });
    expect(mods).toMatchObject(IDENTITY_MODS);
  });

  it('rank 20 and a mid-curve rank both survive unclamped through abilityMods', () => {
    // explosao_ampla @20 exists in the fixture — proven by the storage round-trip test;
    // this checks the pure catalog math handles it without clamping.
    expect(abilityMods({ explosao_ampla: 20 }).rangeCells).toBeCloseTo(2, 10);
  });

  it('passagem_bastao is rank-20 damage-on-enter copy and stays unmodeled', () => {
    const def = ABILITIES.find((a) => a.id === 'passagem_bastao')!;
    expect(def.max).toBe(20);
    expect(def.effect).toEqual({ kind: 'none' });
    expect(def.effectText).toMatch(/4%/);
    expect(def.effectText).toMatch(/120/);
    expect(def.effectText).not.toMatch(/velocidade/i);
    expect(abilityMods({ passagem_bastao: 20 })).toMatchObject(IDENTITY_MODS);
  });

  it('caca_hero and fantasma keep { kind: none } — no numeric perLevel invented for uncaptured inputs', () => {
    const cacaHero = ABILITIES.find((a) => a.id === 'caca_hero')!;
    const fantasma = ABILITIES.find((a) => a.id === 'fantasma')!;
    expect(cacaHero.effect).toEqual({ kind: 'none' });
    expect(fantasma.effect).toEqual({ kind: 'none' });
  });
});

describe('golpe_brutal — critDmgFlat (flat crit damage, POINT_GAIN.critDmgFlat)', () => {
  it('is a rank-20 onSheet critDmgFlat ability with perLevel 4 (planner percentage points)', () => {
    const def = ABILITIES.find((a) => a.id === 'golpe_brutal');
    expect(def).toBeDefined();
    expect(def).toMatchObject({
      max: 20,
      effect: { kind: 'critDmgFlat', perLevel: 4, onSheet: true },
    });
  });

  it('abilityMods sheetCritDmgFlat is exact at rank 1 / 13 / 20 (flat planner pp)', () => {
    // Rank 20 must land on exactly 80 — the +0.8 `crit_dmg` delta observed on Ivo
    // (id 21076, L38, account 11882 capture 2026-08-15), in planner units.
    expect(abilityMods({ golpe_brutal: 1 }).sheetCritDmgFlat).toBe(4);
    expect(abilityMods({ golpe_brutal: 13 }).sheetCritDmgFlat).toBe(52);
    expect(abilityMods({ golpe_brutal: 20 }).sheetCritDmgFlat).toBe(80);
  });

  it('SHEET_ABILITIES is exactly ponta_diamante, olho_clinico, golpe_brutal', () => {
    expect(SHEET_ABILITIES.map((a) => a.id)).toEqual(['ponta_diamante', 'olho_clinico', 'golpe_brutal']);
  });

  it('COMBAT_ABILITIES does not contain golpe_brutal, asserted by name', () => {
    expect(COMBAT_ABILITIES.map((a) => a.id)).not.toContain('golpe_brutal');
  });

  it('golpe_brutal contributes to the sheet exactly once — every combat field stays at identity', () => {
    // isSheetAbility must recognize it directly (fails loudly if reverted to the old kind list — M1).
    const def = ABILITIES.find((a) => a.id === 'golpe_brutal')!;
    expect(isSheetAbility(def)).toBe(true);

    const mods = abilityMods({ golpe_brutal: 13 });
    expect(mods.sheetCritDmgFlat).toBe(52);
    expect(mods.drainMult).toBe(IDENTITY_MODS.drainMult);
    expect(mods.gateAttackMult).toBe(IDENTITY_MODS.gateAttackMult);
    expect(mods.penetrationPp).toBe(IDENTITY_MODS.penetrationPp);
    expect(mods.rangeCells).toBe(IDENTITY_MODS.rangeCells);
    expect(mods.dmgMult).toBe(IDENTITY_MODS.dmgMult);
  });

  // RECORDED LOSS (the ground-truth rule: "deleted, not weakened"): the real-fixture proof
  // (Korin, id 43040, golpe_brutal rank 1) needs a hero who OWNS golpe_brutal. Neither
  // post-patch corpus file has one — scanned exhaustively, no hero in
  // `save-20260813-5heroes.json` or `payload-20260812-8heroes.json` carries the code.
  // Unreproducible from the new corpus. The golpe_brutal MATH itself stays covered by the
  // synthetic tests above (catalog definition, abilityMods output, identity
  // of every other combat field) — only the real-save recomposition proof is lost. See
  // docs/fixture-corpus.md.
});

describe('sheetOther.critDmgFlat wiring — all four production builders', () => {
  // advisor-pipeline.ts is proven behaviorally in advisor-pipeline.test.ts.
  //
  // The other three builders feed `applyGear` (import-merge.ts, storage.ts) or `reverseSheet`
  // with ZERO_PTS_TEMPLATE (import-save.ts). `applyGear`'s critDmg field is a direct
  // `naked.critDmg` pass-through (items never roll crit damage — gear/apply.ts), and
  // `reverseSheet`'s crit-damage term subtracts `pts.critDmg × POINT_GAIN.critDmgFlat`,
  // which is 0 at zero spent points. So at today's call sites this is not a behavioral gap.
  // Wiring it anyway is still correct (the literal requirement, and defensive against a
  // future caller that does pass real points), so these three are guarded with a source
  // presence check rather than a false behavioral claim — disclosed, not silently assumed.
  it('import-save.ts reads mods.sheetCritDmgFlat into its sheetOther builder', () => {
    const src = readSrc('src/import-save.ts');
    expect(src).toMatch(/critDmgFlat:\s*mods\.sheetCritDmgFlat/);
  });

  it('import-merge.ts reads mods.sheetCritDmgFlat into its sheetOther builder', () => {
    const src = readSrc('src/import-merge.ts');
    expect(src).toMatch(/critDmgFlat:\s*mods\.sheetCritDmgFlat/);
  });

  it('storage.ts (migrateGearedOverride) reads mods.sheetCritDmgFlat into its sheetOther builder', () => {
    const src = readFileSync(
      resolve(__dirname, '../shared/lib/storage.ts'),
      'utf8',
    );
    expect(src).toMatch(/critDmgFlat:\s*mods\.sheetCritDmgFlat/);
  });
});
