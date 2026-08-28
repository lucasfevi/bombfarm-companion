import catalog from '../data/catalog.json' with { type: 'json' };
import type { Lang } from '../shims/i18n';
import { formatItemDisplay } from '../game-labels';
import type {
  EquippedItem,
  GearBonuses,
  Loadout,
  ScaledValor,
  SheetOtherPct,
  Slot,
} from './types';

/** Forja upgrade: +0…+15. `upgrade_mult = 1 + 0.08 × N` (wiki itens.forja.bonus). */
export const FORJA_BONUS = 0.08;
export const FORJA_MAX = 15;
export const FORJA_LEVELS = Array.from({ length: FORJA_MAX + 1 }, (_, index) => index);

export const SLOTS: Slot[] = [...catalog.slots];
export const ITEM_LEVELS: number[] = [...catalog.levels];
export const ITEM_RARITIES = catalog.rarities;
export const SETS_BY_LEVEL: Record<string, string[]> = catalog.setsByLevel;

const defById = new Map(catalog.defs.map((definition) => [definition.id, definition]));

export function emptyLoadout(): Loadout {
  return Object.fromEntries(SLOTS.map((slot) => [slot, null]));
}

export function defsForSlot(slot: Slot, set?: string) {
  return catalog.defs.filter((definition) => definition.slot === slot && (set == null || definition.set === set));
}

export function setsForLevel(level: number): string[] {
  return SETS_BY_LEVEL[String(level)] ?? [];
}

export function upgradeMult(upgrade: number): number {
  const clampedUpgrade = Math.max(0, Math.min(FORJA_MAX, Math.round(upgrade)));
  return 1 + FORJA_BONUS * clampedUpgrade;
}

export function itemLabel(item: EquippedItem, lang: Lang = 'pt'): string {
  return formatItemDisplay(item, lang);
}

/**
 * Scale valores (stored at definition.nativeLevel) to item level, then apply forja upgrade.
 * Flat Dano stays fractional (e.g. 96.25 × 1.8 = 173.25) — the sheet sums the
 * raw values; ceil was overstating attack by 0.5 per half-point piece.
 *
 * Dano is flat at EVERY item level again (2026-08-15 patch — "o dano dos itens voltou a
 * funcionar de forma mais direta"). Catalog v4's second regime, in which a nv50+ roll was a
 * fraction of the hero's Attack, is gone: the wiki payload no longer publishes
 * `itens.dmg_pct_min_level`, and every `nivel_mult` row now carries a `dmg_flat` on the one
 * ladder (19.25 × mult, through nv300). `unit` stays on the return shape because
 * {@link GearBonuses} still separates a flat Dano term from the percent stats.
 */
export function scaledValores(defId: string, rarityIdx: number, level: number, upgrade = 0) {
  const definition = defById.get(defId);
  if (!definition) return [] as ScaledValor[];
  const nativeMult = (catalog.nivelMult as Record<string, number>)[String(definition.nativeLevel)] ?? 1;
  const itemMult = (catalog.nivelMult as Record<string, number>)[String(level)] ?? nativeMult;
  const forja = upgradeMult(upgrade);
  const scale = (itemMult / nativeMult) * forja;
  const count = ITEM_RARITIES[rarityIdx]?.statCount ?? 1;
  return definition.valores.slice(0, count).map((roll): ScaledValor => {
    if (roll.stat !== 'dmg') return { stat: roll.stat, valor: roll.valor * scale, unit: 'pct' };
    return { stat: roll.stat, valor: roll.valor * scale, unit: 'flat' };
  });
}

/**
 * `catalog.json`'s `statBase.crit` / `statBase.cooldown` (and every def's stored `crit` /
 * `cooldown` `valor`) carry the 2026-08-18 rescale: `0.00112704` → `0.00644023` and
 * `0.00098361` → `0.00936771` — the ROUNDED values, not the raw `×40/7` / `×200/21` fractions
 * (`0.006440228571428571` / `0.009367714285714285`), because the game's own save exports store
 * the rounded figures verbatim: every crit/cooldown item stat's pre-forja `value` field across
 * both committed post-2026-08-18 captures (`save-20260818-12heroes.json`,
 * `save-20260819-respec-crit-cdr.json`) matches `statBase × nivelMult[nativeLevel]` at this
 * rounded base to zero residual — a level-20 item reads 0.01288046 crit, a level-30 item reads
 * 0.02810313 cooldown, and so on for every native level present, with no exception. No other
 * `statBase` value differs anywhere in those items: dmg 19.25, energia 0.035, velocidade
 * 0.00077, sorte 0.0308, penetracao 0.14 all still match.
 *
 * This landed in the SAME patch as the crit-chance/CDR shape change, not a separate one: a
 * capture taken before the 2026-08-18 patch (see `docs/fixture-corpus.md`'s non-subject list)
 * still carries the old `0.00112704` / `0.00098361` values and their multiples. The catalog
 * rescale and the shape revert are one same-day boundary and cannot be usefully split into two
 * commits that each make sense on their own.
 */
