// ——— Abilities (Habilidades) ———
// 16-ability catalog from the wiki; known count at birth = rarity tier
// (Comum 1 → Mítico 6). 1 point/level shared with... no — abilities have their
// own points (1/level, same budget shown as "Pontos a Distribuir" in game).
// Ability effects are FLAT game units applied outside the sheet (confirmed by
// Ponta de Diamante "+2 de Penetração (pontos)" matching observed sheets).
import { critFactor } from './combat';
import { BASE_ROLLS, POINT_GAIN, type RarityKey } from './rarity-constants';

export type AbilityEffect =
  | { kind: 'drainPct'; perLevel: number } // − energy drain %
  /**
   * FLAT crit-chance percentage points per ability level — planner units, the same units as
   * `SheetStats.critChance` (`save crit_chance × 100`), so `perLevel: 2` moves the save's
   * `crit_chance` by `+0.02` per level. `onSheet` = the hero's own sheet Σ carries it.
   *
   * Supersedes the former `critChancePctOfBase` kind, which read the wiki's per-level entry as a
   * share of the hero's own crit-chance roll. The 2026-08-23 patch restated both crit-chance
   * abilities in POINTS ("Olho Clínico agora concede +40 pontos de Crítico e Presságio Mortal,
   * +20 pontos" at max rank) and the live save agrees exactly: Perrin (`olho_clinico` 13/20, no
   * gear, account 486 capture 2026-08-23 15:54) reads
   * `6.02142890221474 + 13 × 2 + 6.02142890221474 × 0.08042584275 = 32.5057073962346`, his
   * exported `crit_chance × 100` to the last digit. Solved across all 13 heroes on that capture,
   * flat fits every one at zero spent crit-chance points; percent-of-base fits none.
   *
   * The addend sits OUTSIDE the shared gear/points pool and outside the skill tree's base — the
   * pool multiplies the birth roll alone. Minato (gear crit +3.7869%) and Jon (+15.1474%) only
   * solve to integer points under that reading; folding the flat term into the pooled subtotal
   * leaves both at fractional negatives. Hence `SheetOtherPct.critChanceFlat` is held out in
   * `applyGear`/`applyPoints` and subtracted back off in `applySkillTree`'s `baseCritChance`.
   *
   * The crit-chance STAT POINT is untouched by this and remains a percentage of the roll
   * (`POINT_GAIN.critChancePctOfBase`, wiki `herois.ponto_inc` still 0.02) — the patch moved the
   * two abilities, not the point.
   */
  | { kind: 'critChanceFlat'; perLevel: number; onSheet?: boolean }
  | { kind: 'penetrationPp'; perLevel: number; onSheet?: boolean } // onSheet = raw Σ on hero sheet
  | { kind: 'rangeCells'; perLevel: number }
  | { kind: 'secondBlastPct'; perLevel: number } // chance of 2nd blast at 50% dmg
  | { kind: 'executePct'; perLevel: number } // executes rock below threshold
  | { kind: 'attackPct'; perLevel: number }
  | { kind: 'speedPct'; perLevel: number }
  | { kind: 'gateAttackPct'; perLevel: number } // attack bonus in timed phases only
  /**
   * FLAT crit-damage percentage points per ability level — planner units, the same units as
   * `SheetStats.critDmg` (`(save crit_dmg − 1) × 100`), so `perLevel: 4` moves the save's
   * `crit_dmg` multiplier by `+0.04` per level. Added to the sheet, NOT pooled multiplicatively
   * against the hero's roll.
   *
   * Supersedes the former `critDmgPctOfBase` kind (AD-BSP-32 / BSP-37d, DEC-05), which read the
   * wiki's "+4% dano crítico" as 4% *of the hero's crit-damage base*. The live save says
   * otherwise: Ivo (id `21076`, L38, `golpe_brutal` 20/20, account 11882 capture 2026-08-15) has
   * `birth_stats.crit_dmg` 1.45238210566148 and `stats.crit_dmg` 2.25238210566148 — a delta of
   * exactly `0.8 = 20 × 0.04`, flat. Percent-of-base would have given `20 × 0.04 × 1.45238`, i.e.
   * `2.6143`, and mis-attributing that residual to spent points inferred 50 points on a level-38
   * hero. Same flat shape as the crit-damage stat point (`POINT_GAIN.critDmgFlat`).
   */
  | { kind: 'critDmgFlat'; perLevel: number; onSheet?: boolean }
  | { kind: 'none' };

