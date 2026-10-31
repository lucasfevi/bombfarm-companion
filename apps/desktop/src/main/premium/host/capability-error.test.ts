import { describe, expect, it } from 'vitest';
import { CapabilityError, createCapabilityChannel, type CapabilityHandler } from './capability-channel.js';

function channelWith(handler: CapabilityHandler) {
  const logs: Record<string, unknown>[] = [];
  const channel = createCapabilityChannel({
    port: { on: () => undefined, postMessage: () => undefined, start: () => undefined, close: () => undefined },
    requested: ['alpha'],
    allowlist: new Map([['alpha', handler]]),
    sequence: 3,
    now: () => 0,
    log: { info: (r) => logs.push(r), warn: (r) => logs.push(r), error: (r) => logs.push(r) },
    knownCapabilities: ['alpha'],
  });
  return { channel, logs };
}

describe('a handler that refuses with a reason', () => {
  it.each(['bad_args', 'too_large', 'unavailable'] as const)('answers %s and audits it', async (code) => {
    const { channel, logs } = channelWith(() => {
      throw new CapabilityError(code);
    });

    await expect(channel.callFromUi({ id: 4, capability: 'alpha', args: null })).resolves.toEqual({
      id: 4,
      ok: false,
      error: code,
    });
    expect(logs).toEqual([
      { scope: 'premium', event: 'premium.capability', capability: 'alpha', outcome: code, sequence: 3 },
    ]);
  });

  it('keeps its reason when the handler rejects later', async () => {
    const { channel } = channelWith(() => Promise.reject(new CapabilityError('too_large')));

    await expect(channel.callFromUi({ id: 5, capability: 'alpha', args: null })).resolves.toEqual({
      id: 5,
      ok: false,
      error: 'too_large',
    });
  });

  it('still answers any other failure bad_call, audited as error', async () => {
    const { channel, logs } = channelWith(() => {
      throw new Error('boom');
    });

    await expect(channel.callFromUi({ id: 6, capability: 'alpha', args: null })).resolves.toEqual({
      id: 6,
      ok: false,
      error: 'bad_call',
    });
    expect(logs[0]?.['outcome']).toBe('error');
  });
});
