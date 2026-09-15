/**
 * Everything the per-hero detail panels read, flattened into one plain record.
 *
 * Each host maps its own state onto this shape, so nothing under `@bombfarm/hero/core` knows what
 * a store, a router or a host module is, and neither app's state shape reaches the other. A later
 * editing phase is then a wiring change on the host side rather than a rebuild here.
 */
import type { AbilityGain } from '@bombfarm/domain/ability-gain';
import type { FarmPointRankOutcome } from '@bombfarm/domain/farm-point-rank';
import type { PointValue } from '@bombfarm/domain/model';
import type { RollQualityReport } from '@bombfarm/domain/roll-quality';
import type { pipelineForHero } from '@bombfarm/domain/roster-dps';
import type { AccountShared, HeroRecord } from '@bombfarm/domain/shims/storage';

/**
 * The phase the figures were computed at, and where that number came from. A union rather than a
 * number beside a boolean because the panel prints a different sentence for each case, and a
 * `phase` with a stale `isOverride` beside it is a state the panel cannot detect.
 */
export type PhaseSelection =
  | { readonly kind: 'farmScreen'; readonly phase: number }
  | { readonly kind: 'override'; readonly phase: number };

export type PanelUnavailableReason = 'noBirthRoll' | 'noRollBounds' | 'noAbilities';

/**
 * Whether a panel can draw itself, and if not, which named reason to print. A union rather than a
 * boolean with an optional string, so "unavailable with no reason" and "available but carrying a
 * reason" are both unrepresentable.
 */
export type PanelAvailability =
  | { readonly kind: 'available' }
  | { readonly kind: 'unavailable'; readonly reason: PanelUnavailableReason };

export type NextStatMode = 'damage' | 'farming';

/** Ranked best first, with the mode that was ASKED for — which is not always the mode that could
 *  be answered. */
export type NextStatRecommendation = {
  readonly mode: NextStatMode;
  /** When `'farming'` was asked for and could not be produced, these are the damage rows and
   *  {@link farmUnavailableReason} names why. */
  readonly rows: readonly PointValue[];
  readonly farmUnavailableReason: FarmPointRankOutcome | null;
  /** The phase the farming gains were measured at. `null` under `'damage'`. */
  readonly phase: number | null;
};

export type HeroDetailInputs = {
  readonly hero: HeroRecord;
  readonly account: AccountShared;
  readonly phaseSelection: PhaseSelection;
  readonly combat: ReturnType<typeof pipelineForHero>;
  /** `undefined` when not one statistic could be placed — see `rollQualityFor`, which never
   *  invents a mean for a hero nothing is known of. */
  readonly rollQuality: RollQualityReport | undefined;
  readonly abilityGains: readonly AbilityGain[];
  /**
   * AN INPUT, NEVER COMPUTED HERE. Its farming mode is scored against a rotation pool that one
   * host composes above the per-hero pipeline — the roster's enabled set, its live editor draft,
   * its max phase. Computing it inside this package would drag that host state into shared
   * components, which is the one thing this boundary exists to prevent.
   */
  readonly nextStat: NextStatRecommendation;
  readonly onSelectHero: (heroId: string) => void;
  /** `null` clears the override and returns the panels to the host's farm-screen phase. */
  readonly onOverridePhase: (phase: number | null) => void;
};
