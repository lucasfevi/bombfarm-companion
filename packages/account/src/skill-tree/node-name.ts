import type { SkillNode } from '@bombfarm/domain/skill-tree';
import type { SkillTreeLabels } from './types';

export type SkillNodeNameLabels = Pick<SkillTreeLabels, 'kindName' | 'hubName' | 'nodeName'>;

/**
 * The name the game prints on a node, by its own ladder: a title of the node's own where one
 * exists (the notables, the titled smalls, the unlocks — translated by the host), the hub's
 * title, else the first effect's kind name, else the catalog name.
 */
export function skillNodeDisplayName(node: SkillNode, labels: SkillNodeNameLabels): string {
  const own = labels.nodeName?.(node.id);
  if (own) return own;
  if (node.tier === 'start') return labels.hubName;
  const [effect] = node.effects;
  return effect ? labels.kindName(effect.kind) : node.name;
}
