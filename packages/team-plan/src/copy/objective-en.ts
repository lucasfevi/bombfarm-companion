/**
 * The Optimizer screen's objective control, and every string on it whose wording depends on which
 * objective the search was scoring.
 *
 * Split out because the `…Dps`/`…Farm` pairs are read as pairs — through `teamPlanObjectiveCopy`,
 * never individually — and because a damage word in the wrong half is the failure this whole shape
 * exists to prevent, which is easier to review with the two halves side by side than scattered
 * through the screen's other hundred strings.
 */
export const teamPlanObjectivePairsEn = {
  teamPlanPhaseHintNoneDps:
    'No phase pinned. Damage is scored at the phase your account is on now.',
  teamPlanPhaseHintNoneFarm:
    'No phase pinned. The search picks the best phase your squad can hold, and says which one it settled on.',
  teamPlanObjectiveLabel: 'Score for',
  teamPlanObjectiveAria: 'What this search scores a roster on',
  teamPlanObjectiveOptionDamage: 'DPS',
  teamPlanObjectiveOptionGold: 'Gold / hr',
  teamPlanObjectiveHintDps:
    'Ranks builds by combined roster DPS. Gold per hour is not scored, and can fall.',
  teamPlanObjectiveHintFarm:
    'Ranks builds by the gold per hour the squad brings in at the phase beside this. A roster that earns more can hit softer.',
  /** No longer enumerates gear moves, forge work and point resets: the Allowed changes control
   *  below decides which of those a plan may contain, so listing all three here promises chores a
   *  restricted plan will never produce. */
  teamPlanSetupSectionBodyDps:
    'Builds a plan for the heroes you mark Optimize, out of the changes you allow below — scored for combined roster DPS.',
  teamPlanSetupSectionBodyFarm:
    'Builds a plan for the heroes you mark Optimize, out of the changes you allow below — scored for the gold per hour the squad brings in.',
  teamPlanRunSummaryRegimeHintSaturatedDps:
    'More field demand than battle slots — roster DPS is shared across who can fight at once.',
  teamPlanRunSummaryRegimeHintSaturatedFarm:
    'More field demand than battle slots — the squad’s earning rate is shared across who can fight at once.',
  teamPlanTotalGainValueDps: '{delta} dps ({pct}%)',
  teamPlanTotalGainValueFarm: '{delta} gold/h ({pct}%)',
  teamPlanResultsHeaderDps: 'Best roster DPS found by this search',
  teamPlanResultsHeaderFarm: 'Best gold per hour found by this search',
  teamPlanGearDipNoteDps:
    'Temporarily behind by {delta} dps — the Reset points step brings it past today.',
  teamPlanGearDipNoteFarm:
    'Temporarily behind by {delta} gold/h — the Reset points step brings it past today.',
} as const;
