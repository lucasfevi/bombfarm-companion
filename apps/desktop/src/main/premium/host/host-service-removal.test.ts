import { afterEach, describe, expect, it } from 'vitest';
import {
  createHostRig,
  faultyFs,
  flush,
  folders,
  SUBJECT,
  topLevel,
  workerOptions,
  type HostRig,
} from './host-service-test-support.js';

const rigs: HostRig[] = [];
afterEach(async () => {
  for (const r of rigs.splice(0)) await r.dispose();
});

function busy(): Error {
  return Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
}

async function open(options: Parameters<typeof createHostRig>[0] = {}): Promise<HostRig> {
  const r = await createHostRig(options);
  rigs.push(r);
  return r;
}

async function install(r: HostRig): Promise<void> {
  r.server.publish(workerOptions({ sequence: 4 }));
  await r.runner.start(SUBJECT);
  r.runner.noteLatestSequence(4);
  r.gate.set(true);
  await flush(r);
}

describe('removal when the Licence ends here', () => {
  it('kills the worker, reloads the window, clears the record and the folder, and reports once', async () => {
    const r = await open();
    await install(r);
    expect(r.runner.view().phase).toBe('running');

    r.runner.requestPremiumRemoval('ended');
    await flush(r);

    expect(r.fakes.forks[0]?.child.killed).toBe(1);
    expect(r.reloads).toBe(1);
    expect(r.db.rows.has('premium_bundle_seq_v1')).toBe(false);
    expect(await topLevel(r.root)).toEqual([]);
    expect(r.runner.view()).toEqual({ phase: 'none', uiUrl: null, styleUrl: null, localBuild: false });
    expect(r.runner.routes.resolve('/_premium/4/ui/index.js')).toBeNull();
    expect(r.goneCalls).toBe(1);
  });

  it('reports nothing until the folder is really gone: the first two deletes are refused', async () => {
    let refusals = 2;
    const fs = faultyFs((op, path) => {
      if (op === 'rm' && path.includes('tombstone') && refusals > 0) {
        refusals -= 1;
        return busy();
      }
      return null;
    });
    const r = await open({ fs });
    await install(r);

    r.runner.requestPremiumRemoval('moved');
    await flush(r);
    expect(r.goneCalls).toBe(0);

    await r.clock.advance(999);
    await flush(r);
    expect(r.goneCalls).toBe(0);
    await r.clock.advance(1);
    await flush(r);
    // The second attempt was refused too.
    expect(r.goneCalls).toBe(0);

    await r.clock.advance(3_999);
    await flush(r);
    expect(r.goneCalls).toBe(0);
    await r.clock.advance(1);
    await flush(r);
    expect(r.goneCalls).toBe(1);
    expect(await topLevel(r.root)).toEqual([]);
  });

  it('retries at one, four, sixteen and sixty seconds, then waits for the next start', async () => {
    let deletes = 0;
    const fs = faultyFs((op, path) => {
      if (op === 'rm' && path.includes('tombstone')) {
        deletes += 1;
        return busy();
      }
      return null;
    });
    const r = await open({ fs });
    await install(r);
    r.runner.requestPremiumRemoval('released');
    await flush(r);
    const perAttempt = deletes;
    expect(perAttempt).toBeGreaterThan(0);

    for (const [index, wait] of [1_000, 4_000, 16_000, 60_000].entries()) {
      await r.clock.advance(wait - 1);
      await flush(r);
      expect(deletes).toBe(perAttempt * (index + 1));
      await r.clock.advance(1);
      await flush(r);
      expect(deletes).toBe(perAttempt * (index + 2));
    }
    await r.clock.advance(3_600_000);
    await flush(r);
    expect(deletes).toBe(perAttempt * 5);
    expect(r.goneCalls).toBe(0);
  });

  it('sweeps a tombstone at the next start, before anything else, and then reports once', async () => {
    const fs = faultyFs((op, path) => (op === 'rm' && path.includes('tombstone') ? busy() : null));
    const first = await open({ fs });
    await install(first);
    first.runner.requestPremiumRemoval('ended');
    await flush(first);
    expect(first.goneCalls).toBe(0);
    expect((await topLevel(first.root)).some((name) => name.startsWith('premium.tombstone-'))).toBe(true);
    first.runner.stop();
    await first.runner.idle();

    const next = await open({ root: first.root, db: first.db });
    await next.runner.start(SUBJECT);
    expect(await topLevel(next.root)).toEqual([]);
    expect(next.goneCalls).toBe(0);

    next.runner.requestPremiumRemoval('ended');
    await flush(next);
    expect(next.goneCalls).toBe(1);
  });

  it('falls back to deleting in place when a handle blocks the rename', async () => {
    const fs = faultyFs((op, path) => (op === 'rename' && path.endsWith('premium') ? busy() : null));
    const r = await open({ fs });
    await install(r);
    r.runner.requestPremiumRemoval('ended');
    await flush(r);
    expect(await folders(r.root)).toEqual([]);
    expect(await topLevel(r.root)).toEqual([]);
    expect(r.goneCalls).toBe(1);
  });

  it('starts nothing and fetches nothing while removing, whatever else arrives', async () => {
    const fs = faultyFs((op, path) => (op === 'rm' && path.includes('tombstone') ? busy() : null));
    const r = await open({ fs });
    await install(r);
    r.runner.requestPremiumRemoval('ended');
    const requests = r.server.requests.length;
    r.runner.noteLatestSequence(9);
    r.gate.set(false);
    r.gate.set(true);
    await flush(r);
    expect(r.server.requests.length).toBe(requests);
    expect(r.fakes.forks).toHaveLength(1);
  });

  it('is not started by the gate closing: idle only, the folder stays', async () => {
    const r = await open();
    await install(r);
    r.gate.set(false);
    await flush(r);
    expect(r.runner.view().phase).toBe('paused');
    expect(await folders(r.root)).toEqual(['4']);
    expect(r.db.rows.has('premium_bundle_seq_v1')).toBe(true);
    expect(r.goneCalls).toBe(0);
    expect(r.reloads).toBe(0);
  });

  it('reports a second end event again once that removal is done too', async () => {
    const r = await open();
    await install(r);
    r.runner.requestPremiumRemoval('ended');
    await flush(r);
    expect(r.goneCalls).toBe(1);
    r.runner.requestPremiumRemoval('ended');
    await flush(r);
    expect(r.goneCalls).toBe(2);
  });

  it('leaves nothing on disk when the removal lands while a download is in flight', async () => {
    const r = await open();
    r.server.publish(workerOptions({ sequence: 4 }));
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    r.gate.set(true);
    // The download has started; the removal lands before it can finish.
    r.runner.requestPremiumRemoval('ended');
    await flush(r);
    expect(await topLevel(r.root)).toEqual([]);
    expect(r.fakes.forks).toHaveLength(0);
    expect(r.goneCalls).toBe(1);
  });
});
