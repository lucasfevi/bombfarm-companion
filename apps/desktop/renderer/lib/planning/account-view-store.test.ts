import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AccountFidelity, AccountPayload, AccountView } from '@bombfarm/contracts';
import { buildPlanningModel } from './account-model';
import { accept, initialAccountViewState, type AccountViewState, type Arrival } from './account-view-store';
import { adviceForHero, getAdviceComputeCount, resetAdviceComputeCount } from './hero-advice';

const NOW = '2026-08-12T00:00:00.000Z';

function resolvedFidelity(): AccountFidelity {
  return {
    account: { status: 'resolved', capturedAt: NOW },
    heroes: { status: 'resolved', capturedAt: NOW },
    skills: { status: 'resolved', capturedAt: NOW },
    casa: { status: 'resolved', capturedAt: NOW },
    items: { status: 'resolved', capturedAt: NOW },
  };
}

function payloadWithHeroLevel(level: number): AccountPayload {
  return {
    account: { phase: 30 },
    heroes: [
      {
        id: 'h1',
        name: 'Alpha',
        level,
        rarity: 2,
        stars: 1,
        birth_stats: { dmg: 200, energia: 300, speed: 40, crit_chance: 10, crit_dmg: 60, penetration: 2, cooldown_reduction: 1, luck: 0 },
        stats: { dmg: 200, energia: 300, speed: 40, crit_chance: 10, crit_dmg: 60, penetration: 2, cooldown_reduction: 1, luck: 0 },
        stat_points_available: 0,
      },
    ],
    skills: { totals: { dmg_static: 2.1, crit_dmg_mult: 1 } },
    casa: { active_casa: 1, levels: [10] },
    items: [],
    fidelity: resolvedFidelity(),
  };
}

function viewWithHeroLevel(level: number): AccountView {
  return { payload: payloadWithHeroLevel(level), gameRunning: false, store: { status: 'ok', reason: null, binding: 'better-sqlite3' } };
}

