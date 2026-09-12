/**
 * Everything a per-hero figure on this screen is computed from, or nothing at all.
 *
 * Three things have to be in hand together — the account-wide block, a phase the application
 * knows, and that phase's mitigation. A screen that filled any one of them in with a default would
 * print a confident number about a stage nobody read, which is the whole reason this returns `null`
 * rather than a partially-defaulted record.
 */
import { computePhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { buildAccountBlock, type AccountBlock } from '../../lib/account/account-shared';
import type { AccountRoster } from '../../lib/account/account-roster';

export type HeroComputeInputs = {
  /** The block every hero shares; each hero's own aura total is overlaid at the pipeline call. */
  readonly account: AccountBlock;
  readonly phase: number;
  readonly mitigationPct: number;
};

export function heroComputeInputs(
  roster: AccountRoster,
  phase: number | null,
): HeroComputeInputs | null {
  if (phase === null) return null;

  const account = buildAccountBlock(roster);
  if (account === null) return null;

  const intel = computePhaseIntelGlobal(phase);
  if (intel === null) return null;

  return { account, phase: intel.phase, mitigationPct: intel.mitigationPct };
}
