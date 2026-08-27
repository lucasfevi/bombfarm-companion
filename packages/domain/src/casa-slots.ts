/**
 * Slot counts resolved from a save (RGO-3, ASM-S02).
 *
 * TWO DIFFERENT GAME CONCEPTS, two different keys — do not collapse them:
 *
 * - **House recovery slots** — `casa.slots`. How many heroes the House recovers AT A TIME.
 *   Heroes beyond that queue behind a full House at frozen energy (the bot's reference reader
 *   distinguishes them by `recovering === true`; a hero `in_casa` without it is queued, not
 *   filling). {@link resolveCasaSlots} reads this.
 * - **Field slots** — `skills.field_slots`. How many heroes may stand on the field AT ONCE.
 *   {@link resolveFieldSlots} reads this.
 *
 * They routinely disagree: account 486 carries `casa.slots: 3` against `skills.field_slots: 6`.
 * Reading one where the other is meant silently caps a 6-wide field at 3 (or lets 6 heroes
 * recover in a 3-slot House). `farm-rate.ts` did exactly the former until the House-ceiling fix.
 */

/** Per-house recovery-slot ladder, from the wiki's `rotacao.casas[].slots`. */
export const CASA_SLOTS_PER_HOUSE = [3, 5, 7, 9, 9] as const;

/** Casa III+ default when neither `casa.slots` nor `slots_per_house[houseIdx]` applies. */
export const DEFAULT_CASA_SLOTS = 9;

/** The most rest slots any House gives — the top of the {@link CASA_SLOTS_PER_HOUSE} ladder. */
export const CASA_SLOTS_MAX = Math.max(...CASA_SLOTS_PER_HOUSE);

/**
 * The widest the field can ever be, from the wiki's `rotacao.campo` (`skill_tree.field_size`
 * agrees, and the last `vagas_campo` node reads "campo cheio" at this count). The tree starts at
 * `field_base_slots: 1` and adds eight of those nodes; an account below this can still buy one.
 */
export const FIELD_SLOTS_MAX = 9;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampSlots(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.round(value);
}

/**
 * HOUSE RECOVERY slots — how many heroes the House refills simultaneously, NOT the field
 * concurrency cap (that is {@link resolveFieldSlots}).
 *
 * Three-tier ladder: `casa.slots` → `casa.slots_per_house[houseIdx]` → {@link DEFAULT_CASA_SLOTS}.
 * Result is always a finite integer >= 1.
 */
export function resolveCasaSlots(casa: unknown, houseIdx: number | null): number {
  if (isObject(casa)) {
    if ('slots' in casa) {
      const raw = casa.slots;
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return clampSlots(raw);
      }
    }

    const perHouse = Array.isArray(casa.slots_per_house) ? casa.slots_per_house : null;
    if (perHouse && houseIdx != null && houseIdx >= 0 && houseIdx < perHouse.length) {
      const tier = asNumber(perHouse[houseIdx], Number.NaN);
      if (Number.isFinite(tier) && tier > 0) {
        return clampSlots(tier);
      }
    }
  }

  return clampSlots(DEFAULT_CASA_SLOTS);
}

/**
 * FIELD slots — how many heroes may be deployed at once — from `skills.field_slots`.
 * `null` when the save does not carry the key, so a caller can keep its own fallback rather
 * than inherit an invented number here.
 *
 * `AD-063` convention, followed verbatim: the save carries BOTH `skills.field_slots` and
 * `skills.totals.vagas_campo` and they disagree (6 vs 5 on account 486, 3 vs 2 on the
 * 2026-08-13 export). This reader RECORDS `field_slots` and does not reconcile the pair —
 * `vagas_campo` is the skill tree's own purchased-node total, `field_slots` is the count the
 * client reports for the field itself, and `field_slots` is the one that has matched observed
 * deployments. The divergence stays a latent, documented fact rather than an averaged guess.
 */
export function resolveFieldSlots(skills: unknown): number | null {
  if (!isObject(skills)) return null;
  const raw = skills.field_slots;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 1) return null;
  return clampSlots(raw);
}
