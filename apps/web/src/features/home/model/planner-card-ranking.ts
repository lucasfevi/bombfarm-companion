import { rankRosterByDps, type RosterDpsRow } from '@bombfarm/domain/roster-dps';
import {
  selectCurrentPhase,
  selectCurrentPhaseMitigationPct,
  selectRosterAccount,
  type PlannerStore,
} from '@/shared/stores';

export const HOME_RANKING_LIMIT = 9;

type RankingDeps = readonly [
  heroes: PlannerStore['heroes'],
  account: ReturnType<typeof selectRosterAccount>,
  phase: number,
  mitigationPct: number,
];

let cache: { deps: RankingDeps; rows: readonly RosterDpsRow[] } | null = null;
let computeCount = 0;

function readDeps(state: PlannerStore): RankingDeps {
  return [
    state.heroes,
    selectRosterAccount(state),
    selectCurrentPhase(state),
    selectCurrentPhaseMitigationPct(state),
  ];
}

export function selectHomeRankingRows(state: PlannerStore): readonly RosterDpsRow[] {
  const deps = readDeps(state);
  if (cache && cache.deps.every((value, index) => Object.is(value, deps[index]))) {
    return cache.rows;
  }
  const [heroes, account, phase, mitigationPct] = deps;
  computeCount += 1;
  const rows = rankRosterByDps({ heroes, account, phase, mitigationPct }, HOME_RANKING_LIMIT);
  cache = { deps, rows };
  return rows;
}

export function getHomeRankingComputeCount(): number {
  return computeCount;
}

export function resetHomeRankingCacheForTests(): void {
  cache = null;
  computeCount = 0;
}
