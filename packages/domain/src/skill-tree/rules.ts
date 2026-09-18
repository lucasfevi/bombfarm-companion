import { SKILL_HUB_ID, skillChildren, skillNode, type SkillNode } from './catalog';
import type { SkillTreeState } from './state';

/**
 * Levels a prerequisite must hold before its neighbours open — the game client's own constant,
 * capped at the prerequisite's `maxLevel` so a one-level unlock opens the next node at one.
 */
export const SKILL_TREE_UNLOCK_LEVELS = 5;

/** The hub is lit from the start: its level reads 1 while `levels` never lists it. */
export function isAlwaysLit(node: SkillNode): boolean {
  return node.tier === 'start';
}

export function ownedLevel(state: SkillTreeState, id: string): number {
  return Math.max(0, Math.floor(state.levels[id] ?? 0));
}

export function effectiveLevel(node: SkillNode, state: SkillTreeState): number {
  if (isAlwaysLit(node)) return node.maxLevel;
  return Math.min(node.maxLevel, ownedLevel(state, node.id));
}

export function unlockLevel(node: SkillNode): number {
  if (isAlwaysLit(node)) return 0;
  return Math.min(SKILL_TREE_UNLOCK_LEVELS, node.maxLevel);
}

export type MissingPrerequisite = {
  readonly id: string;
  readonly have: number;
  readonly need: number;
};

/** The prerequisites not yet held at their unlock level — empty when the node is reachable. */
export function missingPrerequisites(node: SkillNode, state: SkillTreeState): MissingPrerequisite[] {
  const missing: MissingPrerequisite[] = [];
  for (const id of node.requires) {
    const parent = skillNode(id);
    const need = parent ? unlockLevel(parent) : 1;
    const have = parent ? effectiveLevel(parent, state) : 0;
    if (have < need) missing.push({ id, have, need });
  }
  return missing;
}

export function isPhaseLocked(node: SkillNode, state: SkillTreeState): boolean {
  return node.gatePhase > 0 && node.gatePhase > (state.maxPhase ?? 0);
}

export type SkillNodeAvailability =
  | 'lit'
  | 'maxed'
  | 'buyable'
  | 'lockedPrerequisite'
  | 'lockedPhase';

export type SkillNodeStatus = {
  readonly id: string;
  readonly level: number;
  readonly maxLevel: number;
  readonly owned: boolean;
  readonly availability: SkillNodeAvailability;
  /** Gold for the next level, `null` when there is none. */
  readonly nextCost: number | null;
  /** `null` when the wallet is unknown or there is nothing to buy. */
  readonly affordable: boolean | null;
  readonly missing: readonly MissingPrerequisite[];
  /** Gold for undoing the top level, `null` when the node holds none. */
  readonly refund: number | null;
  /** Owned children that must be undone first — the game unwinds leaves to centre. */
  readonly refundBlockedBy: readonly string[];
};

export function nextLevelCost(node: SkillNode, level: number): number | null {
  if (level < 0 || level >= node.maxLevel) return null;
  return node.costs[level] ?? null;
}

export function costForLevels(node: SkillNode, from: number, to: number): number {
  let total = 0;
  for (let level = Math.max(0, from); level < Math.min(to, node.maxLevel); level++) {
    total += node.costs[level] ?? 0;
  }
  return total;
}

export function refundBlockers(node: SkillNode, state: SkillTreeState): string[] {
  return skillChildren(node.id).filter((id) => ownedLevel(state, id) >= 1);
}

function availabilityOf(node: SkillNode, level: number, state: SkillTreeState): SkillNodeAvailability {
  if (isAlwaysLit(node)) return 'lit';
  if (level >= node.maxLevel) return 'maxed';
  if (isPhaseLocked(node, state)) return 'lockedPhase';
  // An owned node never re-checks its neighbours: further levels stay open once the first was bought.
  if (level >= 1 || missingPrerequisites(node, state).length === 0) return 'buyable';
  return 'lockedPrerequisite';
}

export function nodeStatus(node: SkillNode, state: SkillTreeState): SkillNodeStatus {
  const level = effectiveLevel(node, state);
  const availability = availabilityOf(node, level, state);
  const nextCost = availability === 'buyable' ? nextLevelCost(node, level) : null;
  const refund =
    node.id !== SKILL_HUB_ID && level >= 1
      ? (state.refunds[node.id] ?? node.refunds[level - 1] ?? null)
      : null;
  return {
    id: node.id,
    level,
    maxLevel: node.maxLevel,
    owned: level >= 1,
    availability,
    nextCost,
    affordable: nextCost === null || state.gold === null ? null : state.gold >= nextCost,
    missing: availability === 'lockedPrerequisite' ? missingPrerequisites(node, state) : [],
    refund,
    refundBlockedBy: refund === null ? [] : refundBlockers(node, state),
  };
}

export function isBuyable(status: SkillNodeStatus): boolean {
  return status.availability === 'buyable';
}
