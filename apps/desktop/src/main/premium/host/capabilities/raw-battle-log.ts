import {
  createBattleLogTailer,
  type BattleLogPayload,
  type BattleLogTailer,
  type BattleLogTailerDeps,
} from '../../tracking/battle-log-tailer.js';
import { CapabilityError, withOrigin, type CapabilityChannel, type CapabilityHandler } from '../capability-channel.js';

/** At most this many batches may be unacknowledged; a change waits for an ack instead of queueing. */
export const BATTLE_LOG_MAX_IN_FLIGHT = 4;

export interface RawBattleLogDeps {
  readonly channel: Pick<CapabilityChannel, 'emit' | 'inFlight' | 'onAck'>;
  /** The tailer's inputs; the capability supplies `send`. */
  readonly tailer: Omit<BattleLogTailerDeps, 'send'>;
}

export interface RawBattleLogCapability {
  /** The `raw.battleLog` handler: `{op: 'subscribe' | 'unsubscribe'}` from the worker; the UI is refused. */
  readonly handler: CapabilityHandler;
  /** The channel paused: stop watching, keep the subscription. */
  pause(): void;
  /** The channel resumed: watch again; the next send carries `baseline: true`. */
  resume(): void;
  /** The worker stopped, restarted or was removed: end the subscription. */
  stop(): void;
  readonly subscribed: boolean;
}

/**
 * `raw.battleLog`: the licensed account's battle-log section, sent when it changes. The subscription
 * survives pause and resume; nothing is delivered or kept while paused. The free app never builds
 * this.
 */
export function createRawBattleLogCapability(deps: RawBattleLogDeps): RawBattleLogCapability {
  const { channel } = deps;
  let subscribed = false;
  let paused = false;
  let itemSeq = 0;
  let tailer: BattleLogTailer | undefined;
  let stopAcks: (() => void) | undefined;

  function send(payload: BattleLogPayload): boolean {
    if (channel.inFlight >= BATTLE_LOG_MAX_IN_FLIGHT) return false;
    const seq = itemSeq + 1;
    if (channel.emit('raw.battleLog', [{ seq, ...payload }]) === null) return false;
    itemSeq = seq;
    return true;
  }

  function end(): void {
    subscribed = false;
    tailer?.stop();
    tailer = undefined;
    stopAcks?.();
    stopAcks = undefined;
  }

  const handler = withOrigin((args, ctx) => {
    if (ctx.origin !== 'worker') throw new CapabilityError('not_granted');
    const op = typeof args === 'object' && args !== null ? (args as Record<string, unknown>).op : undefined;
    if (op === 'subscribe') {
      if (subscribed) return null;
      subscribed = true;
      itemSeq = 0;
      tailer = createBattleLogTailer({ ...deps.tailer, send });
      stopAcks = channel.onAck(() => {
        tailer?.poke();
      });
      if (!paused) tailer.start();
      return null;
    }
    if (op === 'unsubscribe') {
      end();
      return null;
    }
    throw new CapabilityError('bad_args');
  });

  return {
    handler,
    pause() {
      paused = true;
      tailer?.stop();
    },
    resume() {
      paused = false;
      if (subscribed) tailer?.start();
    },
    stop: end,
    get subscribed() {
      return subscribed;
    },
  };
}
