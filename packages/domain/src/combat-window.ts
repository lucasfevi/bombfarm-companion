import { GATE_SECS_POR_ATO, WIKI_PHASE_LINES, wikiPhaseLine } from './phase-wiki';

/** A duel is fought over one minute — the game's `duelo_secs`. */
export const PVP_WINDOW_SECS = 60;

/**
 * The squad slots of the top squad house. A duel squad's slots grow with the account's squad
 * house — two, four, six, eight, then nine — and the game reports the account's own figure with
 * its PVP standing; this stands in only while no standing has been read, and on a host that has
 * no PVP source at all. The live wiki agrees on nine.
 */
export const PVP_TOP_HOUSE_SQUAD_SLOTS = 9;

/** The slots a duel squad has: the account's own as the game last reported them, else the top
 *  house's. */
export function pvpSquadSlots(reported: number | null | undefined): number {
  return reported != null && Number.isInteger(reported) && reported > 0 ? reported : PVP_TOP_HOUSE_SQUAD_SLOTS;
}

export function wikiGateLines(): (typeof WIKI_PHASE_LINES)[number][] {
  return WIKI_PHASE_LINES.filter((line) => line.gate);
}

/** The first gate at or past `fromPhase` — the one the account is about to face. */
export function defaultGatePhase(fromPhase: number): number {
  const gates = wikiGateLines();
  const next = gates.find((line) => line.phase >= fromPhase) ?? gates[0];
  if (next === undefined) throw new Error('wiki bundle has no gate phases');
  return next.phase;
}

/** A stored pick when it still names a gate, else the account's next one. */
export function resolveGatePhase(stored: number | null | undefined, fromPhase: number): number {
  if (stored != null && wikiPhaseLine(stored)?.gate === true) return stored;
  return defaultGatePhase(fromPhase);
}

/** The gate timer for a phase's act — the first act's when the phase is not a gate. */
export function gateWindowSecs(phase: number): number {
  const line = wikiPhaseLine(phase);
  const ato = line?.gate === true ? line.ato : (wikiGateLines()[0]?.ato ?? 1);
  const secs = GATE_SECS_POR_ATO[ato - 1];
  if (secs === undefined) throw new Error('missing gate timer for act');
  return secs;
}
