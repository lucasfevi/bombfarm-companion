import { describe, expect, it } from 'vitest';
import { ONLINE_PLAYERS_MAX_AGE_MS, type OnlinePlayersView } from '@bombfarm/contracts';
import type { LogPort } from '../storage/index.js';
import { offlineOnlinePlayersGet, OFFLINE_ONLINE_PLAYERS } from './online-players-offline.js';
import { createOnlinePlayersService } from './online-players-service.js';
import type { OnlinePlayersHttpResponse } from './online-players-transport.js';

const NOW = 1_790_727_000_000;
const silentLog: LogPort = { info: () => undefined, warn: () => undefined, error: () => undefined };
const ok = (players: number, at = NOW / 1000): OnlinePlayersHttpResponse => ({
  status: 200,
  body: JSON.stringify({ v: 1, at, players }),
});

function harness(responses: Array<OnlinePlayersHttpResponse | Error>, clock = { now: NOW }) {
  const pushed: OnlinePlayersView[] = [];
  let timers: Array<() => void> = [];
  const queue = [...responses];
  const service = createOnlinePlayersService({
    httpGet: () => {
      const next = queue.shift();
      if (next === undefined) return Promise.reject(new Error('no more responses'));
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    },
    log: silentLog,
    now: () => clock.now,
    onChanged: (view) => pushed.push(view),
    scheduler: {
      setTimeout: ((callback: () => void) => {
        timers.push(callback);
        return timers.length as unknown as ReturnType<typeof setTimeout>;
      }) as unknown as typeof setTimeout,
      clearTimeout: () => {
        timers = [];
      },
    },
  });
  const settle = async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  };
  const tick = async () => {
    timers.shift()?.();
    await settle();
  };
  return { service, pushed, tick, settle, clock };
}

describe('online players service', () => {
  it('shows the count once the first check lands', async () => {
    const h = harness([ok(2537)]);
    h.service.start();
    await h.settle();
    expect(h.service.getView().reading?.players).toBe(2537);
    expect(h.pushed).toHaveLength(1);
  });

  it('does not push again when a check reads the same sample', async () => {
    const h = harness([ok(2537), ok(2537)]);
    h.service.start();
    await h.settle();
    await h.tick();
    expect(h.pushed).toHaveLength(1);
  });

  it('keeps the last count through a failed check', async () => {
    const h = harness([ok(2537), new Error('offline')]);
    h.service.start();
    await h.settle();
    await h.tick();
    expect(h.service.getView().reading?.players).toBe(2537);
  });

  it('ignores a refusal and a body of the wrong shape', async () => {
    const h = harness([{ status: 503, body: '' }, { status: 200, body: '{"v":2}' }, { status: 200, body: 'not json' }]);
    h.service.start();
    await h.settle();
    await h.tick();
    await h.tick();
    expect(h.service.getView().reading).toBeNull();
    expect(h.pushed).toHaveLength(0);
  });

  it('blanks the count once the reading is too old to show', async () => {
    const h = harness([ok(2537), new Error('offline')]);
    h.service.start();
    await h.settle();
    h.clock.now = NOW + ONLINE_PLAYERS_MAX_AGE_MS + 1;
    await h.tick();
    expect(h.service.getView().reading).toBeNull();
    expect(h.pushed).toHaveLength(2);
  });

  it('stops asking after stop()', async () => {
    const h = harness([ok(1), ok(2)]);
    h.service.start();
    await h.settle();
    h.service.stop();
    await h.tick();
    expect(h.service.getView().reading?.players).toBe(1);
  });
});

describe('offline mode reading', () => {
  it('is a fresh, fixed count', async () => {
    const response = await offlineOnlinePlayersGet(() => NOW)();
    expect(JSON.parse(response.body)).toEqual({ v: 1, at: NOW / 1000, players: OFFLINE_ONLINE_PLAYERS });
  });
});
