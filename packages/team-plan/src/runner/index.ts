/**
 * `@bombfarm/team-plan/runner` — the search off the main thread, labelled when it is not.
 *
 * A host may build one `createTeamPlanRunner` instance itself (a window-lifetime singleton) and
 * pass it to `useTeamPlanRunner({ runner })` so an in-flight solve survives its owner unmounting;
 * absent, the hook creates one exactly as it always has.
 */
import './register-chunk';

export { createTeamPlanWorkerModule } from './register-chunk';
export { createTeamPlanRunner, useTeamPlanRunner } from './use-team-plan-runner';
export type {
  TeamPlanRunner,
  TeamPlanRunnerHandle,
  TeamPlanRunnerState,
  TeamPlanWorkerFactory,
  TeamPlanWorkerLike,
} from './use-team-plan-runner';
export type { TeamPlanWorkerRequest, TeamPlanWorkerResponse } from './team-plan.worker';
export type { TeamPlanRunStatus } from '../core/run-status';