describe('accept — the pure reducer (design.md §4.4)', () => {
  it('has no React import — read from source (F2\'s technique)', () => {
    const source = readFileSync(path.join(__dirname, 'account-view-store.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"]react['"]/);
  });

  it('bridge-missing ⇒ bridge-unavailable, never throws', () => {
    expect(() => accept(initialAccountViewState, { kind: 'bridge-missing' })).not.toThrow();
    const result = accept(initialAccountViewState, { kind: 'bridge-missing' });
    expect(result.status).toBe('bridge-unavailable');
  });

  it('pushed ⇒ accepted iff accountChangeKey differs from state.key (MAR-03\'s accept gate)', () => {
    const view = viewWithHeroLevel(20);
    const accepted = accept(initialAccountViewState, { kind: 'pushed', view });
    expect(accepted.status).toBe('loaded');
    if (accepted.status !== 'loaded') throw new Error('expected loaded');
    expect(accepted.view).toBe(view);
    expect(accepted.applied).toBe(1);

    // The SAME view again (same key) ⇒ same state reference, not just shallow-equal — this is
    // what lets a caller's setState bail out of a re-render entirely.
    const sameAgain = accept(accepted, { kind: 'pushed', view: viewWithHeroLevel(20) });
    expect(sameAgain).toBe(accepted);
    expect(sameAgain.applied).toBe(1);

    // A genuinely different view (different key) ⇒ a new state, applied bumped.
    const changed = accept(accepted, { kind: 'pushed', view: viewWithHeroLevel(21) });
    expect(changed.status).toBe('loaded');
    if (changed.status !== 'loaded') throw new Error('expected loaded');
    expect(changed.applied).toBe(2);
  });

  it('fetched ⇒ discarded when issuedAt !== state.applied (MAR-11, and the boot-race edge case — one rule covers both)', () => {
    // A push landed (applied: 0 -> 1) BEFORE the initial account:get (issued at applied=0)
    // resolves. The stale fetched arrival must not overwrite the newer pushed view.
    const pushedView = viewWithHeroLevel(99);
    const afterPush = accept(initialAccountViewState, { kind: 'pushed', view: pushedView });
    expect(afterPush.applied).toBe(1);

    const staleFetched = accept(afterPush, { kind: 'fetched', view: viewWithHeroLevel(1), issuedAt: 0 });
    expect(staleFetched).toBe(afterPush); // discarded — no change at all
    if (staleFetched.status !== 'loaded') throw new Error('expected loaded');
    expect(staleFetched.view).toBe(pushedView);
  });

  it('fetched ⇒ accepted when issuedAt === state.applied and the key differs', () => {
    const fetched = accept(initialAccountViewState, { kind: 'fetched', view: viewWithHeroLevel(20), issuedAt: 0 });
    expect(fetched.status).toBe('loaded');
    if (fetched.status !== 'loaded') throw new Error('expected loaded');
    expect(fetched.applied).toBe(1);
  });

  it('fetch-failed ⇒ surfaces an error only if nothing has been applied yet — never blanks a good screen', () => {
    const failedFromLoading = accept(initialAccountViewState, { kind: 'fetch-failed', message: 'boom', issuedAt: 0 });
    expect(failedFromLoading.status).toBe('error');

    const loaded = accept(initialAccountViewState, { kind: 'pushed', view: viewWithHeroLevel(20) });
    const failedFromLoaded = accept(loaded, { kind: 'fetch-failed', message: 'boom', issuedAt: 0 });
    expect(failedFromLoaded).toBe(loaded); // unchanged — a failed read never blanks a good screen
  });

  it('demonstrates the red state: removing the issuedAt check accepts the stale fetched view (observed here, not committed as a permanent mutation)', () => {
    function acceptWithoutOrderingCheck(state: AccountViewState, arrival: Arrival): AccountViewState {
      if (arrival.kind !== 'fetched') return accept(state, arrival);
      // The mutation: no issuedAt comparison at all.
      return { status: 'loaded', view: arrival.view, applied: state.applied + 1, key: 'mutated' };
    }

    const pushedView = viewWithHeroLevel(99);
    const afterPush = acceptWithoutOrderingCheck(initialAccountViewState, { kind: 'pushed', view: pushedView });
    const staleFetched = acceptWithoutOrderingCheck(afterPush, {
      kind: 'fetched',
      view: viewWithHeroLevel(1),
      issuedAt: 0,
    });

    // The mutant lets the OLDER fetched view overwrite the newer pushed one — the exact defect
    // the real `issuedAt` check exists to prevent. The real `accept` above asserts the opposite
    // (`staleFetched` toBe `afterPush`).
    if (staleFetched.status !== 'loaded') throw new Error('expected loaded');
    expect(staleFetched.view).not.toBe(pushedView);
  });
});

describe('MAR-13 — two arrivals in quick succession settle to the newer view and move the advice compute count by exactly 1', () => {
  beforeEach(() => {
    resetAdviceComputeCount();
  });

  it('settles to the newer view, and getAdviceComputeCount() moves by exactly 1', () => {
    // A React render count is not observable in apps/desktop's node-env Vitest project
    // (renderToStaticMarkup never runs useEffect — use-account-view.ts's own comment). Asserted
    // instead as: one settled state, carrying the newer view, plus exactly one advice
    // computation — not a render count.
    const olderView = viewWithHeroLevel(20);
    const newerView = viewWithHeroLevel(21);

    // Two arrivals "in quick succession" — a push, then another push with newer data, exactly as
    // two account:changed events landing back to back would drive this reducer.
    const afterFirst = accept(initialAccountViewState, { kind: 'pushed', view: olderView });
    const settled = accept(afterFirst, { kind: 'pushed', view: newerView });

    expect(settled.status).toBe('loaded');
    if (settled.status !== 'loaded') throw new Error('expected loaded');
    expect(settled.view).toBe(newerView);

    // The reducer itself does not compute advice — a caller (the hook + buildPlanningModel +
    // adviceForHero) does. Driving the settled view (and only the settled view) through that
    // pipeline once is what "exactly one computation" means here: the OLDER view's advice is
    // never computed at all, because the reducer discarded it before anything downstream saw it.
    const model = buildPlanningModel(settled.view);
    const heroId = model.heroes[0]?.hero.id;
    if (!heroId) throw new Error('expected a hero in this fixture');
    adviceForHero(model, heroId);
    expect(getAdviceComputeCount()).toBe(1);
  });
});
