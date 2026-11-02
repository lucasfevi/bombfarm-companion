import { afterEach, describe, expect, it } from 'vitest';
import {
  createHostRig,
  flush,
  folders,
  SUBJECT,
  workerOptions,
  type HostRig,
} from './host-service-test-support.js';

const rigs: HostRig[] = [];
afterEach(async () => {
  for (const r of rigs.splice(0)) await r.dispose();
});

async function open(options: Parameters<typeof createHostRig>[0] = {}): Promise<HostRig> {
  const r = await createHostRig(options);
  rigs.push(r);
  return r;
}

/** Sequence 3 installed and running, the gate open. */
async function runningThree(): Promise<HostRig> {
  const r = await open();
  r.server.publish(workerOptions({ sequence: 3 }));
  await r.runner.start(SUBJECT);
  r.runner.noteLatestSequence(3);
  r.gate.set(true);
  await flush(r);
  return r;
}

/** Stops a host and starts another over the same folder and database, as an app restart does. */
async function restart(r: HostRig, options: Parameters<typeof createHostRig>[0] = {}): Promise<HostRig> {
  r.runner.stop();
  await r.runner.idle();
  return open({ root: r.root, db: r.db, ...options });
}

describe('updates arrive without interrupting play', () => {
  it('caches a newer bundle in the background while the active one keeps running', async () => {
    const r = await runningThree();
    const pid = r.supervisor.pid();
    r.server.publish(workerOptions({ sequence: 4 }));
    r.runner.noteLatestSequence(4);
    await flush(r);

    expect(await folders(r.root)).toEqual(['3', '4']);
    expect(r.supervisor.pid()).toBe(pid);
    expect(r.fakes.forks).toHaveLength(1);
    expect(r.reloads).toBe(0);
    expect(r.runner.runningSequence()).toBe(3);
    expect(r.runner.view().uiUrl).toBe('app://bundle/_premium/3/ui/index.js');
    expect(r.runner.routes.resolve('/_premium/3/ui/index.js')).not.toBeNull();
    expect(r.runner.routes.resolve('/_premium/4/ui/index.js')).toBeNull();
    expect(r.db.rows.get('premium_bundle_seq_v1')).toBe(JSON.stringify({ subject: SUBJECT, sequence: 4 }));
  });

  it('activates the newest verified bundle at the next start and deletes the older folder', async () => {
    const r = await runningThree();
    r.server.publish(workerOptions({ sequence: 4 }));
    r.runner.noteLatestSequence(4);
    await flush(r);

    const next = await restart(r);
    await next.runner.start(SUBJECT);
    next.gate.set(true);
    await flush(next);

    expect(await folders(next.root)).toEqual(['4']);
    expect(next.runner.runningSequence()).toBe(4);
    expect(next.runner.view().uiUrl).toBe('app://bundle/_premium/4/ui/index.js');
    expect(next.fakes.forks).toHaveLength(1);
    expect(next.server.attempts).toBe(0);
  });

  it('stops the worker, reloads the window and shows Updating when the floor passes the active bundle', async () => {
    const r = await runningThree();
    r.server.publish(workerOptions({ sequence: 4 }));
    r.runner.noteLatestSequence(4);
    await flush(r);

    const next = await restart(r);
    await next.runner.start(SUBJECT);
    next.runner.noteLatestSequence(4);
    next.gate.set(true);
    await flush(next);
    expect(next.runner.runningSequence()).toBe(4);

    next.runner.noteLeaseFloor(5);
    await flush(next);
    expect(next.fakes.forks[0]?.child.killed).toBe(1);
    expect(next.reloads).toBe(1);
    expect(next.runner.view()).toEqual({ phase: 'updating', uiUrl: null, styleUrl: null, localBuild: false });
    expect(await folders(next.root)).toEqual([]);
    expect(next.runner.routes.resolve('/_premium/4/ui/index.js')).toBeNull();
    expect(next.runner.runningSequence()).toBeNull();
  });

  it('fetches a bundle that meets the floor once a renewal names one', async () => {
    const r = await runningThree();
    r.runner.noteLeaseFloor(5);
    await flush(r);
    expect(r.runner.view().phase).toBe('updating');
    expect(r.reloads).toBe(1);

    r.server.publish(workerOptions({ sequence: 5 }));
    r.runner.noteLatestSequence(5);
    await flush(r);
    expect(r.runner.view().phase).toBe('running');
    expect(r.runner.runningSequence()).toBe(5);
    expect(await folders(r.root)).toEqual(['5']);
  });

  it('swaps in a cached bundle that meets the floor, with a reload', async () => {
    const r = await runningThree();
    r.server.publish(workerOptions({ sequence: 4 }));
    r.runner.noteLatestSequence(4);
    await flush(r);

    r.runner.noteLeaseFloor(4);
    await flush(r);
    expect(r.fakes.forks).toHaveLength(2);
    expect(r.fakes.forks[0]?.child.killed).toBe(1);
    expect(r.reloads).toBe(1);
    expect(r.runner.runningSequence()).toBe(4);
    expect(r.runner.view().uiUrl).toBe('app://bundle/_premium/4/ui/index.js');
    expect(await folders(r.root)).toEqual(['4']);
  });

  it('shows Updating, not a stale bundle, when the app no longer fits the cached one', async () => {
    const writer = await open({ appVersion: '99.0.0' });
    writer.server.publish(workerOptions({ sequence: 4, minAppVersion: '9.0.0' }));
    await writer.runner.start(SUBJECT);
    writer.runner.noteLatestSequence(4);
    writer.gate.set(true);
    await flush(writer);
    expect(await folders(writer.root)).toEqual(['4']);

    // Read by an older app that cannot run it.
    const older = await restart(writer, { appVersion: '1.0.0' });
    await older.runner.start(SUBJECT);
    older.gate.set(true);
    await flush(older);
    expect(older.fakes.forks).toHaveLength(0);
    expect(older.runner.view().phase).toBe('updating');
    expect(await folders(older.root)).toEqual([]);
  });
});
