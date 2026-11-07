import { describe, expect, it, vi } from 'vitest';
import { CapabilityError, type CapabilityContext } from '../capability-channel.js';
import { createPremiumWorkerCapability, PREMIUM_WORKER_MAX_BYTES } from './premium-worker.js';

type Ask = (slot: string, msg: unknown) => Promise<unknown>;

function setup(ask: Ask = () => Promise.resolve('pong')) {
  const clock = { ms: 1_000 };
  const records: Record<string, unknown>[] = [];
  const askWorker = vi.fn(ask);
  const handler = createPremiumWorkerCapability({
    channel: { askWorker },
    now: () => clock.ms,
    log: { info: (r) => records.push(r), warn: (r) => records.push(r), error: (r) => records.push(r) },
  });
  const call = (args: unknown, origin: CapabilityContext['origin'] = 'ui') =>
    (handler as unknown as (a: unknown, c: CapabilityContext) => Promise<unknown>)(args, { origin });
  return { clock, records, askWorker, call };
}

async function refusal(run: Promise<unknown>): Promise<{ code: string; reason: string | undefined } | null> {
  try {
    await run;
  } catch (thrown) {
    if (thrown instanceof CapabilityError) return { code: thrown.code, reason: thrown.reason };
    throw thrown;
  }
  return null;
}

/** A string whose JSON encoding is exactly `bytes` long (two quote marks plus the body). */
const jsonOf = (bytes: number): string => 'a'.repeat(bytes - 2);

describe('the premium.worker capability', () => {
  it('relays the screen message to the worker and returns its answer', async () => {
    const { call, askWorker } = setup((_slot, msg) => Promise.resolve({ echo: msg }));

    await expect(call({ q: 1 })).resolves.toEqual({ echo: { q: 1 } });

    expect(askWorker).toHaveBeenCalledWith('premium.tab', { q: 1 });
  });

  it('refuses the worker origin with not_granted and never asks', async () => {
    const { call, askWorker, records } = setup();

    expect(await refusal(call('hi', 'worker'))).toEqual({ code: 'not_granted', reason: undefined });

    expect(askWorker).not.toHaveBeenCalled();
    expect(records).toEqual([]);
  });

  it('passes unavailable/no_handler and failed/other through from the channel', async () => {
    const none = setup(() => Promise.reject(new CapabilityError('unavailable', 'no_handler')));
    const threw = setup(() => Promise.reject(new CapabilityError('failed', 'other')));

    expect(await refusal(none.call(1))).toEqual({ code: 'unavailable', reason: 'no_handler' });
    expect(await refusal(threw.call(1))).toEqual({ code: 'failed', reason: 'other' });
  });

  it('passes timeout, stopped and paused through from the channel', async () => {
    for (const code of ['timeout', 'stopped', 'paused'] as const) {
      const { call } = setup(() => Promise.reject(new CapabilityError(code)));
      expect(await refusal(call(1))).toEqual({ code, reason: undefined });
    }
  });

  it('accepts exactly 256 KiB of JSON and refuses one byte more, each way', async () => {
    const atLimit = jsonOf(PREMIUM_WORKER_MAX_BYTES);
    const over = jsonOf(PREMIUM_WORKER_MAX_BYTES + 1);

    const okBoth = setup(() => Promise.resolve(atLimit));
    await expect(okBoth.call(atLimit)).resolves.toBe(atLimit);

    const bigMsg = setup();
    expect(await refusal(bigMsg.call(over))).toEqual({ code: 'too_large', reason: 'bytes' });
    expect(bigMsg.askWorker).not.toHaveBeenCalled();

    const bigAnswer = setup(() => Promise.resolve(over));
    expect(await refusal(bigAnswer.call('x'))).toEqual({ code: 'too_large', reason: 'bytes' });
  });

  it('counts bytes, not characters', async () => {
    const wide = 'é'.repeat(PREMIUM_WORKER_MAX_BYTES / 2);

    expect(await refusal(setup().call(wide))).toEqual({ code: 'too_large', reason: 'bytes' });
  });

  it('audits the outcome and the time with no message or answer content', async () => {
    const secret = 'message-secret-9921';
    const h = setup(() => {
      h.clock.ms += 42;
      return Promise.resolve('answer-secret-5530');
    });
    const failing = setup(() => Promise.reject(new CapabilityError('failed', 'other')));

    await h.call(secret);
    await refusal(failing.call(secret));

    expect(h.records).toEqual([{ scope: 'premium', event: 'premium.worker_message', outcome: 'ok', ms: 42 }]);
    expect(failing.records).toEqual([
      { scope: 'premium', event: 'premium.worker_message', outcome: 'failed', ms: 0 },
    ]);
    expect(JSON.stringify([...h.records, ...failing.records])).not.toMatch(/secret/);
  });
});
