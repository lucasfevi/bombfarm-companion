/**
 * Every player-facing string the per-hero detail panels print, flat and typed.
 *
 * These live HERE rather than in a host-supplied contract (`roster-copy.ts`, `hero-panel-copy.ts`)
 * because none of them is vocabulary a host already prints elsewhere: a roll band, a percentile,
 * "not modelled", the fuse floor, an uncertain placement and the two empty-state reasons appear on
 * no other screen. Making both hosts supply them in two languages would give every string two
 * owners and guarantee drift.
 *
 * `as const` is load-bearing twice over: it makes `HeroCopy` (`index.ts`) a mapped type over this
 * exact key set, and it keeps the values as string LITERALS, so a host that spreads this object
 * into a wider dictionary of its own keeps the literal types it had before.
 */
export const heroEn = {
  heroDetailIdentityTitle: "Identity",
  heroDetailIdentityRarity: "Rarity",
  heroDetailIdentityGrade: "Grade",
  heroDetailIdentityLevel: "Level",
  heroDetailIdentityPower: "Power",
  heroDetailIdentityMarketable: "Marketable",
  heroDetailIdentityNotMarketable: "Not marketable",
  heroDetailIdentityMarketValue: "Market value",

  heroDetailRollTitle: "Birth roll",
  heroDetailRollQuality: "Roll quality",
  heroDetailRollColStat: "Stat",
  heroDetailRollColBand: "Band",
  heroDetailRollColPosition: "Position",
  heroDetailRollValue: "Rolled",
  heroDetailRollBand: "Rolled inside {range}",
  heroDetailRollPercentile: "{pct}% into its band",
  heroDetailRollGradePlacement: "Where it sits in grade {letter}",
  heroDetailRollToNextLetter: "{range} points from grade {letter}",
  heroDetailRollTopGrade: "This is the top grade, with nothing above it.",
  heroDetailRollNearEdge: "This hero sits near the edge of its grade.",
  heroDetailRollPermanent:
    "The birth roll is permanent: it never changes with level, stars, gear or spent points.",
  heroDetailRollNoBirthRoll: "This hero has no birth roll, so there is nothing to place.",
  heroDetailRollNoBounds:
    "This hero has no roll bounds, so its position inside them cannot be measured.",
  heroDetailRollComputedDisagrees:
    "The quality we compute lands on a different letter than the one the game stored.",
  heroDetailRollStoredLetterStands: "The stored letter is the game's answer and stands.",
  heroDetailRollStoredLetter: "Stored grade",
  heroDetailRollComputedLetter: "Our estimate",
  heroDetailRollPlacementUncertain: "Read the placement below as uncertain.",

  heroDetailAbilitiesTitle: "Abilities",
  heroDetailAbilitiesLevelOfMax: "{level} of {max}",
  heroDetailAbilitiesEffect: "Modelled effect",
  heroDetailAbilitiesOnSheetTag: "On sheet",
  heroDetailAbilitiesNotModelled:
    "The model carries no effect for this ability, so it cannot be priced.",
  heroDetailAbilitiesMaxed: "Already at its maximum level, with no next level to buy.",
  heroDetailAbilitiesNextLevelGain: "One more level is worth {pct}% to this hero",
  heroDetailAbilitiesAuraAtCeiling:
    "Your roster is already at this aura's field-wide ceiling, so the next level buys nothing.",
  heroDetailAbilitiesNotMeasured:
    "The model carries this effect, but it lands outside what sustained damage per second measures.",
  heroDetailAbilitiesNoBirthRoll:
    "Without a birth roll this hero cannot be valued, so no ability of its can be priced.",
  heroDetailAbilitiesSlots: "Slots",
  heroDetailAbilitiesSlotsValue: "{used} of {max} for this rarity",
  heroDetailAbilitiesPoints: "Ability points",
  heroDetailAbilitiesPointsValue: "{spent} of {budget} spent",
  heroDetailAbilitiesDeadPoints: "Dead points",
  heroDetailAbilitiesDeadPointsHint:
    "This hero's level is past what it can spend, so {count} points can never be used.",
  heroDetailAbilitiesDeadPointsNone:
    "Every level this hero gains still turns into a point it can spend.",
  heroDetailAbilitiesDeadPointsAtCeiling:
    "This hero holds exactly as many points as its slots can take; further levels add none.",
  heroDetailAbilitiesNone: "This hero owns no abilities.",

  heroDetailCombatTitle: "Combat",
  heroDetailCombatNormalHit: "Normal hit",
  heroDetailCombatCritHit: "Critical hit",
  heroDetailCombatAvgHit: "Average hit",
  heroDetailCombatFieldTime: "Time on field",
  heroDetailCombatFuseTime: "Fuse time",
  heroDetailCombatUptime: "Uptime",
  heroDetailCombatDps: "DPS",
  heroDetailCombatActiveDps: "Active DPS",
  heroDetailCombatSustainedDps: "Sustained DPS",
  heroDetailCombatPenetration: "Penetration vs mitigation",
  heroDetailCombatDamageThrough: "Damage that lands",
  heroDetailCombatHitsToKill: "Hits to kill",
  heroDetailCombatProps: "Props",
  heroDetailCombatPhase: "Phase {name}",
  heroDetailCombatPhaseFromFarm: "This is the phase your Farm screen is set to.",
  heroDetailCombatPhaseOverridden: "You are looking at a different phase than your Farm screen.",
  heroDetailCombatFuseFloor: "Fuse floor",
  heroDetailCombatFuseFloorHint: "The fuse time cannot go below {secs}s.",
  heroDetailCombatCdrCeiling: "Cooldown reduction ceiling",
  heroDetailCombatCdrCeilingReached: "Further cooldown reduction buys nothing.",
  heroDetailCombatNoProps: "There are no props on this phase.",

  heroDetailSheetTitle: "Statistic sheet",
  heroDetailPointsTitle: "Points spent",
  heroDetailBreakdownTitle: "Per-statistic breakdown",
  heroDetailGearTitle: "Equipped loadout",
  heroDetailGearSlotContribution: "Per-slot contribution",
  heroDetailGearTotals: "Gear totals",
  heroDetailGearCompareTitle: "Loadout comparison",
  heroDetailNextStatTitle: "Recommended next statistic",
  heroDetailNextStatModeDamage: "Damage",
  heroDetailNextStatModeFarming: "Farming",
  heroDetailNextStatFarmUnavailable: "A farming recommendation is not available here: {reason}",

  heroDetailEmptyNoAccount: "The game is not running, or the account has not been read yet.",
  heroDetailEmptyNoHeroes: "This account has no heroes.",
} as const;
