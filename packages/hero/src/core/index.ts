/**
 * `@bombfarm/hero/core` — presentation-free per-hero detail types.
 *
 * A host app maps its own state onto {@link HeroDetailInputs} and passes it down. Nothing here
 * imports a store library, React, or either app.
 */
export type {
  HeroDetailInputs,
  NextStatMode,
  NextStatRecommendation,
  PanelAvailability,
  PanelUnavailableReason,
  PhaseSelection,
} from './hero-detail-inputs';
