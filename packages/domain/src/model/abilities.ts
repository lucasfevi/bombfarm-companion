// ——— Abilities (Habilidades) ———
// 16-ability catalog from the wiki; known count at birth = rarity tier
// (Comum 1 → Mítico 6). 1 point/level shared with... no — abilities have their
// own points (1/level, same budget shown as "Pontos a Distribuir" in game).
// Ability effects are FLAT game units applied outside the sheet (confirmed by
// Ponta de Diamante "+2 de Penetração (pontos)" matching observed sheets).
import { critFactor } from '@/shared/domain/model/combat';
import { BASE_ROLLS, POINT_GAIN, type RarityKey } from '@/shared/domain/model/rarity-constants';

export type AbilityEffect =
  | { kind: 'drainPct'; perLevel: number } // − energy drain %
  | { kind: 'critChancePctOfBase'; perLevel: number; onSheet?: boolean } // % of base roll; onSheet = hero sheet Σ
  | { kind: 'penetrationPp'; perLevel: number; onSheet?: boolean } // onSheet = raw Σ on hero sheet
  | { kind: 'rangeCells'; perLevel: number }
  | { kind: 'secondBlastPct'; perLevel: number } // chance of 2nd blast at 50% dmg
  | { kind: 'executePct'; perLevel: number } // executes rock below threshold
  | { kind: 'attackPct'; perLevel: number }
  | { kind: 'speedPct'; perLevel: number }
  | { kind: 'gateAttackPct'; perLevel: number } // attack bonus in timed phases only
  /** % of the hero's crit-damage BASE (the excess over 1.0), pooled with spent points.
   *  UNIT: fraction, not percent — 0.04 means +4%. Deliberately unlike
   *  `critChancePctOfBase` (percent, /100 at the consumer); matches `penetrationPp`'s
   *  raw-Σ convention on the sheet side. Locked verbatim by AD-BSP-32 / BSP-37d (DEC-05). */
  | { kind: 'critDmgPctOfBase'; perLevel: number; onSheet?: boolean }
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
  { id: 'pressagio_mortal', name: 'Presságio Mortal', max: 20, effectText: '+1% chance de crítico do TIME/nível (% da base)', effect: { kind: 'critChancePctOfBase', perLevel: 1 } },
  { id: 'fantasma', name: 'Fantasma', max: 20, effectText: 'atravessa rocha; +0.05% Ataque de passagem/nível (não modelado)', effect: { kind: 'none' } },
  { id: 'ponta_diamante', name: 'Ponta de Diamante', max: 20, effectText: '+1 Penetração (pontos)/nível', effect: { kind: 'penetrationPp', perLevel: 1, onSheet: true } },
  { id: 'misericordia', name: 'Misericórdia', max: 20, effectText: 'executa rocha < 1.25%/nível', effect: { kind: 'executePct', perLevel: 1.25 } },
  { id: 'explosao_ampla', name: 'Explosão Ampla', max: 20, effectText: '+0.1 raio da explosão/nível', effect: { kind: 'rangeCells', perLevel: 0.1 } },
  { id: 'contra_relogio', name: 'Contra o Relógio', max: 20, effectText: '+2% Ataque em fase de tempo/nível', effect: { kind: 'gateAttackPct', perLevel: 2 } },
  { id: 'olho_clinico', name: 'Olho Clínico', max: 20, effectText: '+0.75% chance de crítico/nível (% da base, altera atributos)', effect: { kind: 'critChancePctOfBase', perLevel: 0.75, onSheet: true } },
  { id: 'detonacao_dupla', name: 'Detonação Dupla', max: 20, effectText: '+1.5% chance de 2ª explosão (50% dano)/nível', effect: { kind: 'secondBlastPct', perLevel: 1.5 } },
  { id: 'folego_mineiro', name: 'Fôlego de Mineiro', max: 20, effectText: '−1% energia gasta do TIME/nível', effect: { kind: 'drainPct', perLevel: 1 } },
  { id: 'passagem_bastao', name: 'Passagem de Bastão', max: 10, effectText: '+3% Velocidade ao time que entra/nível (não modelado)', effect: { kind: 'none' } },
  { id: 'olho_lapidador', name: 'Olho de Lapidador', max: 20, effectText: '+2.5% chance de baú subir raridade/nível (loot)', effect: { kind: 'none' } },
  { id: 'veia_ouro', name: 'Veia de Ouro', max: 20, effectText: '+4% ouro/nível (loot)', effect: { kind: 'none' } },
  { id: 'grito_guerra', name: 'Grito de Guerra', max: 20, effectText: '+1% Ataque do TIME/nível', effect: { kind: 'attackPct', perLevel: 1 } },
  { id: 'golpe_brutal', name: 'Golpe Brutal', max: 20, effectText: '+4% dano crítico/nível (% da base, altera atributos)', effect: { kind: 'critDmgPctOfBase', perLevel: 0.04, onSheet: true } },
  { id: 'matilha', name: 'Matilha', max: 20, effectText: '+2% dano por aliado na rotação/nível, +40% no teto (não modelado)', effect: { kind: 'none' } },
  { id: 'fortuna', name: 'Fortuna', max: 20, effectText: '+2% ouro ganho/nível, +40% no teto (loot, aura capada)', effect: { kind: 'none' } },
  { id: 'brecha', name: 'Brecha', max: 20, effectText: '+1 Penetração/nível, +20 no teto (herói na ficha: não comprovado)', effect: { kind: 'none' } },
];

