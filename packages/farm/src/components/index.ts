/**
 * `@bombfarm/farm/components` — the farm screen's React views.
 *
 * Every component here is prop-driven: none reads a store, a router or a host module, and none
 * carries copy of its own beyond `@bombfarm/farm/copy`. A host renders {@link FarmRankingBoardView}
 * from a connector that does its own state reads and passes the two bags down.
 */
export { FarmRankingBoardView } from './farm-ranking-board';
export type {
  FarmRankingBoardActions,
  FarmRankingBoardData,
  FarmRespecBoardData,
} from './farm-ranking-board';
export type { FarmStatLabels } from './stat-labels';
