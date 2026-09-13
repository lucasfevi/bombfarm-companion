import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { InventorySnapshot } from '@bombfarm/domain/inventory';

export type TeamPlanInputs = {
  heroes: readonly HeroRecord[];
  inventory: InventorySnapshot;
  treeDanoTotal: number;
  treeEnergy: number;
  treeSpeed: number;
  treeCritChance: number;
  treeCritDmg: number;
  treeLuckFlatPct: number;
  treeTeamCoinPct: number;
  treeXpMult: number;
  houseIdx: number;
  houseLevel: number;
  phase: number | null;
  mitigationPct: number;
  /** HOUSE recovery slots — not the field concurrency cap. */
  slots: number;
  /** FIELD slots. `null` falls back to {@link slots}, as today. */
  fieldSlots: number | null;
  houseCycleSecs: number | null;
  houseCycleSecsHouseIdx: number | null;
  houseCycleSecsLevel: number | null;
  maxPhase: number | null;
  /** Already resolved by the host: the farm screen's phase when the player chose one there, else
   *  null. Web: `phasesViewPhaseChosen ? phasesViewPhase : null`. Desktop: the Farm view
   *  storage's `selectedPhase`. Resolved here because the "chosen" flag is each host's own. */
  farmChosenPhase: number | null;
};
