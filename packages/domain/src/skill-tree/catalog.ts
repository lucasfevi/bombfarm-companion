import catalogJson from '../data/skill-tree.json' with { type: 'json' };
import layoutJson from '../data/skill-tree-layout.json' with { type: 'json' };

export const SKILL_EFFECT_KINDS = [
  'team_dmg',
  'team_geo',
  'g_crit_chance',
  'g_crit_dmg',
  'g_speed',
  'team_energia',
  'team_coin',
  'g_luck',
  'team_xp',
  'vagas_campo',
  'bag_tab',
] as const;
export type SkillEffectKind = (typeof SKILL_EFFECT_KINDS)[number];

export const SKILL_ARMS = [
  'hub',
  'dano',
  'crit',
  'velocidade',
  'ouro',
  'drop',
  'energia',
  'geo',
  'neutro',
] as const;
export type SkillArm = (typeof SKILL_ARMS)[number];

export const SKILL_TIERS = ['start', 'small', 'notavel', 'unlock'] as const;
export type SkillTier = (typeof SKILL_TIERS)[number];

export type SkillEffect = {
  readonly kind: SkillEffectKind;
  readonly perLevel: number;
};

export type SkillNode = {
  readonly id: string;
  /** The game's own (pt-BR) name. Small nodes are named after their kind; notables carry a title. */
  readonly name: string;
  readonly arm: SkillArm;
  readonly tier: SkillTier;
  readonly ring: number;
  readonly maxLevel: number;
  readonly effects: readonly SkillEffect[];
  /** Gold per level, index 0 = the first level. Length is `maxLevel`. */
  readonly costs: readonly number[];
  /** Gold returned for undoing that level — half its cost, floored. */
  readonly refunds: readonly number[];
  /** Highest phase reached before the node can be bought; 0 = no gate. */
  readonly gatePhase: number;
  /** Prerequisite ids — one for every node but the hub. */
  readonly requires: readonly string[];
  readonly note?: string;
};

export type SkillTreeCatalog = {
  readonly version: number;
  readonly total: number;
  readonly fieldBaseSlots: number;
  readonly fieldSize: number;
  readonly nodes: readonly SkillNode[];
};

export type SkillNodeLayout = {
  /** Game-screen pixels from the hub, y down. */
  readonly x: number;
  readonly y: number;
  readonly diameter: number;
};

export type SkillTreeLayout = {
  readonly hubRadius: number;
  readonly nodes: Readonly<Record<string, SkillNodeLayout>>;
};

export const SKILL_TREE: SkillTreeCatalog = catalogJson as SkillTreeCatalog;
export const SKILL_TREE_LAYOUT: SkillTreeLayout = layoutJson;

export const SKILL_HUB_ID = 'H00';

export const SKILL_NODE_BY_ID: ReadonlyMap<string, SkillNode> = new Map(
  SKILL_TREE.nodes.map((node) => [node.id, node]),
);

export function skillNode(id: string): SkillNode | undefined {
  return SKILL_NODE_BY_ID.get(id);
}

function childrenByParent(nodes: readonly SkillNode[]): ReadonlyMap<string, readonly string[]> {
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    for (const parent of node.requires) {
      const list = children.get(parent) ?? [];
      list.push(node.id);
      children.set(parent, list);
    }
  }
  return children;
}

export const SKILL_CHILDREN_BY_ID = childrenByParent(SKILL_TREE.nodes);

export function skillChildren(id: string): readonly string[] {
  return SKILL_CHILDREN_BY_ID.get(id) ?? [];
}

export function skillNodeLayout(id: string): SkillNodeLayout | undefined {
  return SKILL_TREE_LAYOUT.nodes[id];
}
