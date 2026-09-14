import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import type { TeamPlanRunStatus } from '@bombfarm/team-plan/core';

export type SolveRequestInput = {
  booted: boolean;
  inputsUsable: boolean;
  plan: TeamPlan | null;
  runStatus: TeamPlanRunStatus;
  stale: boolean;
  liveSignature: string;
  lastRequestedSignature: string | null;
};

export function shouldRequestSolve(input: SolveRequestInput): boolean {
  if (!input.booted || !input.inputsUsable) return false;
  const signatureChanged = input.liveSignature !== input.lastRequestedSignature;
  if (input.plan == null) {
    if (input.runStatus === 'idle') return true;
    return (input.runStatus === 'blocked' || input.runStatus === 'error') && signatureChanged;
  }
  return input.stale && input.runStatus === 'done' && signatureChanged;
}

let lastRequestedSignature: string | null = null;

export function getLastRequestedSignature(): string | null {
  return lastRequestedSignature;
}

export function noteSolveRequested(signature: string): void {
  lastRequestedSignature = signature;
}

export function resetHomeSolveMemoryForTests(): void {
  lastRequestedSignature = null;
}
