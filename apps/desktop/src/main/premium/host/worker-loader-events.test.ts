import { describe, expect, it } from 'vitest';
import { runLoader, type LoaderPort } from './worker-loader.js';

type Listener = (event: { data: unknown; ports?: readonly LoaderPort[] }) => void;

class RecordingPort implements LoaderPort {
  readonly posted: unknown[] = [];
  private listener: Listener | null = null;
  on(_event: 'message', listener: Listener): this {
    this.listener = listener;
    return this;
  }
  postMessage(message: unknown): void {
    this.posted.push(message);
  }
  start(): void {}
  deliver(data: unknown): void {
    this.listener?.({ data });
  }
}

const seen = globalThis as unknown as { __log?: unknown[]; __channel?: RecordingPort };

/** Boots the real loader with the given bundle source. */
function boot(code: string): RecordingPort {
  seen.__log = [];
  const channel = new RecordingPort();
  seen.__channel = channel;
  const codePort = new RecordingPort();
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
  codePort.deliver(new TextEncoder().encode(code));
  return channel;
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('worker loader: event batches', () => {
  it('calls the listener once per item, then acknowledges the batch once', () => {
    const channel = boot(`exports.start = (host) => {
      host.on('raw.gap', (item) => globalThis.__log.push(['gap', item.dropped]));
    };`);
    channel.deliver({
      t: 'events',
      seq: 7,
      name: 'raw.gap',
      items: [
        { feed: 'raw.tap', dropped: 1, fromSeq: 1 },
        { feed: 'raw.tap', dropped: 2, fromSeq: 3 },
        { feed: 'raw.tap', dropped: 3, fromSeq: 6 },
      ],
    });
    expect(seen.__log).toEqual([['gap', 1], ['gap', 2], ['gap', 3]]);
    expect(channel.posted).toEqual([{ t: 'ack', seq: 7 }]);
  });

  it('acknowledges only after the last item has been delivered', () => {
    const channel = boot(`exports.start = (host) => {
      host.on('raw.gap', (item) => globalThis.__log.push([item.dropped, globalThis.__channel.posted.length]));
    };`);
    channel.deliver({
      t: 'events',
      seq: 1,
      name: 'raw.gap',
      items: [
        { feed: 'raw.tap', dropped: 1, fromSeq: 1 },
        { feed: 'raw.tap', dropped: 2, fromSeq: 2 },
      ],
    });
    expect(seen.__log).toEqual([[1, 0], [2, 0]]);
    expect(channel.posted).toEqual([{ t: 'ack', seq: 1 }]);
  });

  it('skips a throwing paused listener without stopping the other paused listeners', () => {
    const channel = boot(`exports.start = (host) => {
      host.on('paused', () => { throw new Error('boom'); });
      host.on('paused', (info) => globalThis.__log.push(info.reason));
    };`);
    channel.deliver({ t: 'paused', reason: 'unconfirmed' });
    expect(seen.__log).toEqual(['unconfirmed']);
  });

  it('skips a throwing listener without stopping the others or the ack', () => {
    const channel = boot(`exports.start = (host) => {
      host.on('db.cleared', () => { throw new Error('boom'); });
      host.on('db.cleared', (item) => globalThis.__log.push(item.atMs));
    };`);
    channel.deliver({ t: 'events', seq: 2, name: 'db.cleared', items: [{ atMs: 10 }, { atMs: 20 }] });
    expect(seen.__log).toEqual([10, 20]);
    expect(channel.posted).toEqual([{ t: 'ack', seq: 2 }]);
  });

  it('acknowledges a batch nobody listens to', () => {
    const channel = boot('exports.start = () => {};');
    channel.deliver({ t: 'events', seq: 3, name: 'raw.tap', items: [{ kind: 'body', seq: 1 }] });
    expect(channel.posted).toEqual([{ t: 'ack', seq: 3 }]);
  });
});

describe('worker loader: messages from the screen', () => {
  it('answers ok:false with reason no_handler when no handler is registered', async () => {
    const channel = boot('exports.start = () => {};');
    channel.deliver({ t: 'ui', id: 4, slot: 'premium.tab', msg: { q: 1 } });
    await settle();
    expect(channel.posted).toEqual([{ t: 'uiReply', id: 4, ok: false, reason: 'no_handler' }]);
  });

  it('answers with the handler value, passing the message and the slot', async () => {
    const channel = boot(`exports.start = (host) => {
      host.onUiMessage((msg, from) => ({ echo: msg, slot: from.slot }));
    };`);
    channel.deliver({ t: 'ui', id: 5, slot: 'live.section', msg: 'hi' });
    await settle();
    expect(channel.posted).toEqual([{ t: 'uiReply', id: 5, ok: true, value: { echo: 'hi', slot: 'live.section' } }]);
  });

  it('awaits an async handler', async () => {
    const channel = boot(`exports.start = (host) => {
      host.onUiMessage(async (msg) => msg + 1);
    };`);
    channel.deliver({ t: 'ui', id: 6, slot: 'premium.tab', msg: 1 });
    await settle();
    expect(channel.posted).toEqual([{ t: 'uiReply', id: 6, ok: true, value: 2 }]);
  });

  it('answers ok:false with reason other when the handler throws or rejects', async () => {
    const channel = boot(`exports.start = (host) => {
      host.onUiMessage((msg) => { if (msg === 'sync') throw new Error('x'); return Promise.reject(new Error('y')); });
    };`);
    channel.deliver({ t: 'ui', id: 8, slot: 'premium.tab', msg: 'sync' });
    channel.deliver({ t: 'ui', id: 9, slot: 'premium.tab', msg: 'async' });
    await settle();
    expect(channel.posted).toEqual([
      { t: 'uiReply', id: 8, ok: false, reason: 'other' },
      { t: 'uiReply', id: 9, ok: false, reason: 'other' },
    ]);
  });
});

describe('worker loader: refused calls', () => {
  it('rejects with the code and the reason of the refusal', async () => {
    const channel = boot(`exports.start = (host) => {
      host.call('db', {}).catch((e) => globalThis.__log.push([e.code, e.reason]));
      host.call('raw.tap', {}).catch((e) => globalThis.__log.push([e.code, e.reason]));
    };`);
    channel.deliver({ id: 1, ok: false, error: 'unavailable', reason: 'no_handler' });
    channel.deliver({ id: 2, ok: false, error: 'paused' });
    await settle();
    expect(seen.__log).toEqual([
      ['unavailable', 'no_handler'],
      ['paused', undefined],
    ]);
  });
});
