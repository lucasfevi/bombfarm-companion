import { afterEach, describe, expect, it } from 'vitest';
import { CRASH_RESTART_DELAY_MS, CRASH_WINDOW_MS } from './host-machine.js';
import {
  createHostRig,
  ECHO_CAPABILITY,
  flush,
  SUBJECT,
  workerOptions,
  type HostRig,
} from './host-service-test-support.js';

let rig: HostRig | null = null;
afterEach(async () => {
  await rig?.dispose();
  rig = null;
});

/** A running host over the fixture bundle, with a worker the test can call through. */
async function running(): Promise<HostRig> {
  const r = await createHostRig();
  rig = r;
  r.server.publish(workerOptions({ sequence: 4, capabilities: [ECHO_CAPABILITY] }));
  await r.runner.start(SUBJECT);
  r.runner.noteLatestSequence(4);
  r.gate.set(true);
  await flush(r);
  return r;
}

async function callFromWorker(r: HostRig): Promise<string> {
  const host = r.workerHost();
  if (host === undefined) throw new Error('the worker did not start');
  const answer = host.call(ECHO_CAPABILITY, null).then(
    (value) => `ok:${String(value)}`,
    (error: unknown) => `refused:${(error as Error).message}`,
  );
  await flush(r);
  return answer;
}

describe('running only while the Lease allows', () => {
  it('goes idle and comes back with the same worker, refusing calls while idle', async () => {
    const r = await running();
    const pid = r.supervisor.pid();
    expect(pid).not.toBeNull();
    expect(await callFromWorker(r)).toBe('ok:pong');
    expect(r.runner.view().phase).toBe('running');

    // The gate closes (unconfirmed): idle in the same tick as the notification.
    const sentBefore = r.fakes.channels[0]?.port1.sent.length ?? 0;
    r.gate.set(false);
    expect(r.runner.view()).toEqual({ phase: 'paused', uiUrl: null, styleUrl: null, localBuild: false });
    expect(r.fakes.channels[0]?.port1.sent.slice(sentBefore)).toEqual([{ t: 'paused' }]);
    expect(await callFromWorker(r)).toBe('refused:paused');
    expect(r.supervisor.pid()).toBe(pid);
    expect(r.fakes.forks).toHaveLength(1);

    r.gate.set(true);
    expect(r.runner.view().phase).toBe('running');
    expect(r.fakes.channels[0]?.port1.sent.at(-1)).toEqual({ t: 'resumed' });
    expect(await callFromWorker(r)).toBe('ok:pong');
    expect(r.supervisor.pid()).toBe(pid);
    expect(r.fakes.forks).toHaveLength(1);
  });

  it('downloads nothing again on the way back, and deletes nothing while idle', async () => {
    const r = await running();
    const requests = r.server.requests.length;
    r.gate.set(false);
    await flush(r);
    r.gate.set(true);
    await flush(r);
    expect(r.server.requests.length).toBe(requests);
    expect(await r.cache.scan()).toEqual([4]);
  });

  it('refuses the same tick: nothing is queued between the gate and the pause', async () => {
    const r = await running();
    const phases: string[] = [];
    r.runner.subscribe(() => phases.push(r.runner.view().phase));
    r.gate.set(false);
    // No await: the view and the channel already changed.
    expect(phases).toEqual(['paused']);
    expect(r.runner.view().uiUrl).toBeNull();
  });

  it('never starts the worker while the gate is false, whatever else arrives', async () => {
    const r = await createHostRig();
    rig = r;
    r.server.publish(workerOptions({ sequence: 4 }));
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    r.runner.noteLeaseFloor(2);
    await flush(r);
    expect(r.fakes.forks).toHaveLength(0);
    expect(r.server.attempts).toBe(0);
  });

  it('keeps the worker down after the gate closed while a restart was waiting', async () => {
    const r = await running();
    r.fakes.forks[0]?.child.exit(1);
    r.gate.set(false);
    await r.clock.advance(CRASH_RESTART_DELAY_MS * 2);
    expect(r.fakes.forks).toHaveLength(1);

    // Back open: no worker is alive, so a fresh one starts rather than a resume.
    r.gate.set(true);
    await flush(r);
    expect(r.fakes.forks).toHaveLength(2);
    expect(r.runner.view().phase).toBe('running');
  });
});

describe('a worker that exits', () => {
  it('restarts once, five seconds after an exit nobody asked for', async () => {
    const r = await running();
    r.fakes.forks[0]?.child.exit(1);
    expect(r.fakes.forks).toHaveLength(1);
    await r.clock.advance(CRASH_RESTART_DELAY_MS - 1);
    expect(r.fakes.forks).toHaveLength(1);
    await r.clock.advance(1);
    await flush(r);
    expect(r.fakes.forks).toHaveLength(2);
    expect(r.runner.view().phase).toBe('running');
    expect(r.workerHost()).toBeDefined();
  });

  it('stops for good on a second unrequested exit within ten minutes', async () => {
    const r = await running();
    r.fakes.forks[0]?.child.exit(1);
    await r.clock.advance(CRASH_RESTART_DELAY_MS);
    await flush(r);
    r.fakes.forks[1]?.child.exit(1);
    await flush(r);

    expect(r.runner.view().phase).toBe('stopped');
    await r.clock.advance(CRASH_WINDOW_MS);
    expect(r.fakes.forks).toHaveLength(2);
    expect(r.runner.view().uiUrl).toBeNull();
  });

  it('restarts again when the second exit comes after the window has passed', async () => {
    const r = await running();
    r.fakes.forks[0]?.child.exit(1);
    await r.clock.advance(CRASH_RESTART_DELAY_MS);
    await flush(r);
    await r.clock.advance(CRASH_WINDOW_MS + 1);
    r.fakes.forks[1]?.child.exit(1);
    await r.clock.advance(CRASH_RESTART_DELAY_MS);
    await flush(r);
    expect(r.fakes.forks).toHaveLength(3);
    expect(r.runner.view().phase).toBe('running');
  });

  it('does not count the host’s own kill as a crash', async () => {
    const r = await running();
    r.gate.set(false);
    r.runner.mountFailed();
    await flush(r);
    expect(r.fakes.forks).toHaveLength(1);
    expect(r.fakes.forks[0]?.child.killed).toBe(1);
  });
});
