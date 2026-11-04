import { describe, expect, it, vi } from 'vitest';
import type { CapabilityReply } from '@bombfarm/contracts';
import { createPremiumBridge, type PremiumCallError } from './premium-bridge';

const answering = (reply: CapabilityReply) => vi.fn(() => Promise.resolve(reply));

describe('the prop carries its slot', () => {
  it('is the Premium tab unless told otherwise', () => {
    expect(createPremiumBridge(answering({ id: 0, ok: true, value: null })).prop.slot).toBe('premium.tab');
  });

  it('names the live section on the prop and on every call it sends', async () => {
    const invoke = answering({ id: 0, ok: true, value: 1 });
    const { prop } = createPremiumBridge(invoke, 'live.section');
    await prop.call('store', { k: 1 });
    expect(prop.slot).toBe('live.section');
    expect(invoke).toHaveBeenCalledWith('store', { k: 1 }, 'live.section');
  });

  it('reads slot on the prop without adding a key to it', () => {
    const { prop } = createPremiumBridge(answering({ id: 0, ok: true, value: null }), 'live.section');
    expect(prop.slot).toBe('live.section');
    expect(Object.keys(prop).sort()).toEqual(['call', 'on']);
  });
});

describe('a refused call', () => {
  it('rejects with the code and the reason the host gave', async () => {
    const { prop } = createPremiumBridge(answering({ id: 0, ok: false, error: 'unavailable', reason: 'no_handler' }));
    const error = (await prop.call('premium.worker', 1).catch((e: unknown) => e)) as PremiumCallError;
    expect(error.message).toBe('unavailable');
    expect(error.code).toBe('unavailable');
    expect(error.reason).toBe('no_handler');
  });

  it('carries no reason when the host named none', async () => {
    const { prop } = createPremiumBridge(answering({ id: 0, ok: false, error: 'paused' }));
    const error = (await prop.call('store').catch((e: unknown) => e)) as PremiumCallError;
    expect(error.code).toBe('paused');
    expect(error.reason).toBeUndefined();
  });
});
