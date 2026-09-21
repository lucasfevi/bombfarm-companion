import type { ApplyPointsUnit, ApplyStopReason } from '@bombfarm/contracts';
import { WRITE_ROUTES, type HeroDetailReading } from '@bombfarm/game-api';
import { preflightPointsUnit } from '@bombfarm/domain/team-plan';
import type { ApplyRunContext, UnitResult } from './apply-run-context.js';

type ReadingStop = { readonly kind: 'stop'; readonly stop: Exclude<ApplyStopReason, 'finished'>; readonly code: string | null };
type ReadingSkip = { readonly kind: 'skip'; readonly reason: 'heroMissing'; readonly code?: string };

function mapReadingFailure(reading: Extract<HeroDetailReading, { kind: 'failed' }>): ReadingStop | ReadingSkip {
  switch (reading.reason) {
    case 'unauthorized':
      return { kind: 'stop', stop: 'unauthorized', code: reading.code ?? null };
    case 'transport_error':
    case 'malformed_json':
    case 'too_large':
    case 'bad_shape':
      return { kind: 'stop', stop: 'network', code: null };
    case 'http_error':
      if (reading.status === 404) return { kind: 'skip', reason: 'heroMissing' };
      if (reading.status !== undefined && reading.status >= 500) return { kind: 'stop', stop: 'network', code: null };
      return { kind: 'stop', stop: 'refused', code: `HTTP_${String(reading.status)}` };
    case 'api_error':
      return reading.code === 'NO_SUCH_HERO'
        ? { kind: 'skip', reason: 'heroMissing', code: reading.code }
        : { kind: 'stop', stop: 'refused', code: reading.code ?? null };
    case 'cooldown':
      // readDetail pauses and re-reads a cooldown internally; it never resolves with this reason.
      return { kind: 'stop', stop: 'network', code: null };
    default: {
      const exhaustive: never = reading.reason;
      return exhaustive;
    }
  }
}

function toStopResult(stop: ReadingStop, call: 'respec' | 'commit' | null, resetDone: boolean): UnitResult {
  return { kind: 'stop', stop: stop.stop, code: stop.code, call, resetDone };
}

export async function runPointsUnit(unit: ApplyPointsUnit, ctx: ApplyRunContext): Promise<UnitResult> {
  const reading = await ctx.readDetail(unit.heroId);
  if (reading === 'paused-out') {
    return { kind: 'stop', stop: 'stopped', code: null, call: null, resetDone: false };
  }
  if (reading.kind === 'failed') {
    const mapped = mapReadingFailure(reading);
    return mapped.kind === 'skip' ? mapped : toStopResult(mapped, null, false);
  }

  const verdict = preflightPointsUnit(unit, { alloc: reading.alloc, spent: reading.spent });
  if (verdict.status === 'done') {
    return { kind: 'skip', reason: 'alreadyDone' };
  }
  if (verdict.status === 'conflict') {
    return { kind: 'skip', reason: 'allocationChanged' };
  }

  const cost = verdict.status === 'pendingFull' ? (reading.respecGold ?? unit.respecGold) : 0;
  if (verdict.status === 'pendingFull') {
    const wallet = ctx.wallet();
    if (wallet !== null && cost > wallet) {
      return { kind: 'skip', reason: 'notEnoughGold' };
    }

    const respecVerdict = await ctx.call('respec', { route: WRITE_ROUTES.respec, hero: unit.heroId });
    if (respecVerdict.kind === 'skip') return respecVerdict;
    if (respecVerdict.kind === 'stop') return toStopResult(respecVerdict, 'respec', false);
    if (respecVerdict.kind === 'cooldown') {
      // ctx.call pauses and resends a cooldown internally; it never resolves with this kind.
      return { kind: 'stop', stop: 'network', code: null, call: 'respec', resetDone: false };
    }
  }

  const commitVerdict = await ctx.call('commit', { route: WRITE_ROUTES.commit, hero: unit.heroId, points: unit.vector });
  if (commitVerdict.kind === 'ok') {
    return { kind: 'ok', goldSpent: cost };
  }
  if (commitVerdict.kind === 'skip') {
    return commitVerdict.code === undefined
      ? { kind: 'skip', reason: 'resetNotPlaced' }
      : { kind: 'skip', reason: 'resetNotPlaced', code: commitVerdict.code };
  }
  if (commitVerdict.kind === 'stop') {
    return toStopResult(commitVerdict, 'commit', true);
  }
  // ctx.call pauses and resends a cooldown internally; it never resolves with this kind.
  return { kind: 'stop', stop: 'network', code: null, call: 'commit', resetDone: true };
}
