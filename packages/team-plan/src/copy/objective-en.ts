/**
 * The Optimizer screen's objective control, and every string on it whose wording depends on which
 * objective the search was scoring.
 *
 * Split out because the `…Dps`/`…Farm`/`…Gate`/`…Pvp` sets are read as sets — through
 * `teamPlanObjectiveCopy`, never individually — and because a damage word in the gold set is the
 * failure this whole shape exists to prevent, which is easier to review with the sets side by
 * side than scattered through the screen's other hundred strings.
 */
export const teamPlanObjectivePairsEn = {
  teamPlanPhaseHintNoneDps:
    'No phase pinned. Damage is scored at the phase your account is on now.',
  teamPlanPhaseHintNoneFarm:
    'No phase pinned. The search picks the best phase your squad can hold, and says which one it settled on.',
  /** Under the phase card of a finished plan, where a rotation plan says whether the phase was
   *  picked or found. */
  teamPlanScoredPhaseGate: 'The gate you picked, scored over its timer.',
  teamPlanScoredPhasePvp: 'The phase the duel room is hardened to.',
  teamPlanObjectiveLabel: 'Score for',
  teamPlanObjectiveAria: 'What this search scores a roster on',
  teamPlanObjectiveOptionGold: 'Gold / hr',
  teamPlanObjectiveOptionGate: 'Gate clear',
  teamPlanObjectiveOptionPvp: 'PVP',
  teamPlanObjectiveHintDps:
    'Ranks builds by combined roster DPS. Gold per hour is not scored, and can fall.',
  teamPlanObjectiveHintFarm:
    'Ranks builds by the gold per hour the squad brings in at the phase beside this. A roster that earns more can hit softer.',
  teamPlanObjectiveHintGate:
    'Ranks builds by the damage the squad lands inside the gate timer. Energy counts only for the field time it buys before the timer runs out; gold per hour is not scored.',
  teamPlanObjectiveHintPvp:
    'Ranks builds by the damage the squad you field lands in the one-minute duel — at most nine heroes, picked on the scope board. A stint that outlasts the minute needs no more energy; gold per hour is not scored.',
  /** No longer enumerates gear moves, forge work and point resets: the Allowed changes control
   *  below decides which of those a plan may contain, so listing all three here promises chores a
   *  restricted plan will never produce. */
  teamPlanSetupSectionBodyDps:
    'Builds a plan for the heroes you mark Optimize, out of the changes you allow below — scored for combined roster DPS.',
  teamPlanSetupSectionBodyFarm:
    'Builds a plan for the heroes you mark Optimize, out of the changes you allow below — scored for the gold per hour the squad brings in.',
  teamPlanSetupSectionBodyGate:
    'Builds a plan for the heroes you mark Optimize, out of the changes you allow below — scored for the damage they land inside the gate timer.',
  teamPlanSetupSectionBodyPvp:
    'Builds a plan for the duel squad you field on the scope board — at most nine heroes, Optimize and Leave alone alike — out of the changes you allow below, scored for the damage it lands in the one-minute duel. Donors stay out of the room.',
  teamPlanTotalGainValueDps: '{delta} dps ({pct}%)',
  teamPlanTotalGainValueFarm: '{delta} gold/h ({pct}%)',
  teamPlanTotalGainValueGate: '{delta} dps at the gate ({pct}%)',
  teamPlanTotalGainValuePvp: '{delta} dps in the duel ({pct}%)',
  teamPlanGearDipNoteDps:
    'Temporarily behind by {delta} dps — the Reset points step brings it past today.',
  teamPlanGearDipNoteFarm:
    'Temporarily behind by {delta} gold/h — the Reset points step brings it past today.',
  teamPlanGearDipNoteGate:
    'Temporarily behind by {delta} dps at the gate — the Reset points step brings it past today.',
  teamPlanGearDipNotePvp:
    'Temporarily behind by {delta} dps in the duel — the Reset points step brings it past today.',
  /** The gate picker that stands in for the phase control under Gate clear. */
  teamPlanGatePhaseLabel: 'Gate to clear',
  teamPlanGatePhaseAria: 'Which gate this search plans for',
  teamPlanGatePhaseHint: 'Scored over this act’s {secs} s gate timer, with the squad deploying in full as it opens.',
  teamPlanGatePhaseSearchPlaceholder: 'Hard, Normal 2-5, or 150',
  /** The duel facts that stand in for the phase control under PVP — read-only, since the game
   *  picks the squad and the room. */
  teamPlanPvpSquadLabel: 'Duel',
  teamPlanPvpSquadValue: '{count} of {max} fielded · {phase} · {secs} s',
  teamPlanPvpSquadHint: 'How many heroes the scope board fields against the room’s nine seats, and the phase the room is hardened to, as last read.',
  teamPlanPvpRoomUnknown: 'room phase unknown',
  teamPlanPvpSquadTooMany: 'The duel room seats {max}. Move {excess} more to Donate before this plan can be built.',
} as const;
