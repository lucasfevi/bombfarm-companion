import { describe, expect, it, vi } from 'vitest';
import { createCapabilityChannel, withOrigin, type CapabilityContext, type CapabilityPort } from './capability-channel.js';

function channelFor(requested: readonly string[]) {
  const seen: CapabilityContext[] = [];
  const port: CapabilityPort = { on: () => undefined, postMessage: vi.fn(), start: () => undefined, close: () => undefined };
  const channel = createCapabilityChannel({
    port,
    requested: ['store', ...requested],
    allowlist: new Map([['store', withOrigin((_args, ctx) => seen.push(ctx))]]),
    sequence: 1,
    now: () => 0,
    log: { info: () => undefined, warn: () => undefined, error: () => undefined },
  });
  return { channel, seen };
}

describe('a screen call carries its slot to the capability', () => {
  it('passes a granted slot through, and leaves a call with none unnamed', async () => {
    const { channel, seen } = channelFor(['live.section']);
    await channel.callFromUi({ id: 1, capability: 'store', args: null, slot: 'live.section' });
    await channel.callFromUi({ id: 2, capability: 'store', args: null });
    expect(seen).toEqual([
      { origin: 'ui', slot: 'live.section' },
      { origin: 'ui', slot: undefined },
    ]);
  });

  it('marks a slot the bundle never declared, or one that does not exist, as null', async () => {
    const { channel, seen } = channelFor([]);
    await channel.callFromUi({ id: 1, capability: 'store', args: null, slot: 'live.section' });
    await channel.callFromUi({ id: 2, capability: 'store', args: null, slot: 'nav.top' as never });
    expect(seen.map((ctx) => ctx.slot)).toEqual([null, null]);
  });
});
