import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { scoredPhaseHint, scoredPhaseValue } from '@bombfarm/team-plan/model';
import { OptimizerCard } from '@/features/home/components/optimizer-card';
import { STRINGS, sub, type Lang } from '@/shared/i18n';
import { normalizeHero } from '@/shared/lib/storage';
import {
  ensureTeamPlanSolver,
  resetPlannerStoreForTests,
  resetTeamPlanSolverForTests,
  usePlannerStore,
  type PlannerStore,
} from '@/shared/stores';
import { selectLiveTeamPlanInputSignature } from '@/shared/stores/slices/team-plan-slice';
import type { TeamPlanSolver, TeamPlanSolverSnapshot } from '@/shared/stores/team-plan-solver';

vi.mock('@/shared/stores/planner-store', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/shared/stores/planner-store')>();
  const live = Object.assign(
    (selector: (state: PlannerStore) => unknown) => selector(real.usePlannerStore.getState()),
    real.usePlannerStore,
  );
  return { ...real, usePlannerStore: live };
});

const LANGS: readonly Lang[] = ['en', 'pt'];

const hero = normalizeHero({
  id: 'a',
  name: 'Hero a',
  sourceId: 'src-a',
  updatedAt: 1,
  rarity: 'Raro',
  level: 10,
  stars: 1,
  naked: { attack: 100, energy: 100, speed: 50, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
  gearedOverride: { attack: 100, energy: 100, speed: 50, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
  loadout: emptyLoadout(),
  pts: ZERO_PTS(),
  battleAllowed: true,
});

const item: InventoryItem = {
  id: '1',
  defId: 'ember_calca',
  rarityIdx: 2,
  level: 10,
  upgrade: 8,
  slot: 'calca',
  equipped: false,
  equippedBy: null,
  defResolved: true,
  marketBlocked: false,
};

const state = () => usePlannerStore.getState();
const render = () => renderToStaticMarkup(createElement(OptimizerCard));
const textOf = (html: string) => html.replace(/<[^>]+>/g, '');
const openingOf = (html: string, testId: string) =>
  html.lastIndexOf('<div', html.indexOf(`data-testid="${testId}"`));
const body = (html: string) =>
  html.slice(openingOf(html, 'home-card-body'), openingOf(html, 'home-card-footer'));
const footer = (html: string) => textOf(html.slice(openingOf(html, 'home-card-footer')));
const escaped = (text: string) => text.replace(/'/g, '&#x27;');

const bodyClass = (html: string) => /class="([^"]*)"/.exec(body(html))?.[1] ?? '';
const contextText = (html: string) =>
  /<span[^>]*>([^<]*)<\/span>/.exec(html.slice(0, openingOf(html, 'home-card-body')))?.[1] ?? null;
const actionKinds = (html: string) =>
  [...body(html).matchAll(/data-testid="home-optimizer-action" data-kind="([a-z]+)"/g)].map((m) => m[1]);
const lineText = (html: string, testId: string) =>
  textOf(new RegExp(`<p[^>]*data-testid="${testId}"[^>]*>(.*?)</p>`).exec(html)?.[1] ?? '');

let snapshot: TeamPlanSolverSnapshot;

function fakeSolver(): TeamPlanSolver {
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    solve: () => {},
    cancel: () => {},
    runner: {} as TeamPlanSolver['runner'],
  };
}

function arrangeUsable() {
  state().hydrateRoster([hero], 'a');
  usePlannerStore.setState({
    inventory: { version: 1, importedAt: 1, items: [item] },
    scopeByHeroId: { a: 'optimize' },
    objective: 'farm',
    phase: 51,
    maxPhase: 137,
  });
}

function plan(overrides: Partial<TeamPlan>): TeamPlan {
  return {
    steps: [],
    forgeList: [],
    moveList: [],
    pointResets: [],
    perHero: [],
    proposedLoadouts: {},
    regime: 'underSaturated',
    sumDuty: 1,
    slots: 3,
    currentDps: 100,
    planDps: 120,
    forgeFloorApplied: 10,
    allowedChanges: 'both',
    scoredPhase: null,
    scoredPhaseSource: 'account',
    scoredPhaseInfeasible: false,
    gearBreakdown: { forgeDelta: 0, moveDelta: 0 },
    requiresFullPlan: false,
    gearDipDps: 0,
    runedHeroNames: [],
    run: { rounds: 1, evaluations: 1, budgetExhausted: false, elapsedMs: 1, seedUsed: 'seed' },
    ...overrides,
  };
}

function equip(itemId: string, fromHeroId: string | null): TeamPlan['moveList'][number] {
  return { phase: 'equip', itemId, defId: 'ember_calca', slot: 'calca', fromHeroId, toHeroId: 'src-a' };
}

function reset(rosterGainObjective: number): TeamPlan['pointResets'][number] {
  return { heroId: 'src-a', ptsBefore: {}, pts: {}, heroGainDpsPct: 0, rosterGainObjective, resetCostGold: 0 };
}

const applyMatchingPlan = (solved: TeamPlan) =>
  usePlannerStore.setState({
    plan: solved,
    planInputSignature: selectLiveTeamPlanInputSignature(state()),
    runStatus: 'done',
    runId: '1',
  });