export function sumGearBonuses(loadout: Loadout): GearBonuses {
  const totals: GearBonuses = {
    dmgFlat: 0,
    dmgPct: 0,
    energyPct: 0,
    speedPct: 0,
    luckPct: 0,
    critPct: 0,
    penPct: 0,
    cdrPct: 0,
  };
  for (const slot of SLOTS) {
    const equipped = loadout[slot];
    if (!equipped) continue;
    for (const { stat, valor, unit } of scaledValores(equipped.defId, equipped.rarityIdx, equipped.level, equipped.upgrade ?? 0)) {
      switch (stat) {
        case 'dmg':
          if (unit === 'pct') totals.dmgPct += valor;
          else totals.dmgFlat += valor;
          break;
        case 'energia':
          totals.energyPct += valor;
          break;
        case 'velocidade':
          totals.speedPct += valor;
          break;
        case 'sorte':
          totals.luckPct += valor;
          break;
        case 'crit':
          totals.critPct += valor;
          break;
        case 'penetracao':
          totals.penPct += valor;
          break;
        case 'cooldown':
          totals.cdrPct += valor;
          break;
      }
    }
  }
  return totals;
}

/**
 * attack = naked × (1 + Σ dmgPct) + Σ dmgFlat + points × atkPt
 *
 * `bonuses.dmgPct` is structurally 0 with the post-2026-08-15 catalog: no def carries a
 * percentage-of-Attack Dano roll any more (see {@link scaledValores}). The term is kept —
 * rather than deleted along with the regime — because it is the only inverse-safe place to
 * reintroduce one, and because {@link decomposeAttack} must stay the exact inverse of this
 * function for every historical loadout a stored planner draft can still hold.
 *
 * Catalog v4's ⚠ unconfirmed nv50+ assumption (whether spent attack points fell inside or
 * outside the product) is now MOOT rather than resolved — the regime it described no longer
 * exists in the game. See `docs/game-update-2026-08-15.md` §3.
 */
export function composeAttack(nakedAttack: number, bonuses: GearBonuses, flatPoints = 0): number {
  return nakedAttack * (1 + bonuses.dmgPct) + bonuses.dmgFlat + flatPoints;
}

/** Exact inverse of {@link composeAttack}; recovers naked attack from a sheet. */
export function decomposeAttack(attack: number, bonuses: GearBonuses, flatPoints = 0): number {
  const den = 1 + bonuses.dmgPct;
  const stripped = attack - bonuses.dmgFlat - flatPoints;
  return den > 1e-9 ? stripped / den : stripped;
}

/**
 * Absolute clone−current deltas in the same units as {@link GearBonuses}
 * (flat damage; percent stats as fractions). Used for Totals · Clone diffs.
 */
export function gearBonusDeltas(current: GearBonuses, alt: GearBonuses): GearBonuses {
  return {
    dmgFlat: alt.dmgFlat - current.dmgFlat,
    dmgPct: alt.dmgPct - current.dmgPct,
    energyPct: alt.energyPct - current.energyPct,
    speedPct: alt.speedPct - current.speedPct,
    luckPct: alt.luckPct - current.luckPct,
    critPct: alt.critPct - current.critPct,
    penPct: alt.penPct - current.penPct,
    cdrPct: alt.cdrPct - current.cdrPct,
  };
}

/** Scaled stat rolls for one equipped item (respects rarity stat count). */
export function itemValores(item: EquippedItem): ScaledValor[] {
  return scaledValores(item.defId, item.rarityIdx, item.level, item.upgrade ?? 0);
}

export function emptySheetOther(): SheetOtherPct {
  return { speed: 0, critChanceFlat: 0, critDmgFlat: 0, penetration: 0, cdr: 0 };
}

/**
 * Per-★ share of the intrinsic base — the wiki's own `gemas.mult_por_estrela`.
 *
 * **0.25, halved from the 0.5 measured in-game on 2026-07-23.** That measurement (two heroes
 * taken 0★→1★, one geared and one unequipped) was correct for its build; a later patch
 * compressed the whole curve, and the same patch cut every base drop rate, rescaled the hero XP
 * curve and the item-stat bases, and reshaped the gem rank draw into a per-difficulty matrix.
 * The scope did NOT change with it — see {@link starsMult}.
 *
 * Named rather than inlined so the value is greppable against the wiki field it mirrors: this
 * one went stale for over a week because a magic `0.5` in an arithmetic expression matches no
 * search anyone would think to run.
 */
export const STAR_MULT_PER_STAR = 0.25;

/** `gemas.max_estrelas` — the ritual's ceiling, and the clamp {@link starsMult} applies. */
export const MAX_STARS = 3;

/**
 * Gems→stars ritual (wiki "Gemas & Estrelas"): each ★ multiplies intrinsic sheet stats by
 * `1 + STAR_MULT_PER_STAR × ★` before items — Attack, Energy, Crit %, Crit Dmg, Penetration,
 * CDR, Luck. Speed is exempt (unequipped + geared sheets stay flat across ★).
 *
 * The SCOPE above is the 2026-07-23 in-game measurement and still stands; only the magnitude
 * moved (`STAR_MULT_PER_STAR`). The wiki agrees on both: it still calls Speed the one stat left
 * out, and still multiplies the intrinsic base — birth roll plus spent points — before items,
 * abilities and tree.
 *
 * Lives here (not naked-rescale.ts, its design "ships" home) because both `apply.ts`
 * and `naked-rescale.ts` call it; putting it in either would force the other to import
 * across the apply↔naked-rescale boundary the `rescaleCatalogApply` indirection exists
 * to avoid. `catalog.ts` is a shared downward dependency of both, so it stays cycle-free.
 */
export function starsMult(stars: number): number {
  return 1 + STAR_MULT_PER_STAR * Math.max(0, Math.min(MAX_STARS, Math.round(stars)));
}
