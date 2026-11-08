import { afterEach, describe, expect, it } from 'vitest';
import { createHostRig, flush, SUBJECT, workerOptions, type HostRig } from './host-service-test-support.js';

const rigs: HostRig[] = [];
afterEach(async () => {
  for (const r of rigs.splice(0)) await r.dispose();
});

async function run(capabilities: string[]): Promise<HostRig> {
  const r = await createHostRig();
  rigs.push(r);
  r.server.publish(workerOptions({ sequence: 4, capabilities }));
  await r.runner.start(SUBJECT);
  r.runner.noteLatestSequence(4);
  r.gate.set(true);
  await flush(r);
  return r;
}

describe('the slots the view grants', () => {
  it('is the tab alone unless the manifest names the live section', async () => {
    const r = await run(['test.echo']);
    expect(r.runner.view().slots).toEqual(['premium.tab']);
  });

  it('adds the live section when the manifest names it, and grants no capability for it', async () => {
    const r = await run(['test.echo', 'live.section']);
    expect(r.runner.view().slots).toEqual(['premium.tab', 'live.section']);
    expect(r.fakes.forks[0]?.child.posted[0]?.message).toMatchObject({ granted: ['test.echo'] });
  });

  it('is absent while paused, stopped or with no bundle', async () => {
    const r = await run(['live.section']);
    r.gate.set(false);
    await flush(r);
    expect(r.runner.view().phase).toBe('paused');
    expect(r.runner.view()).not.toHaveProperty('slots');

    r.gate.set(true);
    await flush(r);
    expect(r.runner.view().slots).toEqual(['premium.tab', 'live.section']);
    r.runner.mountFailed();
    await flush(r);
    expect(r.runner.view()).not.toHaveProperty('slots');

    const none = await createHostRig();
    rigs.push(none);
    expect(none.runner.view()).not.toHaveProperty('slots');
  });

  it('is absent when the window is not on the app scheme', async () => {
    const r = await createHostRig({ uiOnAppScheme: false });
    rigs.push(r);
    r.server.publish(workerOptions({ sequence: 4, capabilities: ['live.section'] }));
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    r.gate.set(true);
    await flush(r);
    expect(r.runner.view().phase).toBe('running');
    expect(r.runner.view()).not.toHaveProperty('slots');
  });
});
