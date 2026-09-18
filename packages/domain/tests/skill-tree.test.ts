import { describe, expect, it } from 'vitest';
import {
  EFFECT_TOTAL_BINDINGS,
  SKILL_ARMS,
  SKILL_EFFECT_KINDS,
  SKILL_HUB_ID,
  SKILL_TIERS,
  SKILL_TOTALS_KEYS,
  SKILL_TREE,
  SKILL_TREE_LAYOUT,
  SKILL_TREE_UNLOCK_LEVELS,
  costForLevels,
  fieldSlotsFromTotals,
  nodeStatus,
  parseSkillTreeState,
  skillChildren,
  skillNode,
  totalsFromLevels,
  totalsWithNode,
  type SkillTreeState,
} from '@bombfarm/domain/skill-tree';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';
import { FARM_OPTIMIZE_FIXTURE, FARM_POINT_RANK_FIXTURE } from './helpers/farm-rate-fixtures';

function skillsOf(filename: string): SkillTreeState {
  const raw = loadFixtureJson(filename, 'sheet-math') as { skills: unknown };
  const state = parseSkillTreeState(raw.skills);
  if (!state) throw new Error(`${filename} carries no skills block`);
  return state;
}

const emptyState: SkillTreeState = {
  levels: {},
  refunds: {},
  gold: null,
  maxPhase: null,
  fieldSlots: null,
  bagTabs: null,
  totals: null,
};

describe('the bundled catalog', () => {
  it('is the v8 tree: 132 nodes, one prerequisite each but the hub, costs per level', () => {
    expect(SKILL_TREE.version).toBe(8);
    expect(SKILL_TREE.nodes).toHaveLength(SKILL_TREE.total);
    expect(SKILL_TREE.total).toBe(132);
    for (const node of SKILL_TREE.nodes) {
      expect(node.requires.length, node.id).toBe(node.id === SKILL_HUB_ID ? 0 : 1);
      for (const parent of node.requires) expect(skillNode(parent), `${node.id} requires ${parent}`).toBeDefined();
      expect(node.costs, node.id).toHaveLength(node.maxLevel);
      expect(node.refunds, node.id).toHaveLength(node.maxLevel);
      expect(SKILL_ARMS).toContain(node.arm);
      expect(SKILL_TIERS).toContain(node.tier);
      for (const effect of node.effects) expect(SKILL_EFFECT_KINDS).toContain(effect.kind);
    }
  });

  it('refunds half of each level, floored, and grows every cost', () => {
    for (const node of SKILL_TREE.nodes) {
      node.costs.forEach((cost, index) => {
        expect(node.refunds[index], `${node.id} level ${index + 1}`).toBe(Math.floor(cost / 2));
        if (index > 0) expect(cost).toBeGreaterThan(node.costs[index - 1]!);
      });
    }
  });

  it('places every node, and only catalog nodes, on the layout with the hub at the origin', () => {
    const ids = new Set(SKILL_TREE.nodes.map((node) => node.id));
    expect(new Set(Object.keys(SKILL_TREE_LAYOUT.nodes))).toEqual(ids);
    expect(SKILL_TREE_LAYOUT.nodes[SKILL_HUB_ID]).toMatchObject({ x: 0, y: 0 });
    for (const id of skillChildren(SKILL_HUB_ID)) {
      const { x, y } = SKILL_TREE_LAYOUT.nodes[id]!;
      expect(Math.hypot(x, y)).toBeCloseTo(SKILL_TREE_LAYOUT.hubRadius, 1);
    }
  });

  it('gates exactly four nodes on a phase', () => {
    const gated = SKILL_TREE.nodes.filter((node) => node.gatePhase > 0).map((node) => [node.id, node.gatePhase]);
    expect(gated.sort()).toEqual([
      ['O10', 80],
      ['S02', 50],
      ['S05', 150],
      ['S07', 51],
    ]);
  });
});

describe('totals rebuilt from the owned levels', () => {
  it.each([FARM_POINT_RANK_FIXTURE, FARM_OPTIMIZE_FIXTURE])('reproduce the server totals on %s', (filename) => {
    const state = skillsOf(filename);
    const rebuilt = totalsFromLevels(state);
    for (const key of SKILL_TOTALS_KEYS) {
      expect(rebuilt[key], key).toBeCloseTo(state.totals![key], 9);
    }
    expect(fieldSlotsFromTotals(rebuilt)).toBe(state.fieldSlots);
  });

  it('count the hub as lit: an empty tree already carries its +5% squad damage', () => {
    const rebuilt = totalsFromLevels(emptyState);
    expect(rebuilt.team_dmg_add).toBeCloseTo(0.05, 12);
    expect(rebuilt.dmg_static).toBeCloseTo(1.05, 12);
    expect(rebuilt.geo_mult).toBe(1);
    expect(rebuilt.xp_mult).toBe(1);
  });

  it('compound the geometric kind and keep dmg_static the product of its two factors', () => {
    const geo = SKILL_TREE.nodes.find((node) => node.effects.some((effect) => effect.kind === 'team_geo'))!;
    const perLevel = geo.effects.find((effect) => effect.kind === 'team_geo')!.perLevel;
    const base = totalsFromLevels(emptyState);
    const withThree = totalsWithNode(base, geo, 3);
    expect(withThree.geo_mult).toBeCloseTo((1 + perLevel) ** 3, 12);
    expect(withThree.dmg_static).toBeCloseTo((1 + withThree.team_dmg_add) * withThree.geo_mult, 12);
    expect(EFFECT_TOTAL_BINDINGS.team_geo.composition).toBe('geometric');
    expect(EFFECT_TOTAL_BINDINGS.team_xp.base).toBe(1);
  });
});

