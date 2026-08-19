/**
 * Ability catalog sync (BSP-32, -32a, -36, -36a, -37 family, -38) — W3.
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
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

const root = resolve(__dirname, '..');
const readSrc = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const IDENTITY_MODS = {
  drainMult: 1,
  combatCritChancePctOfBase: 0,
  penetrationPp: 0,
  rangeCells: 0,
  dmgMult: 1,
  attackMult: 1,
  speedMult: 1,
  gateAttackMult: 1,
};

describe('catalog completeness (T2, BSP-32 / BSP-32a)', () => {
  it('AC-01: ABILITIES has exactly 20 entries in slot order', () => {
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

  it('AC-02: save slot === ABILITIES.findIndex(id) + 1 for every owned code in the fixture', () => {
    // MP5 F1 (AD-068 class (b) — structural): re-pointed onto payload-20260812-8heroes.json.
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

  it('AC-09b: brecha is { kind: none }, not penetrationPp — on-sheet status not proven (W0-14:219, ASM-06)', () => {
    const brecha = ABILITIES.find((a) => a.id === 'brecha');
    expect(brecha?.effect).toEqual({ kind: 'none' });
  });

  it("AC-14 (re-asserted): SHEET_ABILITIES is unchanged by the three new kind:'none' entries", () => {
    expect(SHEET_ABILITIES.map((a) => a.id)).toEqual(['ponta_diamante', 'olho_clinico', 'golpe_brutal']);
  });
});

describe('rank-20 migration (T3, AD-BSP-18, BSPW3-02/-03)', () => {
  it('AC-05: every AbilityDef.max is 20', () => {
    for (const a of ABILITIES) {
      expect(a.max, a.id).toBe(20);
    }
  });

  // Every row traces to a W0-14 line citation; perLevel x 20 reproduces the wiki's
  // "total at cap" column exactly — including marcha_acelerada at 3.7, not the naive-halved 4.0.
  const MID_CURVE_ABILITIES: Array<{
    id: string;
    perLevel: number;
    wikiTotalAtCap: number;
    citation: string;
  }> = [
    { id: 'bateria_extra', perLevel: 1, wikiTotalAtCap: 20, citation: 'W0-14:200' },
    { id: 'marcha_acelerada', perLevel: 0.185, wikiTotalAtCap: 3.7, citation: 'W0-14:202' },
    // 2026-08-18 patch reverted both crit-chance abilities to percent-of-base and rescaled their
    // values by ×40/7 from the pre-2026-08-15 figures (see `abilities.ts`).
    {
      id: 'pressagio_mortal',
      perLevel: 5.714285714285714,
      wikiTotalAtCap: 114.28571428571428,
      citation: 'wiki habilidades 2026-08-18 (published; no capture owns this ability)',
    },
    { id: 'ponta_diamante', perLevel: 1, wikiTotalAtCap: 20, citation: 'W0-14:205' },
    { id: 'misericordia', perLevel: 1.25, wikiTotalAtCap: 25, citation: 'W0-14:206' },
    { id: 'explosao_ampla', perLevel: 0.1, wikiTotalAtCap: 2, citation: 'W0-14:207' },
    { id: 'contra_relogio', perLevel: 2, wikiTotalAtCap: 40, citation: 'W0-14:208' },
    {
      id: 'olho_clinico',
      perLevel: 4.285714285714286,
      wikiTotalAtCap: 85.71428571428571,
      citation: 'measured, account 486 2026-08-18 export',
    },
    { id: 'detonacao_dupla', perLevel: 1.5, wikiTotalAtCap: 30, citation: 'W0-14:210' },
    { id: 'folego_mineiro', perLevel: 1, wikiTotalAtCap: 20, citation: 'W0-14:211' },
    { id: 'grito_guerra', perLevel: 1, wikiTotalAtCap: 20, citation: 'W0-14:215' },
  ];

  it.each(MID_CURVE_ABILITIES)(
    'AC-08 / AC-08a ($citation): $id perLevel is $perLevel and x20 equals the wiki total at cap ($wikiTotalAtCap)',
    ({ id, perLevel, wikiTotalAtCap }) => {
      const def = ABILITIES.find((a) => a.id === id)!;
      expect(def.effect).toMatchObject({ perLevel });
      expect(perLevel * 20).toBeCloseTo(wikiTotalAtCap, 10);
    },
  );

  it('AC-08b: marcha_acelerada at rank 13 is 2.405, not the naive-halved 2.6', () => {
    const mods = abilityMods({ marcha_acelerada: 13 });
    expect(mods.speedMult).toBeCloseTo(1 + 2.405 / 100, 10);
    // Naive halving (0.2 x 13 = 2.6) is outside tolerance of the correct 0.185 x 13 = 2.405.
    expect(mods.speedMult).not.toBeCloseTo(1 + 2.6 / 100, 6);
  });

  it('AC-08b: every changed ability at rank 13 matches perLevel x 13, not old-value x 13', () => {
    expect(abilityMods({ bateria_extra: 13 }).drainMult).toBeCloseTo(1 - 13 / 100, 10);
    expect(abilityMods({ pressagio_mortal: 13 }).combatCritChancePctOfBase).toBeCloseTo(5.714285714285714 * 13, 10);
    expect(abilityMods({ ponta_diamante: 13 }).sheetPenetrationRaw).toBeCloseTo(13, 10);
    expect(abilityMods({ misericordia: 13 }).dmgMult).toBeCloseTo(1 / (1 - 16.25 / 100), 10);
    expect(abilityMods({ explosao_ampla: 13 }).rangeCells).toBeCloseTo(1.3, 10);
    expect(abilityMods({ contra_relogio: 13 }).gateAttackMult).toBeCloseTo(1.26, 10);
    expect(abilityMods({ olho_clinico: 13 }).sheetCritChancePctOfBase).toBeCloseTo(4.285714285714286 * 13, 10);
    expect(abilityMods({ detonacao_dupla: 13 }).dmgMult).toBeCloseTo(1 + (19.5 / 100) * 0.5, 10);
    expect(abilityMods({ folego_mineiro: 13 }).drainMult).toBeCloseTo(1 - 13 / 100, 10);
    expect(abilityMods({ grito_guerra: 13 }).attackMult).toBeCloseTo(1.13, 10);
  });

  it('AC-06 / BSP-38: rank 20 and a mid-curve rank both survive unclamped through abilityMods', () => {
    // explosao_ampla @20, marcha_acelerada @17 both exist in the fixture — see AC-25 for the
    // storage round-trip proof; this checks the pure catalog math handles both without clamping.
    expect(abilityMods({ explosao_ampla: 20 }).rangeCells).toBeCloseTo(2, 10);
    expect(abilityMods({ marcha_acelerada: 17 }).speedMult).toBeCloseTo(1 + (0.185 * 17) / 100, 10);
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

  it('AC-09a: caca_hero and fantasma keep { kind: none } — no numeric perLevel invented for uncaptured inputs', () => {
    const cacaHero = ABILITIES.find((a) => a.id === 'caca_hero')!;
    const fantasma = ABILITIES.find((a) => a.id === 'fantasma')!;
    expect(cacaHero.effect).toEqual({ kind: 'none' });
    expect(fantasma.effect).toEqual({ kind: 'none' });
  });

  it('veia_ouro and fortuna carry the wiki-corrected figures, stay { kind: none }, and abilityMods is the identity', () => {
    const veiaOuro = ABILITIES.find((a) => a.id === 'veia_ouro')!;
    const fortuna = ABILITIES.find((a) => a.id === 'fortuna')!;

    expect(veiaOuro.max).toBe(20);
    expect(veiaOuro.effect).toEqual({ kind: 'none' });
    expect(veiaOuro.effectText).toMatch(/\+2% ouro \(próprio\)/);
    expect(veiaOuro.effectText).toMatch(/\+40% no teto/);
    expect(veiaOuro.effectText).not.toMatch(/\+4% ouro\/nível/);

    expect(fortuna.max).toBe(20);
    expect(fortuna.effect).toEqual({ kind: 'none' });
    expect(fortuna.effectText).toMatch(/\+0\.5% ouro do TIME/);
    expect(fortuna.effectText).toMatch(/\+10% no teto/);
    expect(fortuna.effectText).not.toMatch(/\+2% ouro ganho/);
    expect(fortuna.effectText).not.toMatch(/\+40% no teto/);

    expect(abilityMods({ veia_ouro: 20, fortuna: 20 })).toMatchObject(IDENTITY_MODS);
  });

  it('olho_lapidador text is unchanged by the gold-ability copy fix', () => {
    const olhoLapidador = ABILITIES.find((a) => a.id === 'olho_lapidador')!;
    expect(olhoLapidador.effectText).toBe('+2.5% chance de baú subir raridade/nível (loot)');
  });
});

describe('golpe_brutal — critDmgFlat (flat crit damage, POINT_GAIN.critDmgFlat)', () => {
  it('AC-12: is a rank-20 onSheet critDmgFlat ability with perLevel 4 (planner percentage points)', () => {
    const def = ABILITIES.find((a) => a.id === 'golpe_brutal');
    expect(def).toBeDefined();
    expect(def).toMatchObject({
      max: 20,
      effect: { kind: 'critDmgFlat', perLevel: 4, onSheet: true },
    });
  });

  it('AC-13: abilityMods sheetCritDmgFlat is exact at rank 1 / 13 / 20 (flat planner pp)', () => {
    // Rank 20 must land on exactly 80 — the +0.8 `crit_dmg` delta observed on Ivo
    // (id 21076, L38, account 11882 capture 2026-08-15), in planner units.
    expect(abilityMods({ golpe_brutal: 1 }).sheetCritDmgFlat).toBe(4);
    expect(abilityMods({ golpe_brutal: 13 }).sheetCritDmgFlat).toBe(52);
    expect(abilityMods({ golpe_brutal: 20 }).sheetCritDmgFlat).toBe(80);
  });

  it('AC-14: SHEET_ABILITIES is exactly ponta_diamante, olho_clinico, golpe_brutal', () => {
    expect(SHEET_ABILITIES.map((a) => a.id)).toEqual(['ponta_diamante', 'olho_clinico', 'golpe_brutal']);
  });

  it('AC-15: COMBAT_ABILITIES does not contain golpe_brutal, asserted by name', () => {
    expect(COMBAT_ABILITIES.map((a) => a.id)).not.toContain('golpe_brutal');
  });

  it('AC-16: golpe_brutal contributes to the sheet exactly once — every combat field stays at identity', () => {
    // isSheetAbility must recognize it directly (fails loudly if reverted to the old kind list — M1).
    const def = ABILITIES.find((a) => a.id === 'golpe_brutal')!;
    expect(isSheetAbility(def)).toBe(true);

    const mods = abilityMods({ golpe_brutal: 13 });
    expect(mods.sheetCritDmgFlat).toBe(52);
    expect(mods.drainMult).toBe(IDENTITY_MODS.drainMult);
    expect(mods.attackMult).toBe(IDENTITY_MODS.attackMult);
    expect(mods.speedMult).toBe(IDENTITY_MODS.speedMult);
    expect(mods.gateAttackMult).toBe(IDENTITY_MODS.gateAttackMult);
    expect(mods.drainMult).toBe(IDENTITY_MODS.drainMult);
    expect(mods.combatCritChancePctOfBase).toBe(IDENTITY_MODS.combatCritChancePctOfBase);
    expect(mods.penetrationPp).toBe(IDENTITY_MODS.penetrationPp);
    expect(mods.rangeCells).toBe(IDENTITY_MODS.rangeCells);
    expect(mods.dmgMult).toBe(IDENTITY_MODS.dmgMult);
  });

  // MP5 F1 — RECORDED LOSS (AD-068 "deleted, not weakened"): AC-20's real-fixture proof
  // (Korin, id 43040, golpe_brutal rank 1) needs a hero who OWNS golpe_brutal. Neither
  // post-patch corpus file has one — scanned exhaustively, no hero in
  // `save-20260813-5heroes.json` or `payload-20260812-8heroes.json` carries the code.
  // Unreproducible from the new corpus. The golpe_brutal MATH itself stays covered by the
  // synthetic AC-12/AC-13/AC-16 tests above (catalog definition, abilityMods output, identity
  // of every other combat field) — only the real-save recomposition proof is lost. See
  // docs/fixture-corpus.md.
});

describe('sheetOther.critDmgFlat wiring — all four production builders (AC-17)', () => {
  // advisor-pipeline.ts is proven behaviorally in advisor-pipeline.test.ts (AC-17).
  //
  // The other three builders feed `applyGear` (import-merge.ts, storage.ts) or `reverseSheet`
  // with ZERO_PTS_TEMPLATE (import-save.ts). `applyGear`'s critDmg field is a direct
  // `naked.critDmg` pass-through (items never roll crit damage — gear/apply.ts), and
  // `reverseSheet`'s crit-damage term subtracts `pts.critDmg × POINT_GAIN.critDmgFlat`,
  // which is 0 at zero spent points. So at today's call sites this is not a behavioral gap.
  // Wiring it anyway is still correct (AC-17's literal requirement, and defensive against a
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

  // migrateGearedOverride lives in apps/web `storage.ts` — asserted there after T6 copy.
});
