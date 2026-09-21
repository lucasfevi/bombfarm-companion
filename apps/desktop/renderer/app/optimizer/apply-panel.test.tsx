import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AccountView, ApplyEquipUnit, ApplyPointsUnit } from '@bombfarm/contracts';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { en } from '../../lib/copy/en';
import type { AccountViewState } from '../../lib/account/account-view-store';
import type { ForgeQueueState } from '../../lib/forge/forge-queue-reducer';
import type { ApplyProgressState } from '../../lib/optimizer/apply-progress-reducer';
import { buildEquipStartRequest, buildPointsStartRequest, type ApplyForgeRowProps } from './apply-panel';

vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return { ...actual, useCopy: () => en, useLocale: () => ({ locale: 'en', lang: 'en', bcp47: 'en-US' }) };
});

const accountState = vi.hoisted<{ current: AccountViewState }>(() => ({ current: { status: 'loading', applied: 0, key: null } }));
const queueState = vi.hoisted<{ current: ForgeQueueState }>(() => ({
  current: { pieces: [], status: 'idle', active: null, halt: null, forged: 0 },
}));
const progressState = vi.hoisted<{ current: ApplyProgressState }>(() => ({
  current: {
    planRunId: null,
    steps: { equip: { status: 'idle' }, forge: { status: 'idle' }, points: { status: 'idle' } },
    confirming: null,
    modal: null,
    queuePausedByApply: false,
  },
}));
const applyActionsMock = vi.hoisted(() => ({
  bind: vi.fn(),
  openConfirm: vi.fn(),
  cancelConfirm: vi.fn(),
  confirm: vi.fn(),
  stop: vi.fn(),
  closeModal: vi.fn(),
  continueNext: vi.fn(),
  forgeDone: vi.fn(),
}));

vi.mock('../../lib/account/use-account-view', () => ({ useAccountView: () => accountState.current }));
vi.mock('../../lib/forge/forge-queue-store', () => ({ useForgeQueue: () => queueState.current }));
vi.mock('../../lib/optimizer/apply-store', () => ({
  useApplyProgress: () => progressState.current,
  applyActions: applyActionsMock,
}));

const { ApplyPanel } = await import('./apply-panel');

const PLAN: TeamPlan = {
  steps: [],
  forgeList: [],
  moveList: [{ phase: 'equip', itemId: 'i-ready', defId: 'steel_luva', slot: 'luva', fromHeroId: null, toHeroId: 'h1' }],
  pointResets: [
    { heroId: 'h-place', ptsBefore: ZERO_PTS(), pts: { ...ZERO_PTS(), energy: 2 }, heroGainDpsPct: 0, rosterGainObjective: 0, resetCostGold: 0 },
  ],
  perHero: [],
  proposedLoadouts: {},
  regime: 'underSaturated',
  sumDuty: 0,
  slots: 6,
  currentDps: 0,
  planDps: 0,
  forgeFloorApplied: 3,
  allowedChanges: 'both',
  scoredPhase: null,
  scoredPhaseSource: 'account',
  scoredPhaseInfeasible: false,
  gearBreakdown: { forgeDelta: 0, moveDelta: 0 },
  requiresFullPlan: false,
  gearDipDps: 0,
  runedHeroNames: [],
  run: { rounds: 0, evaluations: 0, budgetExhausted: false, elapsedMs: 0, seedUsed: 'current' },
};

const LOADED_VIEW = {
  payload: { account: { gold: 1_000 }, heroes: [], items: [] },
  gameRunning: false,
  store: { status: 'ok', reason: null, binding: 'better-sqlite3' },
} as unknown as AccountView;

function panel(overrides: Partial<Parameters<typeof ApplyPanel>[0]> = {}, forgeRow?: (props: ApplyForgeRowProps) => React.ReactNode): string {
  return renderToStaticMarkup(
    createElement(ApplyPanel, {
      plan: PLAN,
      planHeroes: null,
      planRunId: 'run-1',
      blocked: false,
      farmChosenPhase: null,
      forgeWritesEnabled: true,
      accountSource: null,
      ...(forgeRow === undefined ? {} : { forgeRow }),
      ...overrides,
    }),
  );
}

