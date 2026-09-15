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
const seePlanLink = (html: string) =>
  /<a [^>]*data-testid="home-optimizer-see-plan" href="\/optimizer">([^<]*)<\/a>/.exec(body(html))?.[1] ?? null;
const gainText = (html: string) =>
  /<span[^>]*data-testid="home-optimizer-gain"[^>]*>([^<]*)<\/span>/.exec(html)?.[1] ?? null;
const gainClass = (html: string) =>
  /<span class="([^"]*)" data-testid="home-optimizer-gain">/.exec(html)?.[1] ?? '';
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

  it('says it is building the plan while the first solve runs, and never over an existing plan', () => {
    arrangeUsable();
    usePlannerStore.setState({ plan: null, planInputSignature: null, runStatus: 'running', runId: '1' });

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const t = STRINGS[lang];
      const html = render();

      expect(html).toContain('data-home-card-state="optimizing"');
      expect(lineText(html, 'home-optimizer-optimizing')).toBe(escaped(t.teamPlanOptimizingTitle));
      expect(textOf(body(html))).toBe(escaped(t.teamPlanOptimizingTitle + t.teamPlanOptimizingBody));
      expect(footer(html)).toBe(sub(t.homeCardOptimizerSearching, { elapsed: 0 }));
      expect(seePlanLink(html)).toBeNull();
    }

    usePlannerStore.setState({ plan: plan({}), planInputSignature: 'old', runStatus: 'running', runId: '2' });
    const overPlan = render();
    expect(overPlan).not.toContain('data-home-card-state="optimizing"');
    expect(overPlan).not.toContain('home-optimizer-optimizing');
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
      expect(textOf(body(html))).toBe(
        escaped(STRINGS[lang].farmRespecNotWorthTitle + STRINGS[lang].homeCardOptimizerSeeFullPlan),
      );
      expect(html).not.toContain('home-optimizer-headline');
      expect(bodyClass(html).split(' ')).toContain('opacity-50');
      expect(seePlanLink(html)).toBe(STRINGS[lang].homeCardOptimizerSeeFullPlan);
      expect(footer(html)).toBe('');
      expect(contextText(html)).toBe(STRINGS[lang].homeCardOptimizerRecalculating);
    }
  });

  it("a plan under the worth-making floor prints the advisor's sentence and the way to the full plan", () => {
    arrangeUsable();
    applyMatchingPlan(plan({ currentDps: 100, planDps: 104, moveList: [equip('1', null)] }));

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const html = render();

      expect(html).toContain('data-home-card-state="belowFloor"');
      expect(textOf(body(html))).toBe(
        escaped(STRINGS[lang].farmRespecNotWorthTitle + STRINGS[lang].homeCardOptimizerSeeFullPlan),
      );
      expect(html).not.toContain('home-optimizer-headline');
      expect(seePlanLink(html)).toBe(STRINGS[lang].homeCardOptimizerSeeFullPlan);
      expect(footer(html)).toBe('');
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

  it('a plan is its gain, the phase it was scored at, and one button to the full plan', () => {
    arrangeUsable();
    const solved = plan({
      currentDps: 100,
      planDps: 120,
      scoredPhase: 60,
      scoredPhaseSource: 'searched',
      moveList: [equip('1', null), equip('2', 'src-b')],
      forgeList: [{ itemId: '3', defId: 'ember_calca', from: 8, to: 10 }],
      pointResets: [reset(1234), reset(50)],
    });
    applyMatchingPlan(solved);

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const t = STRINGS[lang];
      const html = render();

      expect(html).toContain('data-home-card-state="plan"');
      expect(gainText(html)).toBe(lang === 'en' ? '+20.0%' : '+20,0%');
      expect(gainClass(html).split(' ')).toContain('text-up');
      expect(lineText(html, 'home-optimizer-headline')).toBe(
        `${gainText(html)} ${t.homeCardOptimizerHeadlineFarm}`,
      );
      expect(lineText(html, 'home-optimizer-scored-at')).toBe(
        `${sub(t.homeCardOptimizerScoredAt, { phase: scoredPhaseValue(lang, solved) })} · ${scoredPhaseHint(t, solved)}`,
      );
      expect(textOf(body(html))).toBe(
        lineText(html, 'home-optimizer-headline') +
          lineText(html, 'home-optimizer-scored-at') +
          escaped(t.homeCardOptimizerSeeFullPlan),
      );
      expect(seePlanLink(html)).toBe(t.homeCardOptimizerSeeFullPlan);
      expect(html.match(/<a /g)).toHaveLength(2);
      expect(footer(html)).toBe('');
    }
  });

  it('a damage plan names DPS in its headline', () => {
    arrangeUsable();
    usePlannerStore.setState({ objective: 'dps' });
    applyMatchingPlan(plan({ currentDps: 100, planDps: 120, moveList: [equip('1', null)] }));

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const t = STRINGS[lang];
      const html = render();

      expect(html).toContain('data-home-card-state="plan"');
      expect(gainText(html)).toBe(lang === 'en' ? '+20.0%' : '+20,0%');
      expect(lineText(html, 'home-optimizer-headline')).toBe(`${gainText(html)} ${t.homeCardOptimizerHeadlineDps}`);
      expect(html).not.toContain(t.homeCardOptimizerHeadlineFarm);
    }
  });
});
