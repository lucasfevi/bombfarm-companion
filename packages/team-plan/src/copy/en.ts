export const teamPlanPageEn = {
  navOptimizer: 'Optimizer',
  teamPlanPageLandmark: 'Optimizer',
  teamPlanPageTitle: 'Optimizer',
  teamPlanOptimize: 'Build team plan',
  teamPlanOptimizeAriaBoth: 'Build a team plan of gear moves and point resets',
  teamPlanOptimizeAriaPoints: 'Build a team plan of point resets',
  teamPlanOptimizeAriaGear: 'Build a team plan of gear moves',
  teamPlanOptimizing: 'Building plan…',
  teamPlanOptimizingTitle: 'Building plan…',
  teamPlanOptimizingBody:
    'Looking for the best mix of gear and point resets across the heroes you set to Optimize.',
  teamPlanOptimizingElapsed: 'Elapsed {time}',
  teamPlanOptimizingCancel: 'Cancel',
  teamPlanOptimizingProgressAria: 'Building team plan',
  teamPlanSetupSectionTitle: 'Search setup',
  teamPlanPhaseLabel: 'Plan for phase',
  teamPlanPhaseAria: 'Which phase this search plans for',
  teamPlanPhaseNone: 'None',
  /** Three examples, one per search route: a difficulty word, a phase the way the game writes it,
   *  a bare number. Cheaper to read than naming the routes, and the words are the search itself. */
  teamPlanPhaseSearchPlaceholder: 'Hard, Normal 2-1, or 151',
  teamPlanPhaseNoMatch: 'No phase matches that.',
  teamPlanPhaseMoreMatches: 'Showing {shown} of {matched} — keep typing to narrow.',
  teamPlanPhaseHintChosen:
    'Every figure below is scored at this phase, and nowhere else. Pinning one also makes the search much faster.',
  teamPlanPhaseBeyondMax:
    'Past the furthest phase your account has reached (#{max}) — this answers what the squad would earn if it could hold it.',
  teamPlanRunSummaryTitle: 'Search summary',
  teamPlanWaterfallPhaseLabel: 'Phase',
  /** Under the phase card's value, only when the plan's phase is not the account's own. */
  teamPlanWaterfallPhaseFrom: 'was {phase}',
  teamPlanScoredPhaseChosen: 'The phase you picked.',
  teamPlanScoredPhaseAccount: 'Where your account is now.',
  teamPlanScoredPhaseSearched: 'Picked automatically — the best this squad can hold.',
  teamPlanScoredPhaseUnreachable:
    'This squad cannot clear it, so there is nothing for it to earn there.',
  teamPlanScoredPhaseNoneFeasible: 'No phase this squad can clear was found.',
  teamPlanRunSummaryDuty: 'Battle load',
  teamPlanRunSummaryDutyValue: '{duty} of {slots} slots',
  teamPlanRunSummaryDutyHint:
    'How hard your Optimize heroes pull on the field versus how many can fight at once.',
  teamPlanRunSummaryRegimeHintUnder:
    'Your Optimize heroes aren’t competing for battle slots — each keeps their full share of field time.',
  teamPlanBudgetExhausted:
    'Search stopped early to save time — the gain shown is the best found so far, not a promise that nothing better exists.',
  teamPlanMainThreadFallback:
    'This search ran on the main page because the background worker was unavailable — the page may have frozen briefly.',
  teamPlanForgeFloorLabel: 'Min forge (+)',
  teamPlanForgeFloorAria: 'Minimum forge level assumed for every item in the pool',
  teamPlanForgeFloorHint:
    'Every item is scored as if forged to at least this level. Anything lower shows up as a forge chore on that hero.',
  teamPlanAllowedChangesLabel: 'Allowed changes',
  teamPlanAllowedChangesAria: 'Which kinds of change this plan may propose',
  teamPlanAllowedChangesOptionBoth: 'Gear and points',
  teamPlanAllowedChangesOptionPoints: 'Points only',
  teamPlanAllowedChangesOptionGear: 'Gear only',
  teamPlanAllowedChangesHintBoth:
    'The plan may move gear, order forge work, and re-spend stat points.',
  teamPlanAllowedChangesHintPoints:
    'Stat points only. No gear moves and no forge work — the search never even prices them.',
  teamPlanAllowedChangesHintGear:
    'Gear only. No point resets, so no respec cost either.',
  teamPlanIgnoreCrowdingLabel: 'Keep every hero geared',
  teamPlanIgnoreCrowdingAria: 'Score as if the field always had room, and fill every empty slot',
  teamPlanIgnoreCrowdingHintOff:
    'The field seats a limited number of heroes, so a hero taking more field time crowds the others out. The plan prices that, which is why it can ask you to remove gear.',
  teamPlanIgnoreCrowdingHintOn:
    'Scoring as if the field always had room. Gear can never make a hero score worse, and every empty slot gets filled if you own something that fits — but the totals now describe a field that never makes heroes queue, so they read higher than the roster really earns.',
  teamPlanScopeSectionTitle: 'Hero scope',
  teamPlanScopeOptimize: 'Optimize',
  teamPlanScopeDonate: 'Donate',
  teamPlanScopeLeaveAlone: 'Leave alone',
  teamPlanScopeOptimizeTip:
    'Scored in the plan. These heroes can receive better items and may give items up.',
  teamPlanScopeDonateTip:
    'Not scored. Their items join the pool for Optimize heroes; they receive nothing back.',
  teamPlanScopeLeaveAloneTip:
    'Frozen. Items stay put and this hero is ignored by the search.',
  teamPlanScopeBoardTip:
    'Drag hero cards between columns. On small screens, use the menu on each card. Battle-disabled heroes start in Donate by default.',
  teamPlanScopeColumnEmpty: 'Drop heroes here',
  teamPlanScopeDragHandleAria: 'Drag to change scope',
  teamPlanScopeNothingInScope: 'Nothing in scope — set at least one hero to Optimize.',
  teamPlanHeroRowLabel: '{name} · Lv {level} · #{id}',
  teamPlanResultsSectionTitle: 'Plan results',
  teamPlanResultsSectionAria: 'Team plan results',
  teamPlanTotalGainLabel: 'Total gain',
  teamPlanWaterfallTitle: 'Gain breakdown',
  teamPlanStepToday: 'Today',
  teamPlanStepGear: 'Gear',
  teamPlanStepForged: 'Forge to minimum',
  teamPlanStepMoved: 'Moves',
  teamPlanStepRespec: 'Reset points',
  teamPlanRunMetaFooter:
    'Took <em>{seconds}</em>s · <em>{rounds}</em> search passes · <em>{evals}</em> builds checked · {seed}',
  teamPlanRunSeedCurrent: "started from today's items",
  teamPlanRunSeedGreedyHeroDps: 'started with strongest heroes first',
  teamPlanRunSeedGreedySlotValue: 'started with best pieces per slot',
  teamPlanRunSeedBestItemFirst: 'started with the best items first',
  teamPlanRunSeedFallback: 'started from an alternate setup',
  teamPlanHeroDeltaTitle: 'Per-hero changes',
  teamPlanColBefore: 'Before',
  teamPlanColAfter: 'After',
  teamPlanColDelta: 'Δ',
  teamPlanColDpsBefore: 'DPS before',
  teamPlanColDpsAfter: 'DPS after',
  teamPlanColDpsDelta: 'Δ DPS',
  teamPlanHeroDeltaExpandAria: 'Detailed breakdown for {name}',
  teamPlanHeroBreakdownStatsTitle: 'Stat breakdown',
  teamPlanHeroBreakdownStatsSheetTitle: 'Hero sheet',
  teamPlanHeroBreakdownHitTitle: 'Hit damage',
  teamPlanHeroHitNormal: 'Normal hit',
  teamPlanHeroHitCritical: 'Critical hit',
  teamPlanHeroBreakdownGearTitle: 'Proposed items',
  teamPlanHeroBreakdownGearEmpty: 'No proposed items for this hero.',
  teamPlanHeroBreakdownPointsTitle: 'Point reset',
  teamPlanHeroBreakdownPointsEmpty: 'No point reset is recommended for this hero.',
  teamPlanRunedHeroes:
    'Timed runes are counted on: {heroes}. A gain on them is partly the rune’s and goes when it expires — the plan cannot buy one back.',
  teamPlanStaleNotice:
    'Inputs changed since this plan was computed — run Build team plan again to refresh.',
  teamPlanBlockedTitle: 'Cannot run — missing birth stats',
  teamPlanErrorTitle: 'Search failed',
  teamPlanRetry: 'Try again',
  teamPlanRegimeUnderSaturated: 'Fits the field',
  teamPlanRegimeSaturated: 'Field is full',
} as const;
