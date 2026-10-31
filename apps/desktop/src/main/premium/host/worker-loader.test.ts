import { describe, expect, it } from 'vitest';
import { runLoader, type LoaderPort } from './worker-loader.js';

type Listener = (event: { data: unknown; ports?: readonly LoaderPort[] }) => void;

class FakeLoaderPort implements LoaderPort {
  private listener: Listener | null = null;
  on(_event: 'message', listener: Listener): this {
    this.listener = listener;
    return this;
  }
  postMessage(): void {}
  start(): void {}
  deliver(data: unknown): void {
    this.listener?.({ data });
  }
}

const seen = globalThis as unknown as { __pauseEvents?: unknown[] };

/** Boots the real loader with a bundle that records everything its listeners are told. */
function boot(): FakeLoaderPort {
  seen.__pauseEvents = [];
  const channel = new FakeLoaderPort();
  const codePort = new FakeLoaderPort();
  const parent: { listener: Listener | null } = { listener: null };
  runLoader({
    parentPort: {
      on: (_event, listener) => {
        parent.listener = listener;
      },
    },
    nodeRequire: () => undefined,
    exit: () => undefined,
  });
  parent.listener?.({
    data: { t: 'init', sequence: 1, version: '1.0.0', granted: [] },
    ports: [channel, codePort],
  });
  const code = `exports.start = (host) => {
    host.on('paused', (info) => globalThis.__pauseEvents.push(['paused', info.reason]));
    host.on('resumed', () => globalThis.__pauseEvents.push(['resumed']));
  };`;
  codePort.deliver(new TextEncoder().encode(code));
  return channel;
}

describe('worker loader: pause events', () => {
  it('tells a paused listener the reason', () => {
    const channel = boot();
    channel.deliver({ t: 'paused', reason: 'unconfirmed' });
    channel.deliver({ t: 'paused', reason: 'other_account' });
    expect(seen.__pauseEvents).toEqual([
      ['paused', 'unconfirmed'],
      ['paused', 'other_account'],
    ]);
  });

  it('gives no reason for a pause that carries none or an unknown one', () => {
    const channel = boot();
    channel.deliver({ t: 'paused' });
    channel.deliver({ t: 'paused', reason: 'because' });
    expect(seen.__pauseEvents).toEqual([
      ['paused', undefined],
      ['paused', undefined],
    ]);
  });

  it('still tells a resumed listener', () => {
    const channel = boot();
    channel.deliver({ t: 'resumed' });
    expect(seen.__pauseEvents).toEqual([['resumed']]);
  });
});