export interface AbilityDef {
  id: string;
  name: string;
  max: number;
  effectText: string;
  effect: AbilityEffect;
}

export const ABILITIES: AbilityDef[] = [
  { id: 'bateria_extra', name: 'Bateria Extra', max: 20, effectText: '−1% energia gasta (próprio)/nível', effect: { kind: 'drainPct', perLevel: 1 } },
  { id: 'caca_hero', name: 'Caça-Hero', max: 20, effectText: '+5% dano na Jaula/nível (não modelado)', effect: { kind: 'none' } },
  { id: 'marcha_acelerada', name: 'Marcha Acelerada', max: 20, effectText: '+0.185% velocidade do TIME/nível', effect: { kind: 'speedPct', perLevel: 0.185 } },
  // 2026-08-23 patch: +20 crit POINTS at max rank, i.e. +1 per level flat, matching the live
  // wiki's `habilidades[].per_level` of 0.01. Still PUBLISHED-BUT-UNOBSERVED, not measured: no
  // hero on any capture owns this ability, so no save export confirms the value directly —
  // Presságio never touches the bearer's own sheet either way (it is a TEAM aura, correctly
  // modelled with no `onSheet`). What the same patch DID let us measure is `olho_clinico` below,
  // whose published per-level entry moved to points in the same edit and whose flat shape the
  // capture pins exactly; taking this one's published value at face value is the same reading
  // applied to the same field of the same table.
  { id: 'pressagio_mortal', name: 'Presságio Mortal', max: 20, effectText: '+1 ponto de chance de crítico do TIME/nível (valor fixo)', effect: { kind: 'critChanceFlat', perLevel: 1 } },
  { id: 'fantasma', name: 'Fantasma', max: 20, effectText: 'atravessa rocha; +0.05% Ataque de passagem/nível (não modelado)', effect: { kind: 'none' } },
  { id: 'ponta_diamante', name: 'Ponta de Diamante', max: 20, effectText: '+1 Penetração (pontos)/nível', effect: { kind: 'penetrationPp', perLevel: 1, onSheet: true } },
  { id: 'misericordia', name: 'Misericórdia', max: 20, effectText: 'executa rocha < 1.25%/nível', effect: { kind: 'executePct', perLevel: 1.25 } },
  { id: 'explosao_ampla', name: 'Explosão Ampla', max: 20, effectText: '+0.1 raio da explosão/nível', effect: { kind: 'rangeCells', perLevel: 0.1 } },
  { id: 'contra_relogio', name: 'Contra o Relógio', max: 20, effectText: '+2% Ataque em fase de tempo/nível', effect: { kind: 'gateAttackPct', perLevel: 2 } },
  // 2026-08-23 patch: +40 crit POINTS at max rank, i.e. +2 per level flat (live wiki
  // `per_level` 0.01 → 0.02 in save units). MEASURED on account 486's 2026-08-23 15:54 export —
  // see the `critChanceFlat` kind for Perrin's exact reconstruction and why the addend sits
  // outside the gear/points pool.
  { id: 'olho_clinico', name: 'Olho Clínico', max: 20, effectText: '+2 pontos de chance de crítico/nível (valor fixo, altera atributos)', effect: { kind: 'critChanceFlat', perLevel: 2, onSheet: true } },
  { id: 'detonacao_dupla', name: 'Detonação Dupla', max: 20, effectText: '+1.5% chance de 2ª explosão (50% dano)/nível', effect: { kind: 'secondBlastPct', perLevel: 1.5 } },
  { id: 'folego_mineiro', name: 'Fôlego de Mineiro', max: 20, effectText: '−1% energia gasta do TIME/nível', effect: { kind: 'drainPct', perLevel: 1 } },
  { id: 'passagem_bastao', name: 'Passagem de Bastão', max: 20, effectText: '+4% de Dano ao ENTRAR no rodízio (dura 120s)/nível (não modelado)', effect: { kind: 'none' } },
  // 2026-08-23 patch restated the scope: it upgrades the drop of the hero that destroyed the
  // object, and does not apply to Jaulas. The per-level rate is unchanged (wiki 0.025).
  { id: 'olho_lapidador', name: 'Olho de Lapidador', max: 20, effectText: '+2.5% chance de subir a raridade do drop do herói que destruiu o objeto/nível (loot, não vale para Jaulas)', effect: { kind: 'none' } },
  { id: 'veia_ouro', name: 'Veia de Ouro', max: 20, effectText: '+2% ouro (próprio)/nível, +40% no teto (loot)', effect: { kind: 'none' } },
  { id: 'grito_guerra', name: 'Grito de Guerra', max: 20, effectText: '+1% Ataque do TIME/nível', effect: { kind: 'attackPct', perLevel: 1 } },
  { id: 'golpe_brutal', name: 'Golpe Brutal', max: 20, effectText: '+4% dano crítico/nível (valor fixo, altera atributos)', effect: { kind: 'critDmgFlat', perLevel: 4, onSheet: true } },
  { id: 'matilha', name: 'Matilha', max: 20, effectText: '+2% dano por aliado na rotação/nível, +40% no teto (não modelado)', effect: { kind: 'none' } },
  { id: 'fortuna', name: 'Fortuna', max: 20, effectText: '+0.5% ouro do TIME/nível, +10% no teto (loot, aura capada)', effect: { kind: 'none' } },
  { id: 'brecha', name: 'Brecha', max: 20, effectText: '+1 Penetração/nível, +20 no teto (herói na ficha: não comprovado)', effect: { kind: 'none' } },
];

