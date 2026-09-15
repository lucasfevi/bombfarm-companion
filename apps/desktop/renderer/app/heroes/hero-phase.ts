/**
 * The one phase the Heroes screen's per-hero figures are computed at.
 *
 * The wiki tables the whole model is built on describe a fixed run of phases. A number outside it
 * is not a phase this application knows anything about, and every table lookup underneath silently
 * CLAMPS rather than refusing — asked about phase 900 the wiki row reader answers with the last
 * row it has. So the clamp happens here, once, where the screen can also say which phase the
 * figures ended up belonging to.
 */
import { WIKI_PHASE_LINES } from '@bombfarm/domain/phase-wiki';
import type { PhaseSelection } from '@bombfarm/hero/core';

/** The last phase the shipped wiki tables describe. Read off the table rather than restated, so a
 *  refreshed table moves this with it. */
export const LAST_KNOWN_PHASE = WIKI_PHASE_LINES.length;

/**
 * `null` for anything that is not a phase at all — an absent reading, a non-finite number. A
 * finite number outside the known run is clamped into it, because a player asking for phase 900 is
 * asking about the hardest phase there is, not about nothing.
 */
export function clampToKnownPhase(phase: number | null | undefined): number | null {
  if (phase === null || phase === undefined) return null;
  if (!Number.isFinite(phase)) return null;
  if (LAST_KNOWN_PHASE === 0) return null;
  return Math.min(LAST_KNOWN_PHASE, Math.max(1, Math.round(phase)));
}

/**
 * The Farm screen's own selection as this screen reads it: the phase whose detail the player had
 * open there, and whether it has been read yet at all.
 *
 * Read-only, in both directions. This screen never writes the Farm screen's stored view, and the
 * Farm screen never learns about an override made here — the two are one player's two questions
 * about the same account, and answering one must not silently re-answer the other.
 */
export type FarmPhaseSelection = {
  readonly ready: boolean;
  readonly phase: number | null;
};

/** The phase the Farm screen shows when the player has selected none — this screen opens on the
 *  same one, so the two never disagree about what "no selection" means. */
export const DEFAULT_FARM_PHASE = 1;

/**
 * What phase the figures belong to, or why there is none.
 *
 * `pending` and `unknown` are apart on purpose: one is "nobody has read the Farm selection yet",
 * which resolves by itself a frame later, and the other is "you asked about something that is not
 * a phase", which the player has to change. Drawing figures for either would be drawing them for a
 * stage nobody named.
 */
export type HeroPhaseReading =
  | { readonly kind: 'pending' }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'at'; readonly selection: PhaseSelection };

/**
 * An override wins over the Farm selection while it is set, and clearing it hands the screen back
 * to Farm — which is why the override is a phase-or-nothing rather than a second stored phase: no
 * state exists in which the two disagree about which one is in force.
 */
export function readHeroPhase(
  farm: FarmPhaseSelection,
  overridePhase: number | null,
): HeroPhaseReading {
  if (!farm.ready) return { kind: 'pending' };

  if (overridePhase !== null) {
    const phase = clampToKnownPhase(overridePhase);
    return phase === null ? { kind: 'unknown' } : { kind: 'at', selection: { kind: 'override', phase } };
  }

  const phase = clampToKnownPhase(farm.phase ?? DEFAULT_FARM_PHASE);
  return phase === null ? { kind: 'unknown' } : { kind: 'at', selection: { kind: 'farmScreen', phase } };
}

/** The phase a control should show — the one in force, whichever half of the pair supplied it. */
export function shownHeroPhase(reading: HeroPhaseReading, overridePhase: number | null): number {
  if (reading.kind === 'at') return reading.selection.phase;
  return overridePhase ?? DEFAULT_FARM_PHASE;
}
