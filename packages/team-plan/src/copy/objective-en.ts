/**
 * The Optimizer screen's objective control, and every string on it whose wording depends on which
 * objective the search was scoring.
 *
 * Split out because the `…Dps`/`…Farm`/`…SetFarm`/`…Gate`/`…Pvp` sets are read as sets — through
 * `teamPlanObjectiveCopy`, never individually — and because a damage word in the gold set is the
 * failure this whole shape exists to prevent, which is easier to review with the sets side by
 * side than scattered through the screen's other hundred strings.
 */
export const teamPlanObjectivePairsEn = {
  teamPlanPhaseHintNoneDps:
    'No phase pinned. Damage is scored at the phase your account is on now.',
  teamPlanPhaseHintNoneFarm:
    'No phase pinned. The search picks the best phase your squad can hold, and says which one it settled on.',
  teamPlanPhaseHintNoneSetFarm:
    'The set decides the phases: the search picks the one where it drops the most chests per hour for your squad, weighing clear speed against Luck.',
  /** Under the phase card of a finished plan, where a rotation plan says whether the phase was
   *  picked or found. */
  teamPlanScoredPhaseGate: 'The gate you picked, scored over its timer.',
  teamPlanScoredPhasePvp: 'The phase the duel room is hardened to.',
  teamPlanObjectiveLabel: 'Score for',
  teamPlanObjectiveAria: 'What this search scores a roster on',
  teamPlanObjectiveOptionGold: 'Gold / hr',
  teamPlanObjectiveOptionGate: 'Gate clear',
  teamPlanObjectiveOptionPvp: 'PVP',
  teamPlanObjectiveOptionSet: 'Set farm',
  teamPlanObjectiveHintDps:
    'Ranks builds by combined roster DPS. Gold per hour is not scored, and can fall.',
  teamPlanObjectiveHintFarm:
    'Ranks builds by the gold per hour the squad brings in at the phase beside this. A roster that earns more can hit softer.',
  teamPlanObjectiveHintSetFarm:
    'Searches only the phases where the set you pick drops, and ranks builds by how many of that set’s item chests drop per hour. Luck is worth points here, because it multiplies every chest roll — but it is weighed against clear speed, since a slower clear drops fewer chests. Rarity cannot be steered — Luck changes how many chests drop, not which rarity they roll.',
  teamPlanObjectiveHintGate:
    'Ranks builds by the damage the squad lands inside the gate timer. Energy counts only for the field time it buys before the timer runs out; gold per hour is not scored.',
  teamPlanObjectiveHintPvp:
    'Ranks builds by the damage the squad you field lands in the one-minute duel — at most as many heroes as your squad has slots, picked on the scope board. A stint that outlasts the minute needs no more energy; gold per hour is not scored.',
  /** No longer enumerates gear moves, forge work and point resets: the Allowed changes control
   *  below decides which of those a plan may contain, so listing all three here promises chores a
   *  restricted plan will never produce. */
  teamPlanSetupSectionBodyDps:
    'Builds a plan for the heroes you mark Optimize, out of the changes you allow below — scored for combined roster DPS.',
  teamPlanSetupSectionBodyFarm:
    'Builds a plan for the heroes you mark Optimize, out of the changes you allow below — scored for the gold per hour the squad brings in.',
  teamPlanSetupSectionBodySetFarm:
    'Builds a plan for the heroes you mark Optimize, out of the changes you allow below — scored for the item chests of the set you pick that drop per hour.',
  teamPlanSetupSectionBodyGate:
    'Builds a plan for the heroes you mark Optimize, out of the changes you allow below — scored for the damage they land inside the gate timer.',
  teamPlanSetupSectionBodyPvp:
    'Builds a plan for the duel squad you field on the scope board — at most as many heroes as your squad has slots, Optimize and Leave alone alike — out of the changes you allow below, scored for the damage it lands in the one-minute duel. Donors stay out of the room.',
  teamPlanTotalGainValueDps: '{delta} dps ({pct}%)',
  teamPlanTotalGainValueFarm: '{delta} gold/h ({pct}%)',
  teamPlanTotalGainValueSetFarm: '{delta} set chests/h ({pct}%)',
  teamPlanTotalGainValueGate: '{delta} dps at the gate ({pct}%)',
  teamPlanTotalGainValuePvp: '{delta} dps in the duel ({pct}%)',
  teamPlanGearDipNoteDps:
    'Temporarily behind by {delta} dps — the Reset points step brings it past today.',
  teamPlanGearDipNoteFarm:
    'Temporarily behind by {delta} gold/h — the Reset points step brings it past today.',
  teamPlanGearDipNoteSetFarm:
    'Temporarily behind by {delta} set chests/h — the Reset points step brings it past today.',
  teamPlanGearDipNoteGate:
    'Temporarily behind by {delta} dps at the gate — the Reset points step brings it past today.',
  teamPlanGearDipNotePvp:
    'Temporarily behind by {delta} dps in the duel — the Reset points step brings it past today.',
  /** The set picker that stands in for the phase control under Set farm. */
  teamPlanFarmSetLabel: 'Set to farm',
  teamPlanFarmSetAria: 'Which equipment set this search farms',
  teamPlanFarmSetPlaceholder: 'Pick a set',
  teamPlanFarmSetOption: '{set} · phases {min}–{max}',
  teamPlanFarmSetOptionLocked: '{set} · phases {min}–{max} · not reached yet',
  teamPlanFarmSetHint:
    'Only the phases where this set drops are searched. The search balances clear speed against Luck, because a slower clear drops fewer chests.',
  teamPlanFarmSetNeeded: 'Pick a set to farm before building this plan.',
  teamPlanFarmSetNeedsMaxPhase:
    'Farming a set needs the furthest phase your account has reached, which is not known yet.',
  /** Under the phase card of a finished Set farm plan. */
  teamPlanScoredPhaseSetSearched: 'Picked automatically — the phase where this set drops the most chests per hour for this squad.',
  teamPlanScoredPhaseSetUnfarmable: 'This squad cannot clear any phase it has reached where this set drops.',
  teamPlanScoredPhaseClearTime: 'About {secs} s per clear.',
  teamPlanScoredPhaseSlowClear:
    'Clears take {secs} s here — this set’s phases are hard for your squad, and the estimate is least certain at slow clears.',
  /** The gate picker that stands in for the phase control under Gate clear. */
  teamPlanGatePhaseLabel: 'Gate to clear',
  teamPlanGatePhaseAria: 'Which gate this search plans for',
  teamPlanGatePhaseHint: 'Scored over this act’s {secs} s gate timer, with the squad deploying in full as it opens.',
  teamPlanGatePhaseSearchPlaceholder: 'Hard, Normal 2-5, or 150',
  /** The duel facts that stand in for the phase control under PVP — read-only, since the game
   *  picks the squad and the room. */
  teamPlanPvpSquadLabel: 'Duel',
  teamPlanPvpSquadValue: '{count} of {max} fielded · {phase} · {secs} s',
  teamPlanPvpSquadHint: 'How many heroes the scope board fields against your squad’s slots, and the phase the room is hardened to, as last read. Until the game has reported your slots, the plan assumes the top squad house’s nine.',
  teamPlanPvpRoomUnknown: 'room phase unknown',
  teamPlanPvpSquadTooMany: 'Your squad has {max} slots. Move {excess} more to Donate before this plan can be built.',
} as const;