describe('the front page optimizer card', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetTeamPlanSolverForTests();
    snapshot = {
      status: 'idle',
      plan: null,
      blockedHeroNames: [],
      errorMessage: null,
      ranOnMainThread: false,
      runId: null,
    };
    ensureTeamPlanSolver(fakeSolver);
  });

  afterEach(() => {
    resetPlannerStoreForTests();
    resetTeamPlanSolverForTests();
  });

  it("each of the four missing inputs prints the Optimizer page's own line", () => {
    const fixtures: {
      name: string;
      arrange: () => void;
      key:
        | 'teamPlanEmptyNoRosterTitle'
        | 'teamPlanEmptyNoInventoryTitle'
        | 'teamPlanEmptyAllLeaveAloneTitle'
        | 'teamPlanObjectiveFarmNeedsMaxPhase';
    }[] = [
      { name: 'no roster', arrange: () => usePlannerStore.setState({ phase: 51 }), key: 'teamPlanEmptyNoRosterTitle' },
      {
        name: 'no inventory',
        arrange: () => state().hydrateRoster([hero], 'a'),
        key: 'teamPlanEmptyNoInventoryTitle',
      },
      {
        name: 'every hero left alone',
        arrange: () => {
          state().hydrateRoster([hero], 'a');
          usePlannerStore.setState({
            inventory: { version: 1, importedAt: 1, items: [item] },
            scopeByHeroId: { a: 'leaveAlone' },
          });
        },
        key: 'teamPlanEmptyAllLeaveAloneTitle',
      },
      {
        name: 'a gold plan with no phase to bound it',
        arrange: () => {
          state().hydrateRoster([hero], 'a');
          usePlannerStore.setState({
            inventory: { version: 1, importedAt: 1, items: [item] },
            scopeByHeroId: { a: 'optimize' },
            objective: 'farm',
            phase: null,
            maxPhase: null,
          });
        },
        key: 'teamPlanObjectiveFarmNeedsMaxPhase',
      },
    ];

    for (const { name, arrange, key } of fixtures) {
      for (const lang of LANGS) {
        resetPlannerStoreForTests();
        arrange();
        usePlannerStore.setState({ lang });
        const html = render();

        expect(html, name).toContain('data-home-card-state="needs"');
        expect(textOf(body(html)), name).toBe('');
        expect(footer(html), name).toBe(escaped(STRINGS[lang][key]));
        expect(html, name).toContain(`>${STRINGS[lang].homeCardOptimizerContext}<`);
      }
    }
  });

  it('renders the skeleton only while the first solve runs and never over an existing plan', () => {
    arrangeUsable();
    usePlannerStore.setState({ plan: null, planInputSignature: null, runStatus: 'running', runId: '1' });

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const html = render();

      expect(html).toContain('data-home-card-state="skeleton"');
      expect(body(html)).toContain('data-testid="home-optimizer-skeleton"');
      expect(footer(html)).toBe(sub(STRINGS[lang].homeCardOptimizerSearching, { elapsed: 0 }));
    }

    usePlannerStore.setState({ plan: plan({}), planInputSignature: 'old', runStatus: 'running', runId: '2' });
    const overPlan = render();
    expect(overPlan).not.toContain('data-home-card-state="skeleton"');
    expect(overPlan).not.toContain('home-optimizer-skeleton');
  });

  it('keeps a stale plan dimmed under Recalculating while the new solve runs', () => {
    arrangeUsable();
    usePlannerStore.setState({ plan: plan({}), planInputSignature: 'old', runStatus: 'running', runId: '2' });

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const html = render();

      expect(html).toContain('data-home-card-state="recalculating"');
      expect(body(html)).toContain('data-testid="home-optimizer-headline"');
      expect(bodyClass(html).split(' ')).toContain('opacity-50');
      expect(contextText(html)).toBe(STRINGS[lang].homeCardOptimizerRecalculating);
      expect(html).not.toContain(STRINGS[lang].homeCardOptimizerContext);
    }
  });

  it('a stale plan under the floor stays the not-worth sentence while it recalculates', () => {
    arrangeUsable();
    usePlannerStore.setState({
      plan: plan({ currentDps: 100, planDps: 104, moveList: [equip('1', null)] }),
      planInputSignature: 'old',
      runStatus: 'running',
      runId: '2',
    });

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const html = render();

      expect(html).toContain('data-home-card-state="recalculating"');
      expect(textOf(body(html))).toBe(escaped(STRINGS[lang].farmRespecNotWorthTitle));
      expect(html).not.toContain('home-optimizer-headline');
      expect(html).not.toContain('home-optimizer-action');
      expect(bodyClass(html).split(' ')).toContain('opacity-50');
      expect(footer(html)).toBe(STRINGS[lang].homeCardOptimizerSeeFullPlan);
      expect(contextText(html)).toBe(STRINGS[lang].homeCardOptimizerRecalculating);
    }
  });

  it("a plan under the worth-making floor prints the advisor's sentence and no action", () => {
    arrangeUsable();
    applyMatchingPlan(plan({ currentDps: 100, planDps: 104, moveList: [equip('1', null)] }));

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const html = render();

      expect(html).toContain('data-home-card-state="belowFloor"');
      expect(textOf(body(html))).toBe(escaped(STRINGS[lang].farmRespecNotWorthTitle));
      expect(html).not.toContain('home-optimizer-action');
      expect(html).not.toContain('home-optimizer-headline');
      expect(footer(html)).toBe(STRINGS[lang].homeCardOptimizerSeeFullPlan);
      expect(html.slice(openingOf(html, 'home-card-footer'))).toMatch(/<a [^>]*href="\/optimizer"/);
    }
  });

  it("blocked and error print the page's copy with no retry, even over an older plan", () => {
    arrangeUsable();
    applyMatchingPlan(plan({}));

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang, runStatus: 'blocked' });
      snapshot = { ...snapshot, status: 'blocked', blockedHeroNames: ['Hero a', 'Hero b'] };
      const blocked = render();

      expect(blocked).toContain('data-home-card-state="blocked"');
      expect(textOf(body(blocked))).toBe(
        escaped(
          STRINGS[lang].teamPlanBlockedTitle +
            sub(STRINGS[lang].teamPlanBlockedBody, { heroes: 'Hero a, Hero b' }),
        ),
      );
      expect(footer(blocked)).toBe('');
      expect(blocked.match(/<a /g)).toHaveLength(1);
      expect(blocked).not.toContain('<button');

      usePlannerStore.setState({ runStatus: 'error' });
      snapshot = { ...snapshot, status: 'error', errorMessage: 'worker fell over' };
      const errored = render();

      expect(errored).toContain('data-home-card-state="error"');
      expect(textOf(body(errored))).toBe(escaped(STRINGS[lang].teamPlanErrorTitle + 'worker fell over'));
      expect(footer(errored)).toBe('');
      expect(errored.match(/<a /g)).toHaveLength(1);
      expect(errored).not.toContain('<button');
    }
  });

  it('the action list is equips in list order, then forges, then resets, three at most, with a contribution only on a reset', () => {
    arrangeUsable();
    const solved = plan({
      currentDps: 100,
      planDps: 120,
      scoredPhase: 60,
      scoredPhaseSource: 'searched',
      moveList: [
        equip('1', null),
        { phase: 'unequip', itemId: '2', defId: 'ember_calca', slot: 'calca', fromHeroId: 'src-b', toHeroId: null },
        equip('2', 'src-b'),
      ],
      forgeList: [{ itemId: '3', defId: 'ember_calca', from: 8, to: 10 }],
      pointResets: [reset(1234), reset(50)],
    });
    applyMatchingPlan(solved);

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const t = STRINGS[lang];
      const html = render();

      expect(html).toContain('data-home-card-state="plan"');
      expect(lineText(html, 'home-optimizer-headline')).toBe(
        sub(t.homeCardOptimizerHeadlineFarm, { pct: lang === 'en' ? '+20.0' : '+20,0' }),
      );
      expect(lineText(html, 'home-optimizer-scored-at')).toBe(
        `${sub(t.homeCardOptimizerScoredAt, { phase: scoredPhaseValue(lang, solved) })} · ${scoredPhaseHint(t, solved)}`,
      );
      expect(actionKinds(html)).toEqual(['equip', 'move', 'forge']);
      expect(html.match(/home-optimizer-contribution/g) ?? []).toHaveLength(0);
      expect(footer(html)).toBe(
        [
          sub(t.homeCardOptimizerCountMoves, { count: 3 }),
          sub(t.homeCardOptimizerCountResets, { count: 2 }),
          t.homeCardOptimizerSeeFullPlan,
        ].join(' · '),
      );
    }

    applyMatchingPlan(plan({ ...solved, moveList: [], forgeList: [] }));
    const resetsOnly = render();
    expect(actionKinds(resetsOnly)).toEqual(['reset', 'reset']);
    expect(resetsOnly.match(/home-optimizer-contribution/g)).toHaveLength(2);
  });

  it('a plan with one move and no resets prints one row and a footer with the moves count only', () => {
    arrangeUsable();
    usePlannerStore.setState({ objective: 'dps' });
    applyMatchingPlan(plan({ currentDps: 100, planDps: 120, moveList: [equip('1', null)] }));

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const t = STRINGS[lang];
      const html = render();

      expect(html).toContain('data-home-card-state="plan"');
      expect(lineText(html, 'home-optimizer-headline')).toBe(
        sub(t.homeCardOptimizerHeadlineDps, { pct: lang === 'en' ? '+20.0' : '+20,0' }),
      );
      expect(html).not.toContain(t.homeCardOptimizerHeadlineFarm.replace('{pct}', ''));
      expect(actionKinds(html)).toEqual(['equip']);
      expect(footer(html)).toBe(`${sub(t.homeCardOptimizerCountMoves, { count: 1 })} · ${t.homeCardOptimizerSeeFullPlan}`);
      expect(footer(html)).not.toContain(t.homeCardOptimizerCountResets.replace('{count} ', ''));
    }
  });
});
