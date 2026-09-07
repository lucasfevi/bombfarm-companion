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