describe('nodeStatus', () => {
  const hubChild = skillNode('H01')!;
  const secondRing = skillNode(skillChildren('H01')[0]!)!;

  it('opens the hub ring from the start and locks the next ring behind five levels', () => {
    expect(nodeStatus(hubChild, emptyState).availability).toBe('buyable');
    const locked = nodeStatus(secondRing, emptyState);
    expect(locked.availability).toBe('lockedPrerequisite');
    expect(locked.missing).toEqual([{ id: 'H01', have: 0, need: SKILL_TREE_UNLOCK_LEVELS }]);
    const opened = nodeStatus(secondRing, { ...emptyState, levels: { H01: 5 } });
    expect(opened.availability).toBe('buyable');
    expect(nodeStatus(secondRing, { ...emptyState, levels: { H01: 4 } }).availability).toBe('lockedPrerequisite');
  });

  it('opens a one-level unlock’s neighbour at one level', () => {
    const n02 = skillNode('N02')!;
    expect(nodeStatus(n02, emptyState).missing).toEqual([{ id: 'N01', have: 0, need: 1 }]);
    expect(nodeStatus(n02, { ...emptyState, levels: { N01: 1 } }).availability).toBe('buyable');
  });

  it('prices the next level, reads affordability off the wallet, and stops at max', () => {
    const state = { ...emptyState, levels: { H01: 3 }, gold: hubChild.costs[3]! };
    const status = nodeStatus(hubChild, state);
    expect(status.level).toBe(3);
    expect(status.nextCost).toBe(hubChild.costs[3]);
    expect(status.affordable).toBe(true);
    expect(nodeStatus(hubChild, { ...state, gold: hubChild.costs[3]! - 1 }).affordable).toBe(false);
    expect(nodeStatus(hubChild, { ...emptyState, levels: { H01: 10 } })).toMatchObject({
      availability: 'maxed',
      nextCost: null,
      affordable: null,
    });
    expect(costForLevels(hubChild, 3, 10)).toBe(hubChild.costs.slice(3).reduce((a, b) => a + b, 0));
  });

  it('keeps an owned node open even when its neighbour is later undone', () => {
    const state = { ...emptyState, levels: { H01: 2, [secondRing.id]: 1 } };
    expect(nodeStatus(secondRing, state).availability).toBe('buyable');
  });

  it('locks a gated node until the account has reached the phase', () => {
    const s02 = skillNode('S02')!;
    const reachable = { ...emptyState, levels: { S01: 5, S03: 5 } };
    expect(nodeStatus(s02, { ...reachable, maxPhase: 49 }).availability).toBe('lockedPhase');
    expect(nodeStatus(s02, { ...reachable, maxPhase: 50 }).availability).toBe('buyable');
  });

  it('refunds the top level from the server figure and blocks while a child is owned', () => {
    const refunds = { H01: 4321 };
    const state = { ...emptyState, levels: { H01: 6, [secondRing.id]: 1 }, refunds };
    const status = nodeStatus(hubChild, state);
    expect(status.refund).toBe(4321);
    expect(status.refundBlockedBy).toEqual([secondRing.id]);
    const alone = nodeStatus(hubChild, { ...emptyState, levels: { H01: 6 } });
    expect(alone.refund).toBe(hubChild.refunds[5]);
    expect(alone.refundBlockedBy).toEqual([]);
    expect(nodeStatus(skillNode(SKILL_HUB_ID)!, emptyState)).toMatchObject({ availability: 'lit', refund: null, level: 1 });
  });
});

describe('parseSkillTreeState', () => {
  it('reads the wire body: string gold and refunds, numeric levels', () => {
    const state = parseSkillTreeState({
      levels: { H01: 3 },
      refunds: { H01: '2194' },
      gold: '50558',
      max_phase: 33,
      field_slots: 2,
      bag_tabs: 2,
      totals: skillsOf(FARM_OPTIMIZE_FIXTURE).totals,
    });
    expect(state).toMatchObject({ levels: { H01: 3 }, refunds: { H01: 2194 }, gold: 50558, maxPhase: 33, fieldSlots: 2 });
    expect(state?.totals?.vagas_campo).toBe(8);
  });

  it('refuses a body without levels', () => {
    expect(parseSkillTreeState({ totals: {} })).toBeNull();
    expect(parseSkillTreeState(undefined)).toBeNull();
  });
});
