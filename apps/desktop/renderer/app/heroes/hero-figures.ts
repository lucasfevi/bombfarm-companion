/**
 * Whether the phase-scoped half of a hero's detail can be drawn, and at which phase.
 *
 * Four answers, because they need four different sentences on screen. "The Farm selection has not
 * been read yet" is a frame, not a state a player can act on. "That is not a phase" is something
 * they typed and can correct. "Not enough of your account has been read" is about the account and
 * not about the phase at all. And the fourth is the figures themselves. Collapsing any pair would
 * put a wrong explanation under a blank panel.
 */
import type { PhaseSelection } from '@bombfarm/hero/core';
import { hasUnrecoveredPoints, type AccountRoster } from '../../lib/account/account-roster';
import { heroComputeInputs, type HeroComputeInputs } from './hero-compute-inputs';
import type { HeroPhaseReading } from './hero-phase';

export type HeroFigures =
  | { readonly kind: 'pending' }
  | { readonly kind: 'unknownPhase' }
  | { readonly kind: 'withheld' }
  /** The account was read, but this hero's spent points could not be — every figure below the
   *  identity panel is built on them, so none may be drawn from the zeroed vector. */
  | { readonly kind: 'pointsUnread' }
  | {
      readonly kind: 'at';
      readonly selection: PhaseSelection;
      readonly inputs: HeroComputeInputs;
    };

export function heroFigures(reading: HeroPhaseReading, roster: AccountRoster, heroId: string): HeroFigures {
  if (reading.kind === 'pending') return { kind: 'pending' };
  if (reading.kind === 'unknown') return { kind: 'unknownPhase' };
  if (hasUnrecoveredPoints(roster, heroId)) return { kind: 'pointsUnread' };

  const inputs = heroComputeInputs(roster, reading.selection.phase);
  if (inputs === null) return { kind: 'withheld' };

  return { kind: 'at', selection: reading.selection, inputs };
}