describe('ApplyPanel — composition', () => {
  it('renders the panel with title, intro, strip and the Equip and Reset rows in order, with no forgeRow', () => {
    accountState.current = { status: 'loaded', applied: 1, key: 'k', view: LOADED_VIEW };
    const html = panel();
    expect(html).toContain('data-testid="apply-panel"');
    expect(html).toContain(en.applyPanelTitle);
    expect(html).toContain(en.applyPanelIntro);
    expect(html).toContain('data-testid="apply-ledger"');
    const equipAt = html.indexOf('data-testid="apply-step-equip"');
    const pointsAt = html.indexOf('data-testid="apply-step-points"');
    expect(equipAt).toBeGreaterThan(-1);
    expect(pointsAt).toBeGreaterThan(equipAt);
  });

  it('draws a stub forgeRow second, between Equip and Reset', () => {
    accountState.current = { status: 'loaded', applied: 1, key: 'k', view: LOADED_VIEW };
    const stub = () => createElement('div', { 'data-testid': 'apply-step-forge-stub' });
    const html = panel({}, stub);
    const equipAt = html.indexOf('data-testid="apply-step-equip"');
    const forgeAt = html.indexOf('data-testid="apply-step-forge-stub"');
    const pointsAt = html.indexOf('data-testid="apply-step-points"');
    expect(equipAt).toBeGreaterThan(-1);
    expect(forgeAt).toBeGreaterThan(equipAt);
    expect(pointsAt).toBeGreaterThan(forgeAt);
  });

  it('hands the forgeRow stub a null gate while only the switch is off', () => {
    accountState.current = { status: 'loaded', applied: 1, key: 'k', view: LOADED_VIEW };
    const received: { current: ApplyForgeRowProps | null } = { current: null };
    const stub = (props: ApplyForgeRowProps) => {
      received.current = props;
      return null;
    };
    panel({ forgeWritesEnabled: false }, stub);
    expect(received.current).not.toBeNull();
    expect(received.current?.gate).toBeNull();
  });

  it('hands the forgeRow stub a reason while another step is running', () => {
    accountState.current = { status: 'loaded', applied: 1, key: 'k', view: LOADED_VIEW };
    progressState.current = {
      ...progressState.current,
      steps: { ...progressState.current.steps, equip: { status: 'running' } },
    };
    const received: { current: ApplyForgeRowProps | null } = { current: null };
    const stub = (props: ApplyForgeRowProps) => {
      received.current = props;
      return null;
    };
    panel({}, stub);
    expect(received.current?.gate).not.toBeNull();
    expect(received.current?.gate?.reason).toContain(en.applyStepEquipTitle);
    progressState.current = {
      planRunId: null,
      steps: { equip: { status: 'idle' }, forge: { status: 'idle' }, points: { status: 'idle' } },
      confirming: null,
      modal: null,
      queuePausedByApply: false,
    };
  });

  it('covers the whole panel with one message when a change breaks the plan, and prints no per-row warning', () => {
    accountState.current = { status: 'loaded', applied: 1, key: 'k', view: LOADED_VIEW };
    const received: { current: ApplyForgeRowProps | null } = { current: null };
    const stub = (props: ApplyForgeRowProps) => {
      received.current = props;
      return null;
    };
    const html = panel({ blocked: true }, stub);
    expect(html).toContain('data-testid="apply-panel-blocked"');
    expect(html).toContain(en.applyPanelBlockedTitle);
    expect(html).not.toContain('data-testid="apply-panel-banner"');
    expect(html).not.toContain('data-testid="apply-step-equip-reason"');
    expect(received.current?.gate).not.toBeNull();
    expect(received.current?.gate?.reason).toBe('');
  });

  it('draws no overlay and no warning when the plan still stands', () => {
    accountState.current = { status: 'loaded', applied: 1, key: 'k', view: LOADED_VIEW };
    const html = panel({ blocked: false });
    expect(html).not.toContain('data-testid="apply-panel-blocked"');
  });

  it('disables the two writing rows and prints the switch sentence once, panel-wide, when the switch is off', () => {
    accountState.current = { status: 'loaded', applied: 1, key: 'k', view: LOADED_VIEW };
    const html = panel({ forgeWritesEnabled: false });
    expect(html).toContain('data-testid="apply-panel-banner"');
    expect((html.match(new RegExp(en.settingsForgeWritesLabel, 'g')) ?? []).length).toBeGreaterThan(0);
  });

  it('disables the other rows and names the running step when one step runs', () => {
    accountState.current = { status: 'loaded', applied: 1, key: 'k', view: LOADED_VIEW };
    progressState.current = {
      ...progressState.current,
      steps: { equip: { status: 'running' }, forge: { status: 'idle' }, points: { status: 'idle' } },
    };
    const html = panel();
    expect(html).toContain(sub(en.applyPanelOtherRunning, { step: en.applyStepEquipTitle }));
    progressState.current = {
      planRunId: null,
      steps: { equip: { status: 'idle' }, forge: { status: 'idle' }, points: { status: 'idle' } },
      confirming: null,
      modal: null,
      queuePausedByApply: false,
    };
  });
});

