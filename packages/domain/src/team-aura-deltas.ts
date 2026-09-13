import { computeAdvisorPipeline, type AdvisorPipelineInput } from './advisor-pipeline';
import { TEAM_BUFF_ABILITY_IDS, TEAM_BUFF_CAP, type TeamBuffId } from './team-buffs';

/** The same totals with one aura flipped: in force → gone; absent → at its field-wide cap. */
export function flipTeamAura(
  teamBuffs: Record<TeamBuffId, number>,
  buffId: TeamBuffId,
): Record<TeamBuffId, number> {
  return { ...teamBuffs, [buffId]: teamBuffs[buffId] > 0 ? 0 : TEAM_BUFF_CAP[buffId] };
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
): Record<TeamBuffId, number> {
  const out = {} as Record<TeamBuffId, number>;
  for (const buffId of TEAM_BUFF_ABILITY_IDS) {
    if (!(baselineDps > 0)) {
      out[buffId] = 0;
      continue;
    }
    const flipped = computeAdvisorPipeline({ ...input, teamBuffs: flipTeamAura(input.teamBuffs, buffId) });
    out[buffId] = (flipped.dps / baselineDps - 1) * 100;
  }
  return out;
}
