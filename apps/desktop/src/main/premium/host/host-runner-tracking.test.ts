import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HostTracking } from './host-runner.js';
import { createHostRig, flush, SUBJECT, workerOptions, type HostRig } from './host-service-test-support.js';

const rigs: HostRig[] = [];
afterEach(async () => {
  for (const r of rigs.splice(0)) await r.dispose();
});

async function running(tracking?: HostTracking): Promise<HostRig> {
  const r = await createHostRig(tracking === undefined ? {} : { tracking });
  rigs.push(r);
  r.server.publish(workerOptions({ sequence: 4 }));
  await r.runner.start(SUBJECT);
  r.runner.noteLatestSequence(4);
  r.gate.set(true);
  await flush(r);
  return r;
}

describe('the runner tells the tracking side', () => {
  it('stops the feeds on a pause when the tracking side has no pause of its own, and closes the handle', async () => {
    const calls: string[] = [];
    const r = await running({
      stopFeeds: () => calls.push('stopFeeds'),
      close: () => {
        calls.push('close');
        return Promise.resolve();
      },
    });
    calls.length = 0;

    r.gate.set(false);
    await flush(r);

    expect(calls).toEqual(['stopFeeds', 'close']);
  });

  it('carries on when the tracking side throws or rejects, and says so in the log', async () => {
    const r = await running({
      stopFeeds: () => {
        throw new Error('feed fault');
      },
      pauseFeeds: () => {
        throw new Error('pause fault');
      },
      resumeFeeds: () => {
        throw new Error('resume fault');
      },
      close: () => Promise.reject(new Error('close fault')),
    });

    r.gate.set(false);
    await flush(r);
    expect(r.runner.view().phase).toBe('paused');
    r.gate.set(true);
    await flush(r);
    expect(r.runner.view().phase).toBe('running');
    r.runner.mountFailed();
    await flush(r);

    expect(r.fakes.forks[0]?.child.killed).toBe(1);
    const events = r.log.records.map((record) => String(record['event']));
    expect(events).toContain('premium.tracking_close');
    expect(events).toContain('premium.tracking_stop');
    expect(JSON.stringify(r.log.records)).not.toContain('fault');
  });

  it('hands the history, the clear and the probe to the app, and only when the tracking side has them', async () => {
    const history = vi.fn(() => ({ state: 'present', bytes: 7 }) as const);
    const clear = vi.fn(() => Promise.resolve('cleared' as const));
    const armProbe = vi.fn();
    const r = await running({ stopFeeds: () => undefined, close: () => Promise.resolve(), history, clear, armProbe });

    expect(r.runner.trackingHistory?.(SUBJECT)).toEqual({ state: 'present', bytes: 7 });
    await expect(r.runner.clearTrackingHistory?.(SUBJECT)).resolves.toBe('cleared');
    r.runner.armTrackingProbe?.();
    expect(history).toHaveBeenCalledWith(SUBJECT);
    expect(clear).toHaveBeenCalledWith(SUBJECT);
    expect(armProbe).toHaveBeenCalledTimes(1);

    const bare = await running({ stopFeeds: () => undefined, close: () => Promise.resolve() });
    expect(bare.runner.trackingHistory?.(SUBJECT)).toEqual({ state: 'none' });
    await expect(bare.runner.clearTrackingHistory?.(SUBJECT)).resolves.toBe('cleared');

    const none = await running();
    expect('trackingHistory' in none.runner).toBe(false);
    expect('clearTrackingHistory' in none.runner).toBe(false);
    expect('armTrackingProbe' in none.runner).toBe(false);
  });
});