/** Inventory-sheet abilities (shared Σ with gear) — kept out of the combat ability grid. */
export function isSheetAbility(ability: AbilityDef): boolean {
  return (
    (ability.effect.kind === 'critChanceFlat' ||
      ability.effect.kind === 'penetrationPp' ||
      ability.effect.kind === 'critDmgFlat') &&
    ability.effect.onSheet === true
  );
}

export const SHEET_ABILITIES = ABILITIES.filter(isSheetAbility);
export const COMBAT_ABILITIES = ABILITIES.filter((ability) => !isSheetAbility(ability));

export const ABILITY_QUOTA: Record<RarityKey, number> = {
  Comum: 1,
  Incomum: 2,
  Raro: 3,
  Épico: 4,
  Lendária: 5,
  Mítico: 6,
};

/** Every catalog ability caps at this rank (AD-BSP-18; save `abilities[].max` is 20 on 13/13 codes). */
export const ABILITY_LEVEL_MAX = 20;

/**
 * Spendable ability-point budget (AD-BSP-23). `ability_points_total === level` (points
 * *granted*), but spendable is capped by slots: `min(level, quota × 20)`. Points past the
 * cap are granted and permanently unusable — e.g. Bram L49 → 40 spendable, 9 dead; a Mítico
 * hero (6 slots × 20 = 120 needed) can never fully max at the L100 level cap (AD-BSP-23a).
 */
export function abilityPointBudget(rarity: RarityKey, level: number): number {
  return Math.min(level, ABILITY_QUOTA[rarity] * ABILITY_LEVEL_MAX);
}

export interface AbilityMods {
  /** <1 reduces drain — SELF only (Bateria Extra). Fôlego de Mineiro is a team aura: it never
   *  touches a hero's own mods at all — see the module doc on team auras below. */
  drainMult: number;
  /** Olho Clínico — FLAT crit-chance percentage points (planner units), already on the hero
   *  sheet. Feeds `SheetOtherPct.critChanceFlat` as an addend held OUTSIDE the shared pool. */
  sheetCritChanceFlat: number;
  /** Ponta de Diamante etc. — raw Σ units on the unequipped sheet (+2 per level). */
  sheetPenetrationRaw: number;
  penetrationPp: number;
  /** Golpe Brutal — FLAT crit-damage percentage points (planner units), already on the hero
   *  sheet. Feeds `SheetOtherPct.critDmgFlat` as an addend, NOT a pool fraction. */
  sheetCritDmgFlat: number;
  rangeCells: number;
  dmgMult: number; // second blast + execute
  gateAttackMult: number; // applies only inside timed phases (self ability, Contra o Relógio)
}

/**
 * Team auras — Grito de Guerra (`attackPct`), Marcha Acelerada (`speedPct`), Fôlego de Mineiro
 * (`drainPct`) and Presságio Mortal (`critChanceFlat`, not `onSheet`) — never reach a
 * hero's own `AbilityMods` (issue #132). Under the confirmed rule a team aura is a property of
 * the FIELD: every deployed hero experiences the SAME capped roster total (`team-buffs.ts`,
 * `computeCombatMults`), carrier or not, so there is no "this hero's own share" for `abilityMods`
 * to fold in — doing so was exactly the double-count this rewrite removed. Their four
 * `AbilityEffect` cases below are explicit no-ops rather than omitted, so a future kind added to
 * the union still forces every switch in this file to handle it.
 */
