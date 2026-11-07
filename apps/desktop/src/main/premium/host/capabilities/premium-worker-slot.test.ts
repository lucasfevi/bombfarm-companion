import { describe, expect, it, vi } from 'vitest';
import { CapabilityError, type CapabilityContext } from '../capability-channel.js';
import { createPremiumWorkerCapability } from './premium-worker.js';

function setup() {
  const askWorker = vi.fn((_slot: string, _msg: unknown) => Promise.resolve('pong'));
  const handler = createPremiumWorkerCapability({
    channel: { askWorker },
    now: () => 0,
    log: { info: () => undefined, warn: () => undefined, error: () => undefined },
  });
  const call = (ctx: CapabilityContext) =>
    (handler as unknown as (a: unknown, c: CapabilityContext) => Promise<unknown>)('hi', ctx);
  return { askWorker, call };
}

describe('premium.worker names the caller slot', () => {
  it('asks the worker for the slot the call came from', async () => {
    const { call, askWorker } = setup();
    await call({ origin: 'ui', slot: 'live.section' });
    expect(askWorker).toHaveBeenCalledWith('live.section', 'hi');
  });

  it('falls back to the Premium tab when the call names no slot', async () => {
    const { call, askWorker } = setup();
    await call({ origin: 'ui' });
    expect(askWorker).toHaveBeenCalledWith('premium.tab', 'hi');
  });

  it('refuses bad_args for a slot that is unknown or not granted, and never asks', async () => {
    const { call, askWorker } = setup();
    await expect(call({ origin: 'ui', slot: null })).rejects.toEqual(new CapabilityError('bad_args'));
    expect(askWorker).not.toHaveBeenCalled();
  });
});
