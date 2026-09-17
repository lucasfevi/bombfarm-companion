import {
  costForLevels,
  EFFECT_TOTAL_BINDINGS,
  EMPTY_SKILL_TOTALS,
  nodeStatus,
  type SkillEffect,
  type SkillEffectKind,
  type SkillNodeGain,
  type SkillNodeStatus,
  type SkillPricingObjective,
  type SkillTotals,
  type SkillTreeCatalog,
  type SkillTreeState,
} from '@bombfarm/domain/skill-tree';

export type NodeVisualState = 'lit' | 'owned' | 'maxed' | 'buyable' | 'unaffordable' | 'locked';

export function visualStateOf(status: SkillNodeStatus): NodeVisualState {
  switch (status.availability) {
    case 'lit':
      return 'lit';
    case 'maxed':
      return 'maxed';
    case 'buyable':
      if (status.owned) return 'owned';
      return status.affordable === false ? 'unaffordable' : 'buyable';
    default:
      return 'locked';
  }
}

export type EdgeTone = 'owned' | 'buyable' | 'locked';

export function edgeToneOf(state: NodeVisualState): EdgeTone {
  if (state === 'lit' || state === 'owned' || state === 'maxed') return 'owned';
  if (state === 'locked') return 'locked';
  return 'buyable';
}

export function statusMap(catalog: SkillTreeCatalog, state: SkillTreeState): ReadonlyMap<string, SkillNodeStatus> {
  return new Map(catalog.nodes.map((node) => [node.id, nodeStatus(node, state)]));
}

/** What one effect contributes at `level` — the composition its totals key uses. */
export function effectTotalAt(effect: SkillEffect, level: number): number {
  const binding = EFFECT_TOTAL_BINDINGS[effect.kind];
  if (binding.composition === 'geometric') return (1 + effect.perLevel) ** level - 1;
  return effect.perLevel * level;
}

const COUNT_KINDS: readonly SkillEffectKind[] = ['vagas_campo', 'bag_tab'];

/** Signed percent to two places, or a signed count for the slot and bag-tab kinds. */
export function formatEffectTotal(kind: SkillEffectKind, value: number): string {
  const sign = value < 0 ? '-' : '+';
  if (COUNT_KINDS.includes(kind)) return `${sign}${Math.abs(Math.round(value))}`;
  return `${sign}${(Math.abs(value) * 100).toFixed(2)}%`;
}

/** The value a totals row reads with nothing bought — the game leaves such rows out. */
export function isIdentityTotal(key: keyof SkillTotals, value: number): boolean {
  return value === EMPTY_SKILL_TOTALS[key];
}

export type TreeSummary = {
  readonly ownedLevels: number;
  readonly totalLevels: number;
  readonly goldSpent: number;
  readonly goldToMax: number;
};

export function treeSummary(catalog: SkillTreeCatalog, statuses: ReadonlyMap<string, SkillNodeStatus>): TreeSummary {
  let ownedLevels = 0;
  let totalLevels = 0;
  let goldSpent = 0;
  let goldToMax = 0;
  for (const node of catalog.nodes) {
    if (node.tier === 'start') continue;
    const level = statuses.get(node.id)?.level ?? 0;
    ownedLevels += level;
    totalLevels += node.maxLevel;
    goldSpent += costForLevels(node, 0, level);
    goldToMax += costForLevels(node, level, node.maxLevel);
  }
  return { ownedLevels, totalLevels, goldSpent, goldToMax };
}

export function objectiveDelta(gain: SkillNodeGain, objective: SkillPricingObjective): number | null {
  return objective === 'goldPerHour' ? gain.goldPerHourDelta : gain.teamDpsDelta;
}

export function objectivePerMillion(gain: SkillNodeGain, objective: SkillPricingObjective): number | null {
  return objective === 'goldPerHour' ? gain.goldPerMillion : gain.dpsPerMillion;
}
