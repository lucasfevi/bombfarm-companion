import { computeAdvisorPipeline, type AdvisorPipelineInput } from './advisor-pipeline';
import {
  PASSAGEM_BASTAO_RANK_CAP,
  TEAM_AURA_SWITCH_IDS,
  TEAM_BUFF_CAP,
  type TeamAuraId,
  type TeamBuffId,
} from './team-buffs';

/** The same totals with one aura flipped: in force → gone; absent → at its field-wide cap. */
export function flipTeamAura(
  teamBuffs: Record<TeamBuffId, number>,
  buffId: TeamBuffId,
): Record<TeamBuffId, number> {
  return { ...teamBuffs, [buffId]: teamBuffs[buffId] > 0 ? 0 : TEAM_BUFF_CAP[buffId] };
}

/**
 * The same input with one aura flipped. The five standing auras flip in the totals; Passagem de
 * Bastão is not a total but the rank the hero's own entry pulse is priced at, so it flips
 * between no pulse and the cap rank — the hero's own rank included, since a pulse in force is
 * what "if off" takes away.
 */
export function flipTeamAuraInput(input: AdvisorPipelineInput, auraId: TeamAuraId): AdvisorPipelineInput {
  if (auraId !== 'passagem_bastao') return { ...input, teamBuffs: flipTeamAura(input.teamBuffs, auraId) };
  const inForce = Math.max(input.abilities.passagem_bastao ?? 0, input.entryPulseRankFloor ?? 0) > 0;
  return {
    ...input,
    abilities: { ...input.abilities, passagem_bastao: 0 },
    entryPulseRankFloor: inForce ? 0 : PASSAGEM_BASTAO_RANK_CAP,
  };
}

/**
 * What flipping each team aura alone does to sustained DPS, in signed percent of `baselineDps`:
 * negative for an aura in force ("if off"), positive for one absent ("if on"). One pipeline run
 * per aura, on the very input the figures came from — a difference of two runs of one model,
 * never a second model of the same quantity. Near-zero is a real answer here — Presságio is
 * worth little to a hero with no crit damage — not a defect to hide.
 */
export function teamAuraDpsDeltas(
  input: AdvisorPipelineInput,
  baselineDps: number,
): Record<TeamAuraId, number> {
  const out = {} as Record<TeamAuraId, number>;
  for (const auraId of TEAM_AURA_SWITCH_IDS) {
    if (!(baselineDps > 0)) {
      out[auraId] = 0;
      continue;
    }
    const flipped = computeAdvisorPipeline(flipTeamAuraInput(input, auraId));
    out[auraId] = (flipped.dps / baselineDps - 1) * 100;
  }
  return out;
}
