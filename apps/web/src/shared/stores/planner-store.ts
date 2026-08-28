import { create, type StateCreator } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { withOptionalDevtools } from '@/shared/stores/devtools-middleware';
import {
  createAccountSlice,
  type AccountSlice,
} from '@/shared/stores/slices/account-slice';
import {
  createPhasesSlice,
  type PhasesSlice,
} from '@/shared/stores/slices/phases-slice';
import {
  createHeroDraftSlice,
  type HeroDraftSlice,
} from '@/shared/stores/slices/hero-draft-slice';
import {
  createRosterSlice,
  type RosterSlice,
} from '@/shared/stores/slices/roster-slice';
import {
  createTeamPlanSlice,
  type TeamPlanSlice,
} from '@/shared/stores/slices/team-plan-slice';
import {
  clearSessionTimersForTests,
  createSessionSlice,
  type SessionSlice,
} from '@/shared/stores/slices/session-slice';
import { clearAccountSharedSelectorCache } from '@/shared/stores/selectors/account-selectors';
import { resetPlannerTabStatusCache } from '@/shared/stores/selectors/tab-status-selectors';
import { resetResetAdviceRosterCache } from '@/shared/stores/selectors/reset-advice-roster-selectors';

export type PlannerStore = SessionSlice &
  AccountSlice &
  RosterSlice &
  PhasesSlice &
  HeroDraftSlice &
  TeamPlanSlice;

const composeSlices: StateCreator<
  PlannerStore,
  [['zustand/subscribeWithSelector', never]],
  [],
  PlannerStore
> = (...args) => ({
  ...createSessionSlice(...args),
  ...createAccountSlice(...args),
  ...createRosterSlice(...args),
  ...createPhasesSlice(...args),
  ...createHeroDraftSlice(...args),
  ...createTeamPlanSlice(...args),
});

/**
 * Root planner store. Pure defaults only — no localStorage at module scope.
 * Persistence is attachPlannerPersistence + hydratePlannerStore (later tasks).
 *
 * Middleware: subscribeWithSelector is always outer; devtools sits inside it and is
 * aliased away entirely for production builds — see devtools-middleware.ts.
 */
export const usePlannerStore = create<PlannerStore>()(
  subscribeWithSelector(withOptionalDevtools(composeSlices)),
);

/** Snapshot of initial slice defaults for Vitest isolation. */
const initialPlannerState = usePlannerStore.getState();

type TestCleanup = () => void;
let persistenceTestCleanup: TestCleanup | null = null;
let storageListenerTestCleanup: TestCleanup | null = null;

/** Persistence / storage layers register cleanup so reset cancels timers + listeners. */
export function registerPlannerStoreTestCleanup(
  kind: 'persistence' | 'storageListeners',
  callback: TestCleanup,
) {
  if (kind === 'persistence') persistenceTestCleanup = callback;
  else storageListenerTestCleanup = callback;
}

export function resetPlannerStoreForTests(): void {
  clearSessionTimersForTests();
  clearAccountSharedSelectorCache();
  resetPlannerTabStatusCache();
  resetResetAdviceRosterCache();
  usePlannerStore.setState(initialPlannerState, true);
  persistenceTestCleanup?.();
  storageListenerTestCleanup?.();
}
