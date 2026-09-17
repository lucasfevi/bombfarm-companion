import { describe, expect, it } from 'vitest';
import { SKILL_HUB_ID, SKILL_TREE, skillNode, type SkillNode } from '@bombfarm/domain/skill-tree';
import { skillNodeDisplayName, type SkillNodeNameLabels } from './node-name';

const TITLED = new Set([
  ...SKILL_TREE.nodes.filter((entry) => entry.tier === 'notavel' || entry.tier === 'unlock').map((entry) => entry.id),
  'P01',
  'P02',
  'P03',
  'P04',
  'P05',
  'P06',
  'P07',
]);

const labels: SkillNodeNameLabels = {
  kindName: (kind) => `kind:${kind}`,
  hubName: 'the-hub',
  nodeName: (id) => (TITLED.has(id) ? `title:${id}` : null),
};

function node(id: string): SkillNode {
  const found = skillNode(id);
  if (!found) throw new Error(`no node ${id}`);
  return found;
}

describe('skillNodeDisplayName', () => {
  it('prints the hub name for the hub', () => {
    expect(skillNodeDisplayName(node(SKILL_HUB_ID), labels)).toBe('the-hub');
  });

  it('prints the first kind’s name for a small node the game gives no title, two effects or not', () => {
    expect(skillNodeDisplayName(node('H01'), labels)).toBe('kind:team_dmg');
    expect(skillNodeDisplayName(node('H02'), labels)).toBe('kind:g_crit_chance');
    const twoKinds = SKILL_TREE.nodes.filter((entry) => entry.tier === 'small' && entry.effects.length === 2 && !TITLED.has(entry.id));
    expect(twoKinds.length).toBeGreaterThan(0);
    for (const entry of twoKinds) expect(skillNodeDisplayName(entry, labels)).toBe(`kind:${entry.effects[0].kind}`);
  });

  it('prints the host’s title for a notable, a titled small and an unlock', () => {
    expect(skillNodeDisplayName(node('D07'), labels)).toBe('title:D07');
    expect(skillNodeDisplayName(node('P01'), labels)).toBe('title:P01');
    expect(skillNodeDisplayName(node('N01'), labels)).toBe('title:N01');
    expect(skillNodeDisplayName(node('S02'), labels)).toBe('title:S02');
  });

  it('falls back to the kind name when the host has no titles at all', () => {
    const bare: SkillNodeNameLabels = { kindName: (kind) => `x:${kind}`, hubName: 'x-hub' };
    expect(skillNodeDisplayName(node('D07'), bare)).toBe('x:team_dmg');
    expect(skillNodeDisplayName(node(SKILL_HUB_ID), bare)).toBe('x-hub');
  });
});
