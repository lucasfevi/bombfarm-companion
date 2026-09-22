import { DEFAULT_CASA_SLOTS } from '../casa-slots';
import type { FarmAccount } from '../farm-rate';
import { wikiPhaseLine } from '../phase-wiki';
import { phaseLine } from '../phases';
import { rankRosterByDps } from '../roster-dps';
import type { HeroRecord } from '../shims/storage';

export { PVP_WINDOW_SECS, defaultGatePhase, gateWindowSecs, resolveGatePhase, wikiGateLines } from '../combat-window';

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
