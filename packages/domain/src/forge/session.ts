export type ForgeOutcome = 'success' | 'critical' | 'fail';
export type ForgeCallKind = 'safe' | 'roll';

export function classifyForgeRoll(opts: {
  after: number;
  target: number;
  kind?: ForgeCallKind;
  serverCritical?: boolean;
}): ForgeOutcome {
  const { after, target, kind = 'roll', serverCritical = false } = opts;
  if (kind === 'safe') return after >= target ? 'success' : 'fail';
  if (serverCritical || after > target) return 'critical';
  return after >= target ? 'success' : 'fail';
}

export type ForgeStopReason =
  | 'target'
  | 'attempts'
  | 'budget'
  | 'cancelled'
  | 'cooldown'
  | 'shortfall'
  | 'missing'
  | 'error';

export type ForgeLimits = { target: number; maxAttempts: number | null; maxGold: number | null };

export type ForgeSessionState = {
  upgrade: number;
  attempt: number;
  spent: number;
  cancelled: boolean;
  nextCost: number;
  wallet: number | null;
};

export function evalForgeStop(state: ForgeSessionState, limits: ForgeLimits): ForgeStopReason | null {
  if (state.upgrade >= limits.target) return 'target';
  if (state.cancelled) return 'cancelled';
  if (limits.maxAttempts != null && state.attempt >= limits.maxAttempts) return 'attempts';
  if (limits.maxGold != null && state.spent + state.nextCost > limits.maxGold) return 'budget';
  if (state.wallet != null && state.wallet < state.nextCost) return 'shortfall';
  return null;
}

export type ForgeTally = { rolls: number; fails: number; crits: number; safeJumps: number; spent: number };

export function emptyForgeTally(): ForgeTally {
  return { rolls: 0, fails: 0, crits: 0, safeJumps: 0, spent: 0 };
}

export function foldForgeStep(
  tally: ForgeTally,
  step: { outcome: ForgeOutcome; kind: ForgeCallKind; cost: number },
): ForgeTally {
  return {
    rolls: tally.rolls + (step.kind === 'roll' ? 1 : 0),
    fails: tally.fails + (step.outcome === 'fail' ? 1 : 0),
    crits: tally.crits + (step.outcome === 'critical' ? 1 : 0),
    safeJumps: tally.safeJumps + (step.kind === 'safe' ? 1 : 0),
    spent: tally.spent + step.cost,
  };
}
