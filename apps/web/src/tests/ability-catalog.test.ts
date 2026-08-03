/**
 * Ability catalog sync (BSP-32, -32a, -36, -36a, -37 family, -38) — W3.
 * Grows across T1 → T4 as the catalog completes; each task adds only the ACs it proves.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { starsMult } from '@bombfarm/domain/gear';
import {
  ABILITIES,
  COMBAT_ABILITIES,
  SHEET_ABILITIES,
  abilityMods,
  isSheetAbility,
} from '@bombfarm/domain/model';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

const root = resolve(__dirname, '../../../../packages/domain');
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
    const raw = loadFixtureJson('bellatrix-02-pts-each-1.json');
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
    // Driven from the fixture, not a hand-copied list — 13/13 owned codes (W0-14:159).
    expect(seen.size).toBe(13);
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
  it('AC-05: every AbilityDef.max is 20, except passagem_bastao (deferred to Wave 5, user override)', () => {
    for (const a of ABILITIES) {
      if (a.id === 'passagem_bastao') {
        expect(a.max, a.id).toBe(10); // deliberately untouched — see the dedicated test below
        continue;
      }
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
    { id: 'pressagio_mortal', perLevel: 1, wikiTotalAtCap: 20, citation: 'W0-14:203' },
    { id: 'ponta_diamante', perLevel: 1, wikiTotalAtCap: 20, citation: 'W0-14:205' },
    { id: 'misericordia', perLevel: 1.25, wikiTotalAtCap: 25, citation: 'W0-14:206' },
    { id: 'explosao_ampla', perLevel: 0.1, wikiTotalAtCap: 2, citation: 'W0-14:207' },
    { id: 'contra_relogio', perLevel: 2, wikiTotalAtCap: 40, citation: 'W0-14:208' },
    { id: 'olho_clinico', perLevel: 0.75, wikiTotalAtCap: 15, citation: 'W0-14:209' },
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
    expect(abilityMods({ pressagio_mortal: 13 }).combatCritChancePctOfBase).toBeCloseTo(13, 10);
    expect(abilityMods({ ponta_diamante: 13 }).sheetPenetrationRaw).toBeCloseTo(13, 10);
    expect(abilityMods({ misericordia: 13 }).dmgMult).toBeCloseTo(1 / (1 - 16.25 / 100), 10);
    expect(abilityMods({ explosao_ampla: 13 }).rangeCells).toBeCloseTo(1.3, 10);
    expect(abilityMods({ contra_relogio: 13 }).gateAttackMult).toBeCloseTo(1.26, 10);
    expect(abilityMods({ olho_clinico: 13 }).sheetCritChancePctOfBase).toBeCloseTo(9.75, 10);
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

  it('passagem_bastao is deferred entirely to Wave 5 — byte-identical to pre-wave (user override on DEC-01/AC-10)', () => {
    // AC-10 in spec.md asks for max: 20 and corrected damage/120s copy under DEC-01. A user
    // decision made after the spec was written overrides that: passagem_bastao is left
    // completely untouched this wave (max stays 10, effectText keeps the stale speed
    // wording) because modelling it properly needs casa.cycle_secs import (Wave 5) plus a
    // W0-12 trigger-cadence tooltip that does not exist yet. This is deliberate, not a
    // missed catalog entry — see spec.md's Assumptions & Decisions (DEC-01 residues) and
    // this test file's own header comment for the two known residues left in place.
    const def = ABILITIES.find((a) => a.id === 'passagem_bastao')!;
    expect(def.max).toBe(10);
    expect(def.effect).toEqual({ kind: 'none' });
    expect(def.effectText).toBe('+3% Velocidade ao time que entra/nível (não modelado)');
  });

  it('AC-09a: caca_hero and fantasma keep { kind: none } — no numeric perLevel invented for uncaptured inputs', () => {
    const cacaHero = ABILITIES.find((a) => a.id === 'caca_hero')!;
    const fantasma = ABILITIES.find((a) => a.id === 'fantasma')!;
    expect(cacaHero.effect).toEqual({ kind: 'none' });
    expect(fantasma.effect).toEqual({ kind: 'none' });
  });
});

describe('golpe_brutal — critDmgPctOfBase (T1, AD-BSP-32 / BSP-37d)', () => {
  it('AC-12: is a rank-20 onSheet critDmgPctOfBase ability with perLevel 0.04 (W0-14:216)', () => {
    const def = ABILITIES.find((a) => a.id === 'golpe_brutal');
    expect(def).toBeDefined();
    expect(def).toMatchObject({
      max: 20,
      effect: { kind: 'critDmgPctOfBase', perLevel: 0.04, onSheet: true },
    });
  });

  it('AC-13: abilityMods sheetCritDmgPctOfBase is exact at rank 1 / 13 / 20 (DEC-05 fraction unit)', () => {
    expect(abilityMods({ golpe_brutal: 1 }).sheetCritDmgPctOfBase).toBe(0.04);
    expect(abilityMods({ golpe_brutal: 13 }).sheetCritDmgPctOfBase).toBeCloseTo(0.52, 10);
    expect(abilityMods({ golpe_brutal: 20 }).sheetCritDmgPctOfBase).toBeCloseTo(0.8, 10);
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
    expect(mods.sheetCritDmgPctOfBase).toBe(0.52);
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

  it('AC-20: Korin (43040) rank-1 crit_dmg recomposes to <=1e-12, rejecting golpe=0 and flat +4pp', () => {
    const raw = loadFixtureJson('bellatrix-02-pts-each-1.json');
    const heroes = raw.heroes as Array<Record<string, unknown>>;
    const korin = heroes.find((h) => String(h.id) === '43040');
    expect(korin).toBeDefined();
    if (!korin) return;

    const birth = korin.birth_stats as Record<string, unknown>;
    const stats = korin.stats as Record<string, unknown>;
    const birthCritDmg = birth.crit_dmg as number;
    const stars = korin.stars as number;
    const saveCritDmg = stats.crit_dmg as number;
    const abilities = korin.abilities as Array<Record<string, unknown>>;
    const golpe = abilities.find((a) => a.code === 'golpe_brutal');
    expect(golpe?.level).toBe(1);

    const S = starsMult(stars);
    const hero = (birthCritDmg - 1) * S;

    // Reads the live catalog through abilityMods — sensitive to a mis-catalogued perLevel
    // (M2) or a broken accumulator (M3), not a hand-copied constant.
    const golpeLevel = Number(golpe?.level ?? 0);
    const sheetCritDmgPctOfBase = abilityMods({ golpe_brutal: golpeLevel }).sheetCritDmgPctOfBase;
    const predicted = 1 + hero * (1 + sheetCritDmgPctOfBase);
    expect(Math.abs(predicted - saveCritDmg)).toBeLessThanOrEqual(1e-12);

    // Rejected model 1: golpe = 0 (no ability contribution at all).
    const golpeZero = 1 + hero;
    expect(Math.abs(golpeZero - saveCritDmg)).toBeGreaterThan(1e-12);

    // Rejected model 2: flat +4 percentage points instead of ×1.04 on the Hero line.
    const flatFourPp = 1 + (hero * 100 + 4) / 100;
    expect(Math.abs(flatFourPp - saveCritDmg)).toBeGreaterThan(1e-12);
  });
});

describe('sheetOther.critDmg wiring — all four production builders (AC-17)', () => {
  // advisor-pipeline.ts is proven behaviorally in advisor-pipeline.test.ts (AC-17): its
  // sheetOther.critDmg is the only builder that is numerically load-bearing today, because
  // it is the sole caller that ever divides by `1 + sheetOther.critDmg` with a non-zero
  // crit-dmg point spend or tree bonus in play (derive.ts:148,158,169).
  //
  // The other three builders feed `applyGear` (import-merge.ts, storage.ts) or `reverseSheet`
  // with ZERO_PTS_TEMPLATE (import-save.ts). `applyGear`'s critDmg field is a direct
  // `naked.critDmg` pass-through (items never roll crit damage — gear/apply.ts), and
  // `reverseSheet`'s shared-pool division cancels exactly when the crit-dmg "gearPct" term
  // is zero: sharedReverse(geared, 0, otherPct) === geared for any otherPct (verified
  // numerically during authoring). So at today's call sites this is not a behavioral gap —
  // both the whole-value pass-through (applyGear) and the reverse-shared-pool math
  // (reverseSheet at zero spent points) are mathematically insensitive to sheetOther.critDmg.
  // Wiring it anyway is still correct (AC-17's literal requirement, and defensive against a
  // future caller that does pass real points), so these three are guarded with a source
  // presence check rather than a false behavioral claim — disclosed, not silently assumed.
  it('import-save.ts reads mods.sheetCritDmgPctOfBase into its sheetOther builder', () => {
    const src = readSrc('src/import-save.ts');
    expect(src).toMatch(/critDmg:\s*mods\.sheetCritDmgPctOfBase/);
  });

  it('import-merge.ts reads mods.sheetCritDmgPctOfBase into its sheetOther builder', () => {
    const src = readSrc('src/import-merge.ts');
    expect(src).toMatch(/critDmg:\s*mods\.sheetCritDmgPctOfBase/);
  });

  it('storage.ts (migrateGearedOverride) reads mods.sheetCritDmgPctOfBase into its sheetOther builder', () => {
    const src = readFileSync(
      resolve(__dirname, '../shared/lib/storage.ts'),
      'utf8',
    );
    expect(src).toMatch(/critDmg:\s*mods\.sheetCritDmgPctOfBase/);
  });
});
