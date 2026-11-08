import { describe, expect, it, vi } from 'vitest';
import type { HostToWorker } from '@bombfarm/contracts';
import { createCapabilityChannel, type CapabilityPort } from '../capability-channel.js';
import { createRawTapCapability } from './raw-tap.js';

class FakePort implements CapabilityPort {
  readonly posted: HostToWorker[] = [];
  private listener: ((event: { data: unknown }) => void) | null = null;
  on(_event: 'message', listener: (event: { data: unknown }) => void): this {
    this.listener = listener;
    return this;
  }
  postMessage(message: HostToWorker): void {
    this.posted.push(message);
  }
  start(): void {
    // nothing to start
  }
  close(): void {
    // nothing to close
  }
  send(data: unknown): void {
    this.listener?.({ data });
  }
}

function setup() {
  const feed = { subscribe: vi.fn(), unsubscribe: vi.fn() };
  const port = new FakePort();
  const channel = createCapabilityChannel({
    port,
    requested: ['raw.tap'],
    allowlist: new Map([['raw.tap', createRawTapCapability({ feed })]]),
    sequence: 1,
    now: () => 0,
    log: { info: () => undefined, warn: () => undefined, error: () => undefined },
  });
  return { feed, port, channel };
}

describe('the raw.tap capability', () => {
  it('subscribes and unsubscribes for the worker and answers null', () => {
    const { feed, port } = setup();
    port.send({ id: 1, capability: 'raw.tap', args: { op: 'subscribe' } });
    port.send({ id: 2, capability: 'raw.tap', args: { op: 'unsubscribe' } });
    expect(port.posted).toEqual([
      { id: 1, ok: true, value: null },
      { id: 2, ok: true, value: null },
    ]);
    expect(feed.subscribe).toHaveBeenCalledTimes(1);
    expect(feed.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('refuses the Premium screen: not_granted, and the feed is untouched', async () => {
    const { feed, channel } = setup();
    const reply = await channel.callFromUi({ id: 3, capability: 'raw.tap', args: { op: 'subscribe' } });
    expect(reply).toEqual({ id: 3, ok: false, error: 'not_granted' });
    expect(feed.subscribe).not.toHaveBeenCalled();
  });

  it('refuses any other op or shape with bad_args', () => {
    const { feed, port } = setup();
    port.send({ id: 4, capability: 'raw.tap', args: { op: 'pause' } });
    port.send({ id: 5, capability: 'raw.tap', args: null });
    expect(port.posted).toEqual([
      { id: 4, ok: false, error: 'bad_args' },
      { id: 5, ok: false, error: 'bad_args' },
    ]);
    expect(feed.subscribe).not.toHaveBeenCalled();
  });
});
