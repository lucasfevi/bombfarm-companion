import { beforeAll, describe, expect, it } from 'vitest';
import type { AccountPayload, SectionFidelity } from '@bombfarm/contracts';
import { createAccountStore } from './account-store.js';
import { createLogSpy, detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from './test-support.js';

const AVAILABLE_BINDINGS = detectAvailableBindings();

beforeAll(() => {
  warnForUnavailableBindings(AVAILABLE_BINDINGS);
});

const MISSING: SectionFidelity = { status: 'missing' };
const RESOLVED = (capturedAt: string): SectionFidelity => ({ status: 'resolved', capturedAt });
const LOST_XP_MULT = ['skills.totals.xp_mult'];

function skillsRead(totals: Record<string, number>, fidelity: SectionFidelity): AccountPayload {
  return {
    skills: { totals },
    fidelity: { account: MISSING, heroes: MISSING, skills: fidelity, casa: MISSING, items: MISSING },
  };
}

const degraded = (capturedAt: string): SectionFidelity => ({
  status: 'degraded',
  capturedAt,
  missingKeys: LOST_XP_MULT,
  addedKeys: [],
});

describe.each(AVAILABLE_BINDINGS.map((binding) => ({ binding })))('a skill tree that lost a required total, binding: $binding', ({ binding }) => {
  it('serves the last saved tree as stale, names the keys it lost, and keeps the saved row untouched', () => {
    const store = createAccountStore(openTestAccountDb(binding));
    store.commit(skillsRead({ dmg_static: 1.5, xp_mult: 1.2 }, RESOLVED('t1')), { gameRunning: true });

    const view = store.commit(skillsRead({ dmg_static: 9 }, degraded('t2')), { gameRunning: true });

    expect(view.payload.skills).toEqual({ totals: { dmg_static: 1.5, xp_mult: 1.2 } });
    expect(view.payload.fidelity?.skills).toEqual({ status: 'stale', capturedAt: 't1', lostKeys: LOST_XP_MULT });
    expect((store.restore().payload.skills as { totals: unknown }).totals).toEqual({ dmg_static: 1.5, xp_mult: 1.2 });
    store.close();
  });

  it('withholds the tree when nothing was ever saved, carrying the keys it lost', () => {
    const store = createAccountStore(openTestAccountDb(binding));

    const view = store.commit(skillsRead({ dmg_static: 9 }, degraded('t2')), { gameRunning: true });

    expect(view.payload.skills).toBeUndefined();
    expect(view.payload.fidelity?.skills).toEqual({ status: 'missing', lostKeys: LOST_XP_MULT });
    store.close();
  });

  it('serves a tree that only gained a key, and saves it', () => {
    const store = createAccountStore(openTestAccountDb(binding));
    const gained: SectionFidelity = { status: 'degraded', capturedAt: 't2', missingKeys: [], addedKeys: ['skills.totals.new_bonus'] };
    const read = skillsRead({ dmg_static: 2, new_bonus: 1 }, gained);

    expect(store.persist(read).written).toEqual(['skills']);
    expect(store.commit(read, { gameRunning: true }).payload.fidelity?.skills).toEqual(gained);
    store.close();
  });

  it('keeps the notice when the served view is committed again, as a forge patch does', () => {
    const store = createAccountStore(openTestAccountDb(binding));
    store.commit(skillsRead({ dmg_static: 1.5 }, RESOLVED('t1')), { gameRunning: true });
    const first = store.commit(skillsRead({ dmg_static: 9 }, degraded('t2')), { gameRunning: true });

    const second = store.commit(first.payload, { gameRunning: true });

    expect(second.payload.fidelity?.skills).toEqual({ status: 'stale', capturedAt: 't1', lostKeys: LOST_XP_MULT });
    store.close();
  });

  it('logs each distinct issue once however many times it is committed', () => {
    const { log, records } = createLogSpy();
    const store = createAccountStore(openTestAccountDb(binding), { log });

    for (let cycle = 0; cycle < 3; cycle++) {
      store.commit(skillsRead({ dmg_static: 9 }, degraded(`t${String(cycle)}`)), { gameRunning: true });
    }

    const issues = records.filter((entry) => entry.record.event === 'data.issue');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.record).toMatchObject({ kind: 'skill_tree_withheld', section: 'skills', keys: LOST_XP_MULT });
    store.close();
  });
});
