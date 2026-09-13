import { TEAM_BUFF_CAP, type TeamBuffId } from './team-buffs';

/**
 * Team auras are a property of the FIELD (confirmed 2026-08-19): every deployed hero — carrier
 * or not — experiences the SAME `min(cap, roster total)`, never an "own share" added on top of
 * an others-only figure. `ownPct` stays as a parameter (rather than deleting it and inlining
 * `Math.min`) so every call site names what it is doing: {@link teamAuraLayer} always passes
 * `0`, because `teamBuffs` already carries every carrier including this hero (see
 * `computeTeamBuffsOverRotation` / `computeTeamBuffsAroundHero`, `team-buffs.ts`) — there is no
 * separate "own" term left to add. The cap is per ability ({@link TEAM_BUFF_CAP}), not a single
 * global figure — an earlier version of this comment cited `combate.team_mult_bonus_cap` as the
 * source of a single +100% cap, but that key does not exist in the live wiki payload or in this
 * repo's own drift capture; it was never a published constant.
 */
export function combineTeamAuraPct(ownPct: number, othersPct: number, cap: number): number {
  return Math.min(cap, Math.max(0, ownPct) + Math.max(0, othersPct));
}

/**
 * The Fôlego de Mineiro half of {@link teamAuraLayer}, factored out so the live field countdown
 * (`resolveFieldDrainMultipliers`) can derive the same capped team drain multiplier from a live
 * on-field set without reimplementing the cap/floor arithmetic.
 */
export function teamDrainMultFromTeamBuffs(teamBuffs: Record<TeamBuffId, number>): number {
  const folegoPct = combineTeamAuraPct(0, teamBuffs.folego_mineiro || 0, TEAM_BUFF_CAP.folego_mineiro);
  return Math.max(0.01, 1 - folegoPct / 100);
}

/**
 * What a roster's four aura totals do to any one hero's sheet — the whole of the team layer, in
 * the four operations `derive` applies last: attack × Grito, speed × Marcha, crit + Presságio's
 * flat points, and Fôlego's drain multiplier combined with the hero's own. A pure function of the
 * totals: the same totals give every hero the same layer.
 */
export type TeamAuraLayer = {
  attackMult: number;
  speedMult: number;
  /** The roster-wide Presságio total in FLAT crit points, already clamped at
   *  `TEAM_BUFF_CAP.pressagio_mortal` — the single value `derive()` adds to the sheet. */
  teamCritFlat: number;
  teamDrainMult: number;
};

export function teamAuraLayer(teamBuffs: Record<TeamBuffId, number>): TeamAuraLayer {
  const gritoPct = combineTeamAuraPct(0, teamBuffs.grito_guerra || 0, TEAM_BUFF_CAP.grito_guerra);
  const marchaPct = combineTeamAuraPct(0, teamBuffs.marcha_acelerada || 0, TEAM_BUFF_CAP.marcha_acelerada);
  const teamCritFlat = combineTeamAuraPct(0, teamBuffs.pressagio_mortal || 0, TEAM_BUFF_CAP.pressagio_mortal);
  return {
    attackMult: 1 + gritoPct / 100,
    speedMult: 1 + marchaPct / 100,
    teamCritFlat,
    teamDrainMult: teamDrainMultFromTeamBuffs(teamBuffs),
  };
}
