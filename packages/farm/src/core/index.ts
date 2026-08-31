/**
 * `@bombfarm/farm/core` — presentation-free farm screen logic.
 *
 * A host app maps its own state onto {@link FarmInputs}, owns ONE {@link createFarmRankingMemo}
 * instance, and wraps that instance in whatever selector shape its own store library wants.
 * Nothing here imports a store library, React, or either app.
 */
export type { FarmInputs } from './farm-inputs';
export {
  buildAccount,
  computeFarmProposedRows,
  computeFarmRanking,
  computeFarmRespecGate,
  computeFarmRespecShouldSurface,
  deriveFarmPoolEntries,
  farmDepsEqual,
  readFarmDepTuple,
  readFarmRespecDepTuple,
  resolveEnabledHeroIds,
  runFarmRespecSolve,
} from './farm-compute';
export type {
  FarmPoolEntry,
  FarmRankingReason,
  FarmRankingResult,
  FarmRespecGate,
  FarmRespecGateReason,
} from './farm-compute';
export { createFarmRankingMemo } from './farm-memo';
export type { FarmRankingMemo } from './farm-memo';
