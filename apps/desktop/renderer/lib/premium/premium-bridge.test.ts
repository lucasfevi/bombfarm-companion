import { describe, expect, it, vi } from 'vitest';
import type { CapabilityReply, PremiumHostView } from '@bombfarm/contracts';
import { createPremiumBridge, type PremiumUiInvoke } from './premium-bridge';

const host = (rest: Partial<PremiumHostView> = {}): PremiumHostView => ({
  phase: 'running',
  uiUrl: 'app://bundle/_premium/7/ui/index.js',
  styleUrl: null,
  localBuild: false,
  ...rest,
});

const answering = (reply: CapabilityReply): PremiumUiInvoke => vi.fn(() => Promise.resolve(reply));

describe('the prop the Premium screen calls', () => {
  it('resolves with the value of an answered call and sends the capability and arguments as given', async () => {
    const invoke = answering({ id: 0, ok: true, value: { n: 3 } });
    const { prop } = createPremiumBridge(invoke);

    await expect(prop.call('store', { op: 'get', key: 'k' })).resolves.toEqual({ n: 3 });
    expect(invoke).toHaveBeenCalledWith('store', { op: 'get', key: 'k' });
  });

  it.each(['not_granted', 'rate_limited', 'paused', 'stopped', 'bad_call', 'bad_args', 'too_large', 'unavailable'] as const)(
    'rejects a %s refusal with an Error carrying only the code',
    async (error) => {
      const { prop } = createPremiumBridge(answering({ id: 0, ok: false, error }));
      await expect(prop.call('store')).rejects.toThrow(new Error(error));
    },
  );

  it('rejects unavailable when the call cannot reach main', async () => {
    const { prop } = createPremiumBridge(() => Promise.reject(new Error('channel closed with detail')));
    await expect(prop.call('store')).rejects.toThrow(new Error('unavailable'));
  });

  it('rejects unavailable where there is no preload bridge', async () => {
    const { prop } = createPremiumBridge();
    await expect(prop.call('store')).rejects.toThrow(new Error('unavailable'));
  });

  it('offers exactly call and on', () => {
    expect(Object.keys(createPremiumBridge(answering({ id: 0, ok: true, value: null })).prop).sort()).toEqual(['call', 'on']);
  });
});

describe('the pause events', () => {
  it('fires paused with the reason from the view, and resumed once it clears', () => {
    const bridge = createPremiumBridge(answering({ id: 0, ok: true, value: null }));
    const paused = vi.fn();
    const resumed = vi.fn();
    bridge.prop.on('paused', paused);
    bridge.prop.on('resumed', resumed);

    bridge.feed(host());
    expect(paused).not.toHaveBeenCalled();

    bridge.feed(host({ phase: 'paused', uiUrl: null, paused: { reason: 'other_account' } }));
    expect(paused).toHaveBeenCalledTimes(1);
    expect(paused).toHaveBeenCalledWith({ reason: 'other_account' });

    bridge.feed(host({ phase: 'paused', uiUrl: null, paused: { reason: 'other_account' } }));
    expect(paused).toHaveBeenCalledTimes(1);

    bridge.feed(host());
    expect(resumed).toHaveBeenCalledTimes(1);
    expect(resumed).toHaveBeenCalledWith({ reason: undefined });
  });

  it('fires paused with no reason when the view names none', () => {
    const bridge = createPremiumBridge(answering({ id: 0, ok: true, value: null }));
    const paused = vi.fn();
    bridge.prop.on('paused', paused);
    bridge.feed(host({ phase: 'paused', uiUrl: null }));
    expect(paused).toHaveBeenCalledWith({ reason: undefined });
  });

  it('stops calling a listener once it unsubscribes, and leaves the others', () => {
    const bridge = createPremiumBridge(answering({ id: 0, ok: true, value: null }));
    const first = vi.fn();
    const second = vi.fn();
    const off = bridge.prop.on('paused', first);
    bridge.prop.on('paused', second);
    off();

    bridge.feed(host({ phase: 'paused', uiUrl: null, paused: { reason: 'unconfirmed' } }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('treats a missing host as not paused', () => {
    const bridge = createPremiumBridge(answering({ id: 0, ok: true, value: null }));
    const resumed = vi.fn();
    bridge.prop.on('resumed', resumed);
    bridge.feed(host({ phase: 'paused', uiUrl: null }));
    bridge.feed(null);
    expect(resumed).toHaveBeenCalledTimes(1);
  });
});
