import { CapabilityError, withOrigin, type CapabilityHandler } from '../capability-channel.js';

export interface RawTapCapabilityDeps {
  readonly feed: { subscribe(): void; unsubscribe(): void };
}

/**
 * `raw.tap`: `{op: 'subscribe' | 'unsubscribe'}` starts or stops the game feed for the worker. The
 * Premium screen may not subscribe: only the worker reads the feed.
 */
export function createRawTapCapability(deps: RawTapCapabilityDeps): CapabilityHandler {
  return withOrigin((args, ctx) => {
    if (ctx.origin !== 'worker') throw new CapabilityError('not_granted');
    const op = typeof args === 'object' && args !== null ? (args as Record<string, unknown>)['op'] : undefined;
    if (op === 'subscribe') deps.feed.subscribe();
    else if (op === 'unsubscribe') deps.feed.unsubscribe();
    else throw new CapabilityError('bad_args');
    return null;
  });
}
