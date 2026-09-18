import { DEFAULT_CASA_SLOTS } from '../casa-slots';
import type { FarmAccount } from '../farm-rate';
import { GATE_SECS_POR_ATO, WIKI_PHASE_LINES, wikiPhaseLine } from '../phase-wiki';
import { phaseLine } from '../phases';
import { rankRosterByDps } from '../roster-dps';
import type { HeroRecord } from '../shims/storage';

export const PVP_WINDOW_SECS = 60;

export function wikiGateLines(): (typeof WIKI_PHASE_LINES)[number][] {
  return WIKI_PHASE_LINES.filter((line) => line.gate);
}

export function defaultGatePhase(fromPhase: number): number {
  const gates = wikiGateLines();
  const next = gates.find((line) => line.phase >= fromPhase) ?? gates[0];
  if (next === undefined) throw new Error('wiki bundle has no gate phases');
  return next.phase;
}

export function resolveGatePhase(stored: number | null | undefined, fromPhase: number): number {
  if (stored != null && wikiPhaseLine(stored)?.gate === true) return stored;
  return defaultGatePhase(fromPhase);
}

export function gateWindowSecs(phase: number): number {
  const line = wikiPhaseLine(phase);
  const ato = line?.gate === true ? line.ato : (wikiGateLines()[0]?.ato ?? 1);
  const secs = GATE_SECS_POR_ATO[ato - 1];
  if (secs === undefined) throw new Error('missing gate timer for act');
  return secs;
}

export function skillTreeGateRosterIds(input: {
  readonly heroes: readonly HeroRecord[];
  readonly account: FarmAccount;
  readonly enabledHeroIds: readonly string[] | null;
  readonly phase: number;
  readonly fieldSlots: number;
  readonly teamBuffs?: Record<string, number>;
}): string[] {
  const ids = input.enabledHeroIds;
  const pool =
    ids == null
      ? input.heroes.filter((hero) => hero.battleAllowed !== false)
      : input.heroes.filter((hero) => ids.includes(hero.id));
  const line = wikiPhaseLine(input.phase) ?? phaseLine(input.phase);
  const mitigationPct = +((line?.mitig ?? 0.01) * 100).toFixed(2);
  const slots = Number.isFinite(input.fieldSlots) && input.fieldSlots >= 1 ? Math.round(input.fieldSlots) : 1;
  return rankRosterByDps(
    {
      heroes: [...pool],
      account: { ...input.account, teamBuffs: input.teamBuffs ?? {} },
      phase: input.phase,
      mitigationPct,
    },
    slots,
  ).map((row) => row.heroId);
}

export function fieldSlotsForSkillTree(account: FarmAccount, fallback: number = DEFAULT_CASA_SLOTS): number {
  const slots = account.fieldSlots ?? account.slots ?? fallback;
  return Number.isFinite(slots) && slots >= 1 ? Math.round(slots) : 1;
}
