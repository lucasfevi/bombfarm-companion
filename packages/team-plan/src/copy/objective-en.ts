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
  /** Rendered only when a plan may respend points at all. Luck is not part of `HeroSheet`, so no
   *  points search can reach it in either direction — worth saying under damage (your Luck is
   *  safe) and worth saying louder under gold (a stat that earns is being held still). */
  teamPlanLuckFrozenDps:
    'Points already in Luck stay put — this search never moves Luck, in either direction.',
  teamPlanLuckFrozenFarm:
    'Points already in Luck stay put — this search never moves Luck, in either direction, even though Luck raises drop rates and so gold per hour.',
  /** The per-hero rows are `perHero[].sustained` — DPS — whatever the roster was scored on
   *  (`waterfall.ts`). Under gold that is a DIFFERENT quantity from the total above it, and the
   *  rows do not sum to it, so the farm half has to say so rather than claim they are the thing
   *  the search optimized. */
  teamPlanHeroDeltaNoteDps:
    'The before/after totals above are combat-effective — team auras are applied and aren’t clamped to the game’s display caps (100% crit chance, 80% cooldown reduction); that’s deliberate, since this uncapped, aura-inclusive view is what the search actually optimizes against. Below, Hero sheet mirrors what the game’s own panel shows (capped); Combat stats keeps that same uncapped view.',
  teamPlanHeroDeltaNoteFarm:
    'These per-hero figures are DPS, not gold per hour — this search scored the squad’s earning rate, which is a rate the whole rotation produces and does not divide per hero, so these will not add up to the total above. They are combat-effective: team auras are applied and aren’t clamped to the game’s display caps (100% crit chance, 80% cooldown reduction). Below, Hero sheet mirrors what the game’s own panel shows (capped); Combat stats keeps that same uncapped view.',
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
  teamPlanSaturationCalloutDps:
    'Your field is full (battle load {duty} vs {slots} slots). Roster DPS is shared across who can fight at once — advice only; this page will not bench or donate heroes for you.',
  teamPlanSaturationCalloutFarm:
    'Your field is full (battle load {duty} vs {slots} slots). The squad’s earning rate is shared across who can fight at once — advice only; this page will not bench or donate heroes for you.',
  teamPlanForgeSkippedNoteDps:
    'Forging to your minimum was left out of this plan — it did not improve roster DPS.',
  teamPlanForgeSkippedNoteFarm:
    'Forging to your minimum was left out of this plan — it did not improve the squad’s gold per hour.',
} as const;
