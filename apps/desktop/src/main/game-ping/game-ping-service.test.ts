import { describe, expect, it } from 'vitest';
import type { GamePingView } from '@bombfarm/contracts';
import type { LogPort } from '../storage/index.js';
import { offlineGamePingProbe, OFFLINE_GAME_PING_MS } from './game-ping-offline.js';
import { createGamePingService } from './game-ping-service.js';

const silentLog: LogPort = { info: () => undefined, warn: () => undefined, error: () => undefined };

function harness(results: Array<number | Error>) {
  const pushed: GamePingView[] = [];
  const warnings: unknown[] = [];
  let timers: Array<() => void> = [];
  const queue = [...results];
  const service = createGamePingService({
    ping: () => {
      const next = queue.shift();
      if (next === undefined) return Promise.reject(new Error('no more results'));
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    },
    log: {
      ...silentLog,
      warn: (entry) => {
        warnings.push(entry);
      },
    },
    onChanged: (view) => {
      pushed.push(view);
    },
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
    const due = timers;
    timers = [];
    for (const fire of due) fire();
    await settle();
  };
  return { service, pushed, warnings, settle, tick };
}

describe('the api latency service', () => {
  it('shows nothing until the first check lands, then the measured round trip', async () => {
    const { service, pushed, settle } = harness([187]);
    expect(service.getView()).toEqual({ latencyMs: null });
    service.start();
    await settle();
    expect(service.getView()).toEqual({ latencyMs: 187 });
    expect(pushed).toEqual([{ latencyMs: 187 }]);
  });

  it('does not push when a check measures the same value again', async () => {
    const { service, pushed, settle, tick } = harness([187, 187]);
    service.start();
    await settle();
    await tick();
    expect(pushed).toHaveLength(1);
  });

  it('falls back to no reading when a check fails, and logs only the first failure of a run', async () => {
    const { service, pushed, warnings, settle, tick } = harness([187, new Error('offline'), new Error('offline'), 190]);
    service.start();
    await settle();
    await tick();
    await tick();
    expect(service.getView()).toEqual({ latencyMs: null });
    expect(warnings).toHaveLength(1);
    await tick();
    expect(pushed.map((view) => view.latencyMs)).toEqual([187, null, 190]);
  });

  it('stops checking once stopped', async () => {
    const { service, pushed, settle, tick } = harness([187, 200]);
    service.start();
    await settle();
    service.stop();
    await tick();
    expect(pushed).toHaveLength(1);
  });

  it('reads a fixed round trip in offline mode', async () => {
    await expect(offlineGamePingProbe()).resolves.toBe(OFFLINE_GAME_PING_MS);
  });
});