export function abilityMods(levels: Record<string, number>): AbilityMods {
  const mods: AbilityMods = {
    drainMult: 1,
    sheetCritChanceFlat: 0,
    sheetPenetrationRaw: 0,
    penetrationPp: 0,
    sheetCritDmgFlat: 0,
    rangeCells: 0,
    dmgMult: 1,
    gateAttackMult: 1,
  };
  for (const ability of ABILITIES) {
    const count = levels[ability.id] ?? 0;
    if (count <= 0) continue;
    const effect = ability.effect;
    switch (effect.kind) {
      case 'drainPct':
        // Fôlego de Mineiro (team) — see the module doc above.
        if (ability.id !== 'folego_mineiro') mods.drainMult *= 1 - (effect.perLevel * count) / 100;
        break;
      case 'critChanceFlat':
        if (effect.onSheet) mods.sheetCritChanceFlat += effect.perLevel * count;
        // else: Presságio Mortal (team) — see the module doc above.
        break;
      case 'penetrationPp':
        if (effect.onSheet) mods.sheetPenetrationRaw += effect.perLevel * count;
        else mods.penetrationPp += effect.perLevel * count;
        break;
      case 'critDmgFlat':
        mods.sheetCritDmgFlat += effect.perLevel * count;
        break;
      case 'rangeCells':
        mods.rangeCells += effect.perLevel * count;
        break;
      case 'secondBlastPct':
        mods.dmgMult *= 1 + ((effect.perLevel * count) / 100) * 0.5;
        break;
      case 'executePct':
        mods.dmgMult *= 1 / (1 - (effect.perLevel * count) / 100);
        break;
      case 'attackPct':
        // Grito de Guerra (team) — see the module doc above.
        break;
      case 'speedPct':
        // Marcha Acelerada (team) — see the module doc above.
        break;
      case 'gateAttackPct':
        mods.gateAttackMult *= 1 + (effect.perLevel * count) / 100;
        break;
      case 'none':
        break;
    }
  }
  return mods;
}

export interface Milestone {
  label: string;
  critChance: number;
  critDmg: number;
  pointsNeeded: number;
  critMultiplier: number;
  reachableAtLevel: number | null;
}

/**
 * Crit milestone table: points needed to reach crit chance / crit dmg targets (points scale
 * off the base roll) and the resulting hit multiplier.
 *
 * BSPW4-07 (BSP-31a, AC-47): pass the hero's own **naked** `critChance`/`critDmg` (lv1 ★0,
 * planner units) as `base` to compute against the hero's actual birth roll. WITHOUT `base`,
 * this falls back to `BASE_ROLLS[rarity]` — a **rarity-average estimate**, not the hero's own
 * roll. A well-rolled hero (e.g. Bellatrix's crit chance 9.51 vs Raro's rarity midpoint 7) needs
 * a meaningfully different point count than the rarity average suggests.
 */
export function critMilestones(
  rarity: RarityKey,
  base: { critChance: number; critDmg: number } = BASE_ROLLS[rarity],
): Milestone[] {
  const targets: Array<[number, number]> = [
    [10, 100],
    [15, 150],
    [20, 200],
    [25, 250],
    [30, 300],
  ];
  return targets.map(([critChanceTarget, critDmgTarget]) => {
    const nCc = Math.max(0, Math.ceil((critChanceTarget / base.critChance - 1) / POINT_GAIN.critChancePctOfBase));
    const nCd = Math.max(0, Math.ceil((critDmgTarget - base.critDmg) / POINT_GAIN.critDmgFlat));
    const pts = nCc + nCd;
    return {
      label: `${critChanceTarget}% crit chance / +${critDmgTarget}% crit dmg`,
      critChance: critChanceTarget,
      critDmg: critDmgTarget,
      pointsNeeded: pts,
      critMultiplier: critFactor(critChanceTarget, critDmgTarget),
      reachableAtLevel: pts <= 99 ? pts + 1 : null, // 1 point per level from level 2
    };
  });
}
