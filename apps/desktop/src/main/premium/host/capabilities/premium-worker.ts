import type { LogPort } from '../../../storage/index.js';
import { CapabilityError, withOrigin, type CapabilityChannel, type CapabilityHandler } from '../capability-channel.js';

/** The screen's message and the worker's answer are each at most this many bytes of JSON. */
export const PREMIUM_WORKER_MAX_BYTES = 256 * 1024;

export interface PremiumWorkerCapabilityDeps {
  readonly channel: Pick<CapabilityChannel, 'askWorker'>;
  /** Milliseconds from any steady clock; times the round trip for the audit record. */
  readonly now: () => number;
  readonly log: LogPort;
}

/** The JSON size of a value, or `null` when it cannot be sent as JSON at all. */
function jsonBytes(value: unknown): number | null {
  try {
    const json = JSON.stringify(value === undefined ? null : value) as string | undefined;
    return json === undefined ? null : Buffer.byteLength(json, 'utf8');
  } catch {
    return null;
  }
}

/**
 * `premium.worker`: the Premium screen asks its own worker a question and gets its answer. Only the
 * screen may call; the worker is refused. The message and the answer are 256 KiB of JSON each. The
 * audit record carries the outcome and the time taken, never the message or the answer.
 */
export function createPremiumWorkerCapability(deps: PremiumWorkerCapabilityDeps): CapabilityHandler {
  function audit(outcome: string, startedAt: number): void {
    deps.log.info({ scope: 'premium', event: 'premium.worker_message', outcome, ms: deps.now() - startedAt });
  }

  return withOrigin(async (args, ctx) => {
    if (ctx.origin !== 'ui') throw new CapabilityError('not_granted');
    const startedAt = deps.now();
    try {
      const sent = jsonBytes(args);
      if (sent === null) throw new CapabilityError('bad_args');
      if (sent > PREMIUM_WORKER_MAX_BYTES) throw new CapabilityError('too_large', 'bytes');
      // A call that names no slot comes from the Premium tab; a slot that is unknown or not granted is refused.
      if (ctx.slot === null) throw new CapabilityError('bad_args');
      const answer = await deps.channel.askWorker(ctx.slot ?? 'premium.tab', args);
      const received = jsonBytes(answer);
      if (received === null) throw new CapabilityError('failed', 'other');
      if (received > PREMIUM_WORKER_MAX_BYTES) throw new CapabilityError('too_large', 'bytes');
      audit('ok', startedAt);
      return answer;
    } catch (thrown) {
      audit(thrown instanceof CapabilityError ? thrown.code : 'error', startedAt);
      throw thrown;
    }
  });
}