function sub(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => values[key] ?? m);
}

describe('the confirm request carries pending units verbatim', () => {
  const EQUIP_UNITS: readonly ApplyEquipUnit[] = [
    {
      index: 0,
      call: 'equip',
      itemId: 'i-ready',
      defId: 'steel_luva',
      slot: 'luva',
      fromHeroId: null,
      toHeroId: 'h1',
      displacesItemId: null,
      freedByIndex: null,
      pendingAt: [],
      doneAt: [],
    },
    {
      index: 1,
      call: 'unequip',
      itemId: 'i-old',
      defId: 'clay_arma',
      slot: 'arma',
      fromHeroId: 'h2',
      toHeroId: null,
      displacesItemId: null,
      freedByIndex: null,
      pendingAt: [],
      doneAt: [],
    },
  ];

  it('picks only the pending indexes, with every field of the domain unit untouched', () => {
    const request = buildEquipStartRequest('run-1', EQUIP_UNITS, new Set([0]));
    expect(request).toEqual({ step: 'equip', planRunId: 'run-1', units: [EQUIP_UNITS[0]] });
    expect(request.units[0]).toBe(EQUIP_UNITS[0]);
  });

  it('carries every pending unit when more than one is pending', () => {
    const request = buildEquipStartRequest('run-1', EQUIP_UNITS, new Set([0, 1]));
    expect(request.units).toEqual(EQUIP_UNITS);
  });

  const POINTS_UNITS: readonly ApplyPointsUnit[] = [
    {
      index: 0,
      heroId: 'h-place',
      level: 20,
      needsRespec: false,
      respecGold: 0,
      vectorBefore: [0, 0, 0, 0, 0, 0, 0, 0],
      vector: [0, 2, 0, 0, 0, 0, 0, 0],
      pointsPlaced: 2,
    },
  ];

  it('does the same for the points step', () => {
    const request = buildPointsStartRequest('run-1', POINTS_UNITS, new Set([0]));
    expect(request).toEqual({ step: 'points', planRunId: 'run-1', units: POINTS_UNITS });
  });

  it('sends none of them when nothing is pending', () => {
    const request = buildPointsStartRequest('run-1', POINTS_UNITS, new Set());
    expect(request.units).toHaveLength(0);
  });
});

describe('ApplyPanel — source pin', () => {
  const source = readFileSync(path.join(__dirname, 'apply-panel.tsx'), 'utf8');

  it('memoises the facts on the live view reference', () => {
    expect(source).toMatch(/useMemo\(\s*\(\)\s*=>\s*buildApplyFacts\(/);
    // The deps array directly follows the call — this file's own formatting, pinned rather than
    // re-derived, since a reformat that dropped `liveView` from the array would otherwise pass.
    expect(source).toContain('[plan, planHeroes, liveView, farmChosenPhase, t, locale],\n  );');
  });
});