/** Inventory-sheet abilities (shared Σ with gear) — kept out of the combat ability grid. */
export function isSheetAbility(ability: AbilityDef): boolean {
  return (
    (ability.effect.kind === 'critChancePctOfBase' ||
      ability.effect.kind === 'penetrationPp' ||
      ability.effect.kind === 'critDmgPctOfBase') &&
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
  drainMult: number; // <1 reduces drain
  /** Olho Clínico etc. — already in the unequipped sheet Σ. */
  sheetCritChancePctOfBase: number;
  /** Presságio (own) etc. — combat-only, not on the inventory sheet. */
  combatCritChancePctOfBase: number;
  /** Ponta de Diamante etc. — raw Σ units on the unequipped sheet (+2 per level). */
  sheetPenetrationRaw: number;
  penetrationPp: number;
  /** Golpe Brutal — fraction of the crit-damage base, already on the hero sheet.
   *  Feeds SheetOtherPct.critDmg with NO /100 (DEC-05). */
  sheetCritDmgPctOfBase: number;
  rangeCells: number;
  dmgMult: number; // second blast + execute
  attackMult: number;
  speedMult: number;
  gateAttackMult: number; // applies only inside timed phases
}

export function abilityMods(levels: Record<string, number>): AbilityMods {
  const mods: AbilityMods = {
    drainMult: 1,
    sheetCritChancePctOfBase: 0,
    combatCritChancePctOfBase: 0,
    sheetPenetrationRaw: 0,
    penetrationPp: 0,
    sheetCritDmgPctOfBase: 0,
    rangeCells: 0,
    dmgMult: 1,
    attackMult: 1,
    speedMult: 1,
    gateAttackMult: 1,
  };
  for (const ability of ABILITIES) {
    const count = levels[ability.id] ?? 0;
    if (count <= 0) continue;
    const effect = ability.effect;
    switch (effect.kind) {
      case 'drainPct':
        mods.drainMult *= 1 - (effect.perLevel * count) / 100;
        break;
      case 'critChancePctOfBase':
        if (effect.onSheet) mods.sheetCritChancePctOfBase += effect.perLevel * count;
        else mods.combatCritChancePctOfBase += effect.perLevel * count;
        break;
      case 'penetrationPp':
        if (effect.onSheet) mods.sheetPenetrationRaw += effect.perLevel * count;
        else mods.penetrationPp += effect.perLevel * count;
        break;
      case 'critDmgPctOfBase':
        mods.sheetCritDmgPctOfBase += effect.perLevel * count;
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
        mods.attackMult *= 1 + (effect.perLevel * count) / 100;
        break;
      case 'speedPct':
        mods.speedMult *= 1 + (effect.perLevel * count) / 100;
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
    const nCd = Math.max(0, Math.ceil((critDmgTarget / base.critDmg - 1) / POINT_GAIN.critDmgPctOfBase));
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
