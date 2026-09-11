/**
 * `@bombfarm/team-plan/core` — presentation-free optimizer logic.
 *
 * A host app maps its own state onto `TeamPlanInputs` and `TeamPlanControls`, owns the
 * controls' storage, and calls the rules here to decide when a plan is stale and which
 * control changes clear it. Nothing here imports React or a store library.
 */
