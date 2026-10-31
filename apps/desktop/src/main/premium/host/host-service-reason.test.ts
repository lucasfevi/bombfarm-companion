import type { PremiumPauseReason } from '@bombfarm/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createFakeGate,
  createHostRig,
  flush,
  SUBJECT,
  workerOptions,
  type FakeGate,
  type HostRig,
} from './host-service-test-support.js';

const rigs: HostRig[] = [];
afterEach(async () => {
  for (const r of rigs.splice(0)) await r.dispose();
});

function gateWithReason(reason: () => PremiumPauseReason): FakeGate {
  return { ...createFakeGate(), reason };
}

async function running(options: Parameters<typeof createHostRig>[0] = {}): Promise<HostRig> {
  const r = await createHostRig(options);
  rigs.push(r);
  r.server.publish(workerOptions({ sequence: 4 }));
  await r.runner.start(SUBJECT);
  r.runner.noteLatestSequence(4);
  r.gate.set(true);
  await flush(r);
  return r;
}

describe('the reason a pause carries', () => {
  it.each(['other_account', 'unconfirmed'] as const)(
    'tells the worker and the view %s while paused, and clears it on resume',
    async (reason) => {
      const r = await running({ gate: gateWithReason(() => reason) });
      expect(r.runner.view()).not.toHaveProperty('paused');
      const sentBefore = r.fakes.channels[0]?.port1.sent.length ?? 0;

      r.gate.set(false);

      expect(r.runner.view()).toEqual({
        phase: 'paused',
        uiUrl: null,
        styleUrl: null,
        localBuild: false,
        paused: { reason },
      });
      expect(r.fakes.channels[0]?.port1.sent.slice(sentBefore)).toEqual([{ t: 'paused', reason }]);

      r.gate.set(true);

      expect(r.runner.view().phase).toBe('running');
      expect(r.runner.view()).not.toHaveProperty('paused');
      expect(r.fakes.channels[0]?.port1.sent.at(-1)).toEqual({ t: 'resumed' });
    },
  );

  it('asks the gate for the reason as it closes, so a later pause can differ', async () => {
    let reason: PremiumPauseReason = 'other_account';
    const r = await running({ gate: gateWithReason(() => reason) });

    r.gate.set(false);
    expect(r.runner.view().paused).toEqual({ reason: 'other_account' });
    r.gate.set(true);
    reason = 'unconfirmed';
    r.gate.set(false);

    expect(r.runner.view().paused).toEqual({ reason: 'unconfirmed' });
  });

  it('pauses with no reason, and a view with no paused key, when the gate cannot tell', async () => {
    const r = await running();
    const sentBefore = r.fakes.channels[0]?.port1.sent.length ?? 0;

    r.gate.set(false);

    expect(r.runner.view()).toEqual({ phase: 'paused', uiUrl: null, styleUrl: null, localBuild: false });
    expect(r.runner.view()).not.toHaveProperty('paused');
    expect(r.fakes.channels[0]?.port1.sent.slice(sentBefore)).toEqual([{ t: 'paused' }]);
  });
});

describe('removing the store with the Premium code', () => {
  it('deletes the subject store before the folder is reported gone', async () => {
    const order: string[] = [];
    const r = await running({
      deleteStore: (subject) => {
        order.push(`store:${subject}`);
        return true;
      },
    });
    r.runner.attach(() => {
      order.push('gone');
    });

    r.runner.requestPremiumRemoval('ended');
    await flush(r);

    expect(order).toEqual([`store:${SUBJECT}`, 'gone']);
  });

  it('reports nothing while the delete fails and retries it with the folder', async () => {
    let refusals = 2;
    const deleted: string[] = [];
    const r = await running({
      deleteStore: (subject) => {
        if (refusals > 0) {
          refusals -= 1;
          return false;
        }
        deleted.push(subject);
        return true;
      },
    });
    const gone: string[] = [];
    r.runner.attach(() => {
      gone.push('gone');
    });

    r.runner.requestPremiumRemoval('moved');
    await flush(r);
    expect(gone).toEqual([]);

    await r.clock.advance(1_000);
    await flush(r);
    expect(gone).toEqual([]);
    expect(deleted).toEqual([]);

    await r.clock.advance(4_000);
    await flush(r);
    expect(deleted).toEqual([SUBJECT]);
    expect(gone).toEqual(['gone']);
  });
});
