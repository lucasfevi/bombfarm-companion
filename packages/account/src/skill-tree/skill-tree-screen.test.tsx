import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  EMPTY_SKILL_TOTALS,
  SKILL_TOTALS_KEYS,
  SKILL_TREE,
  SKILL_TREE_LAYOUT,
  nodeStatus,
  skillNode,
  totalsFromLevels,
  type SkillNodeGain,
  type SkillTotals,
  type SkillTreePricing,
  type SkillTreeState,
} from '@bombfarm/domain/skill-tree';
import { SkillTreeScreen } from './skill-tree-screen';
import type { SkillTreeLabels, SkillTreeScreenProps } from './types';

function labelsTagged(tag: string): SkillTreeLabels {
  const totalRows = Object.fromEntries(SKILL_TOTALS_KEYS.map((key) => [key, `${tag}-row-${key}`])) as Record<
    keyof SkillTotals,
    string
  >;
  return {
    title: `${tag}-title`,
    tip: `${tag}-tip`,
    kindName: (kind) => `${tag}-kind-${kind}`,
    effectPerLevel: (kind, perLevel) => `${tag}-perLevel-${kind}-${perLevel}`,
    effectAtLevel: (kind, total) => `${tag}-atLevel-${kind}-${total}`,
    armName: (arm) => `${tag}-arm-${arm}`,
    tierName: (tier) => `${tag}-tier-${tier}`,
    level: (level, max) => `${tag}-level-${level}/${max}`,
    hubName: `${tag}-hubName`,
    hubNote: `${tag}-hubNote`,
    stateOwned: `${tag}-stateOwned`,
    stateMaxed: `${tag}-stateMaxed`,
    stateBuyable: `${tag}-stateBuyable`,
    stateUnaffordable: `${tag}-stateUnaffordable`,
    stateLockedPrerequisite: (parent, need, have) => `${tag}-lockedBy-${parent}-${need}/${have}`,
    stateLockedPhase: (phase) => `${tag}-lockedPhase-${phase}`,
    alwaysLit: `${tag}-alwaysLit`,
    nextLevelCost: `${tag}-nextLevelCost`,
    costToMax: `${tag}-costToMax`,
    refund: `${tag}-refund`,
    refundBlocked: (children) => `${tag}-refundBlocked-${children}`,
    wallet: `${tag}-wallet`,
    gold: (gold) => `${tag}-gold-${gold}`,
    goldCompact: (gold) => `${tag}-goldCompact-${gold}`,
    nextToBuy: `${tag}-nextToBuy`,
    nextToBuyTip: `${tag}-nextToBuyTip`,
    objectiveGold: `${tag}-objectiveGold`,
    objectiveDps: `${tag}-objectiveDps`,
    colNode: `${tag}-colNode`,
    colCost: `${tag}-colCost`,
    colGain: `${tag}-colGain`,
    colPerMillion: `${tag}-colPerMillion`,
    gainGold: (delta) => `${tag}-gainGold-${delta}`,
    gainDps: (delta) => `${tag}-gainDps-${delta}`,
    perMillionGold: (value) => `${tag}-perMillionGold-${value}`,
    perMillionDps: (value) => `${tag}-perMillionDps-${value}`,
    gainOutsideObjectives: `${tag}-gainOutsideObjectives`,
    nothingToRecommend: `${tag}-nothingToRecommend`,
    pricingUnavailable: `${tag}-pricingUnavailable`,
    pricedAtPhase: (phase) => `${tag}-pricedAt-${phase}`,
    dpsLeftOut: (names) => `${tag}-dpsLeftOut-${names}`,
    affordableNow: `${tag}-affordableNow`,
    selectNodeHint: `${tag}-selectNodeHint`,
    preview: `${tag}-preview`,
    previewTip: `${tag}-previewTip`,
    previewGold: `${tag}-previewGold`,
    previewDps: `${tag}-previewDps`,
    baselineGold: `${tag}-baselineGold`,
    baselineDps: `${tag}-baselineDps`,
    totalNowNext: (now, next) => `${tag}-nowNext-${now}~${next}`,
    requires: `${tag}-requires`,
    gate: `${tag}-gate`,
    arm: `${tag}-arm`,
    tier: `${tag}-tier`,
    effects: `${tag}-effects`,
    totals: `${tag}-totals`,
    totalsTip: `${tag}-totalsTip`,
    totalRows,
    formatTotal: (key, value) => `${tag}-total-${key}-${value}`,
    treeProgress: (owned, total) => `${tag}-progress-${owned}/${total}`,
    goldSpent: `${tag}-goldSpent`,
    goldToMax: `${tag}-goldToMax`,
    fitToView: `${tag}-fitToView`,
    zoomIn: `${tag}-zoomIn`,
    zoomOut: `${tag}-zoomOut`,
    legend: `${tag}-legend`,
    legendOwned: `${tag}-legendOwned`,
    legendBuyable: `${tag}-legendBuyable`,
    legendLocked: `${tag}-legendLocked`,
    legendRecommended: `${tag}-legendRecommended`,
    canvasAria: `${tag}-canvasAria`,
    nodeAria: (name, level, max) => `${tag}-nodeAria-${name}-${level}/${max}`,
  };
}

const STATE: SkillTreeState = {
  levels: { H01: 5, D01: 2 },
  refunds: {},
  gold: 1e7,
  maxPhase: 60,
  fieldSlots: null,
  bagTabs: null,
  totals: null,
};

function gain(id: string, overrides: Partial<SkillNodeGain> = {}): SkillNodeGain {
  return {
    id,
    level: 0,
    cost: 1_000_000,
    goldPerHourDelta: 100,
    goldPerHourDeltaAtRoster: 100,
    teamDpsDelta: 10,
    goldPerMillion: 100,
    dpsPerMillion: 10,
    unpriced: [],
    ...overrides,
  };
}

/** H02 is the best gold buy, H03 the best DPS buy, H04 prices neither objective above zero. */
const PRICING: SkillTreePricing = {
  phase: 60,
  baseline: { goldPerHour: 10_000, teamDps: 2_000 },
  gains: [
    gain('H04', { cost: 3000, goldPerHourDelta: 0, goldPerMillion: 0, teamDpsDelta: 0, dpsPerMillion: 0 }),
    gain('H03', { cost: 3000, goldPerHourDelta: 3, goldPerMillion: 1000, teamDpsDelta: 30, dpsPerMillion: 10_000 }),
    gain('H02', { cost: 3000, goldPerHourDelta: 30, goldPerMillion: 10_000, teamDpsDelta: 3, dpsPerMillion: 1000 }),
    gain('D01', {
      level: 2,
      cost: 29_387,
      goldPerHourDelta: 15,
      goldPerMillion: 510.4,
      teamDpsDelta: 7,
      dpsPerMillion: 238.2,
      unpriced: ['g_luck'],
    }),
  ],
  dpsLeftOut: [],
};

function render(props: Partial<SkillTreeScreenProps> = {}) {
  return renderToStaticMarkup(
    <SkillTreeScreen
      catalog={SKILL_TREE}
      layout={SKILL_TREE_LAYOUT}
      state={STATE}
      totals={totalsFromLevels(STATE)}
      pricing={PRICING}
      objective="goldPerHour"
      onObjectiveChange={() => {}}
      nodeArtSrc={(node) => `art/${node.id}.png`}
      labels={labelsTagged('aa')}
      {...props}
    />,
  );
}

function section(html: string, testId: string): string {
  const start = html.indexOf(`data-testid="${testId}"`);
  if (start < 0) throw new Error(`no ${testId}`);
  const rest = html.slice(start + 1);
  const end = rest.search(/data-testid="skill-tree-(?!hover-card|recommendation-|preview|selected-|dps-left-out|progress|wallet|priced-at)/);
  return end < 0 ? rest : rest.slice(0, end);
}

function recommendationRow(html: string, id: string): string {
  const start = html.indexOf(`data-testid="skill-tree-recommendation-${id}"`);
  if (start < 0) throw new Error(`no recommendation ${id}`);
  const rest = html.slice(start);
  return rest.slice(0, rest.indexOf('</li>'));
}

function nodeAttrs(html: string, id: string): Record<string, string> {
  const matches = [...html.matchAll(new RegExp(`<g ([^>]*data-node-id="${id}"[^>]*)>`, 'g'))];
  expect(matches, `node ${id} drawn once`).toHaveLength(1);
  const attrs: Record<string, string> = {};
  for (const [, key, value] of matches[0]?.[1]?.matchAll(/([\w-]+)="([^"]*)"/g) ?? []) {
    if (key && value !== undefined) attrs[key] = value;
  }
  return attrs;
}

function recommendationOrder(html: string): string[] {
  return [...html.matchAll(/data-testid="skill-tree-recommendation-([A-Z0-9]+)"/g)].map((match) => match[1] ?? '');
}

function rows(fragment: string): { label: string; value: string }[] {
  return [...fragment.matchAll(/<dt[^>]*>(.*?)<\/dt><dd[^>]*>(.*?)<\/dd>/g)].map((match) => ({
    label: (match[1] ?? '').replace(/<[^>]*>/g, '').trim(),
    value: (match[2] ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
  }));
}

describe('SkillTreeScreen — the canvas', () => {
  it('draws every catalog node exactly once, at its layout position, keyboard-reachable', () => {
    const html = render();
    for (const node of SKILL_TREE.nodes) {
      const attrs = nodeAttrs(html, node.id);
      const place = SKILL_TREE_LAYOUT.nodes[node.id];
      expect(attrs.transform).toBe(`translate(${place?.x} ${place?.y})`);
      expect(attrs.role).toBe('button');
      expect(attrs.tabindex).toBe('0');
    }
  });

  it('draws one edge per node with a prerequisite, and none for the hub', () => {
    const html = render();
    const edges = [...html.matchAll(/data-edge="([A-Z0-9]+)"/g)].map((match) => match[1]);
    expect(edges).toHaveLength(SKILL_TREE.nodes.length - 1);
    expect(edges).not.toContain('H00');
  });

  it('marks owned, buyable, locked and lit nodes from the state', () => {
    const html = render();
    expect(nodeAttrs(html, 'H00')['data-state']).toBe('lit');
    expect(nodeAttrs(html, 'H01')['data-state']).toBe('owned');
    expect(nodeAttrs(html, 'D01')['data-state']).toBe('owned');
    expect(nodeAttrs(html, 'H02')['data-state']).toBe('buyable');
    expect(nodeAttrs(html, 'D02')['data-state']).toBe('locked');
    expect(nodeAttrs(html, 'S05')['data-state']).toBe('locked');
    expect(nodeAttrs(html, 'D02').class).toContain('grayscale');
    expect(nodeAttrs(html, 'H01').class).not.toContain('grayscale');
  });

  it('agrees with the domain about every node, not just the hand-picked ones', () => {
    const html = render();
    for (const node of SKILL_TREE.nodes) {
      const status = nodeStatus(node, STATE);
      const drawn = nodeAttrs(html, node.id)['data-state'];
      if (status.availability === 'lit') expect(drawn).toBe('lit');
      else if (status.availability === 'buyable') expect(['owned', 'buyable', 'unaffordable']).toContain(drawn);
      else if (status.availability === 'maxed') expect(drawn).toBe('maxed');
      else expect(drawn).toBe('locked');
    }
  });

  it('shows an unaffordable ring when the wallet is short', () => {
    const html = render({ state: { ...STATE, gold: 10 } });
    expect(nodeAttrs(html, 'H02')['data-state']).toBe('unaffordable');
  });

  it('names every node for assistive tech from the label bag', () => {
    const labels = labelsTagged('aa');
    const html = render();
    expect(nodeAttrs(html, 'H01')['aria-label']).toBe(labels.nodeAria(labels.kindName('team_dmg'), 5, 10));
    expect(nodeAttrs(html, 'H00')['aria-label']).toBe(labels.nodeAria(labels.hubName, 1, 1));
    expect(html).toContain(`aria-label="${labels.canvasAria}"`);
  });

  it('marks the recommended node for the objective in force, and the selected one', () => {
    expect(nodeAttrs(render(), 'H02')['data-recommended']).toBe('true');
    expect(nodeAttrs(render(), 'H03')['data-recommended']).toBeUndefined();
    expect(nodeAttrs(render({ objective: 'teamDps' }), 'H03')['data-recommended']).toBe('true');
    expect(nodeAttrs(render({ selectedId: 'D01' }), 'D01')['aria-pressed']).toBe('true');
    expect(nodeAttrs(render({ selectedId: 'D01' }), 'H01')['aria-pressed']).toBe('false');
  });

  it('draws the medallion from the host art, clipped to a circle, and the level badge on an owned node', () => {
    const html = render();
    expect(html).toMatch(/<image href="art\/H01.png"[^>]*clip-path="url\(#[^)]*clip-30_6\)"/);
    expect(section(html, 'skill-tree-nodes')).toContain('>5/10<');
  });

  it('draws a plain circle when the host has no art for a node', () => {
    const html = render({ nodeArtSrc: () => null });
    expect(html).not.toContain('<image');
    expect(nodeAttrs(html, 'H01')).toBeDefined();
  });

  it('starts fitted to the whole tree and offers the three view controls and the legend', () => {
    const labels = labelsTagged('aa');
    const html = render();
    expect(html).toMatch(/viewBox="-\d+(\.\d+)? -\d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)?"/);
    for (const text of [labels.fitToView, labels.zoomIn, labels.zoomOut, labels.legendOwned, labels.legendBuyable, labels.legendLocked, labels.legendRecommended]) {
      expect(html).toContain(`>${text}<`);
    }
    expect(html).toContain(`aria-label="${labels.legend}"`);
  });

  it('never uses the native title attribute or an SVG title for a node', () => {
    const html = render({ selectedId: 'H01' });
    expect(html).not.toMatch(/ title="/);
    expect(html).not.toContain('<title');
  });
});

describe('SkillTreeScreen — next to buy', () => {
  it('ranks by gold per million under the gold objective and drops nodes with no gain', () => {
    expect(recommendationOrder(render())).toEqual(['H02', 'H03', 'D01']);
  });

  it('ranks by DPS per million under the DPS objective', () => {
    expect(recommendationOrder(render({ objective: 'teamDps' }))).toEqual(['H03', 'H02', 'D01']);
  });

  it('caps the list at recommendationCount', () => {
    expect(recommendationOrder(render({ recommendationCount: 2 }))).toEqual(['H02', 'H03']);
  });

  it('prints each row from the bag: level step, compact cost, signed gain, per million, and the affordable chip', () => {
    const labels = labelsTagged('aa');
    const html = recommendationRow(render(), 'D01');
    expect(html).toContain(labels.totalNowNext('2', '3'));
    expect(html).toContain(labels.goldCompact(29_387));
    expect(html).toContain(labels.gainGold(15));
    expect(html).toContain(labels.perMillionGold(510.4));
    expect(html).toContain(labels.affordableNow);
    expect(html).toContain('<img alt="" src="art/D01.png"');
  });

  it('leaves the chip off a row the wallet cannot cover', () => {
    const labels = labelsTagged('aa');
    expect(recommendationRow(render({ state: { ...STATE, gold: 10 } }), 'H02')).not.toContain(labels.affordableNow);
  });

  it('switches the gain unit with the objective', () => {
    const labels = labelsTagged('aa');
    const html = recommendationRow(render({ objective: 'teamDps' }), 'H03');
    expect(html).toContain(labels.gainDps(30));
    expect(html).toContain(labels.perMillionDps(10_000));
    expect(html).not.toContain(labels.gainGold(3));
  });

  it('says so when there is no pricing, and when nothing gains', () => {
    const labels = labelsTagged('aa');
    expect(render({ pricing: null })).toContain(labels.pricingUnavailable);
    expect(render({ pricing: { ...PRICING, gains: [] } })).toContain(labels.nothingToRecommend);
    expect(render({ pricing: { ...PRICING, gains: [gain('H02', { goldPerHourDelta: 0, goldPerMillion: 0 })] } })).toContain(
      labels.nothingToRecommend,
    );
  });

  it('names the heroes the DPS figure left out', () => {
    const labels = labelsTagged('aa');
    expect(render({ pricing: { ...PRICING, dpsLeftOut: ['Ana', 'Bo'] } })).toContain(labels.dpsLeftOut('Ana, Bo'));
    expect(render()).not.toContain('aa-dpsLeftOut');
  });

  it('prints the wallet, the priced phase and both objective options in the header', () => {
    const labels = labelsTagged('aa');
    const html = section(render(), 'skill-tree-header');
    expect(html).toContain(labels.gold(1e7));
    expect(html).toContain(labels.pricedAtPhase(60));
    expect(html).toContain(`aria-pressed="true"`);
    expect(html).toContain(labels.objectiveGold);
    expect(html).toContain(labels.objectiveDps);
  });
});

describe('SkillTreeScreen — the selected node', () => {
  it('asks for a selection when there is none', () => {
    expect(render()).toContain(labelsTagged('aa').selectNodeHint);
  });

  it('prints the facts of an owned node: level, state, effects now → next, next cost, cost to max, refund', () => {
    const labels = labelsTagged('aa');
    const html = section(render({ selectedId: 'D01' }), 'skill-tree-selected');
    const node = skillNode('D01');
    if (!node) throw new Error('no D01');
    expect(html).toContain(labels.level(2, 10));
    expect(html).toContain(labels.stateOwned);
    expect(html).toContain(`${labels.armName('dano')} · ${labels.tierName('small')}`);
    const facts = rows(html);
    const perLevel = node.effects[0]?.perLevel ?? 0;
    expect(facts).toContainEqual({
      label: labels.effectPerLevel('team_dmg', perLevel),
      value: labels.totalNowNext(`+${(perLevel * 200).toFixed(2)}%`, `+${(perLevel * 300).toFixed(2)}%`),
    });
    expect(facts).toContainEqual({ label: labels.nextLevelCost, value: labels.gold(node.costs[2] ?? 0) });
    expect(facts).toContainEqual({
      label: labels.costToMax,
      value: labels.gold(node.costs.slice(2).reduce((sum, cost) => sum + cost, 0)),
    });
    expect(facts).toContainEqual({ label: labels.refund, value: labels.gold(node.refunds[1] ?? 0) });
    expect(facts).toContainEqual({ label: labels.requires, value: labels.kindName('team_dmg') });
  });

  it('previews the objectives with the node bought: baseline, with-node, signed delta, per million', () => {
    const labels = labelsTagged('aa');
    const html = section(render({ selectedId: 'D01' }), 'skill-tree-preview');
    const facts = rows(html);
    expect(facts).toContainEqual({ label: labels.baselineGold, value: labels.goldCompact(10_000) });
    expect(facts).toContainEqual({ label: labels.previewGold, value: `${labels.goldCompact(10_015)} ${labels.gainGold(15)}` });
    expect(facts).toContainEqual({ label: labels.colPerMillion, value: labels.perMillionGold(510.4) });
    expect(facts).toContainEqual({ label: labels.baselineDps, value: '2000' });
    expect(facts).toContainEqual({ label: labels.previewDps, value: `2007 ${labels.gainDps(7)}` });
    expect(html).toContain(labels.gainOutsideObjectives);
  });

  it('uses the host rate formatters when the bag carries them', () => {
    const labels: SkillTreeLabels = { ...labelsTagged('aa'), goldPerHour: (value) => `rate-${value}`, teamDps: (value) => `dps-${value}` };
    const facts = rows(section(render({ selectedId: 'D01', labels }), 'skill-tree-preview'));
    expect(facts).toContainEqual({ label: labels.baselineGold, value: 'rate-10000' });
    expect(facts).toContainEqual({ label: labels.baselineDps, value: 'dps-2000' });
  });

  it('skips the DPS rows when the roster has no DPS figure', () => {
    const labels = labelsTagged('aa');
    const pricing: SkillTreePricing = {
      ...PRICING,
      baseline: { goldPerHour: 10_000, teamDps: null },
      gains: PRICING.gains.map((entry) => ({ ...entry, teamDpsDelta: null, dpsPerMillion: null })),
    };
    const html = section(render({ selectedId: 'D01', pricing }), 'skill-tree-preview');
    expect(html).toContain(labels.previewGold);
    expect(html).not.toContain(labels.previewDps);
  });

  it('keeps the facts but drops the preview for a locked node, and says what locks it', () => {
    const labels = labelsTagged('aa');
    const html = render({ selectedId: 'D02' });
    expect(html).not.toContain('data-testid="skill-tree-preview"');
    expect(section(html, 'skill-tree-selected')).toContain(labels.stateLockedPrerequisite(labels.kindName('team_dmg'), 5, 2));
    expect(section(render({ selectedId: 'S05' }), 'skill-tree-selected')).toContain(labels.stateLockedPhase(150));
  });

  it('describes the hub as always lit, with its note and name', () => {
    const labels = labelsTagged('aa');
    const html = section(render({ selectedId: 'H00' }), 'skill-tree-selected');
    expect(html).toContain(labels.alwaysLit);
    expect(html).toContain(labels.hubNote);
    expect(html).toContain(labels.hubName);
    expect(html).not.toContain(labels.costToMax);
  });

  it('names the children that block a refund', () => {
    const labels = labelsTagged('aa');
    const html = section(render({ selectedId: 'H01' }), 'skill-tree-selected');
    expect(html).toContain(labels.refundBlocked(labels.kindName('team_dmg')));
  });

  it('calls stateUnaffordable when the wallet cannot cover the next level', () => {
    const labels = labelsTagged('aa');
    expect(section(render({ selectedId: 'H02', state: { ...STATE, gold: 10 } }), 'skill-tree-selected')).toContain(labels.stateUnaffordable);
  });
});

describe('SkillTreeScreen — the totals', () => {
  it('lists only the rows the levels moved, like the game does', () => {
    const labels = labelsTagged('aa');
    const totals = totalsFromLevels(STATE);
    const html = section(render(), 'skill-tree-totals');
    expect(rows(html).map((row) => row.label)).toEqual([
      labels.totalRows.team_dmg_add,
      labels.totalRows.dmg_static,
      labels.goldSpent,
      labels.goldToMax,
    ]);
    expect(html).toContain(labels.formatTotal('team_dmg_add', totals.team_dmg_add));
    expect(html).not.toContain(labels.totalRows.xp_mult);
    expect(html).not.toContain(labels.totalRows.vagas_campo);
  });

  it('lists nothing but the progress lines for an empty tree', () => {
    const labels = labelsTagged('aa');
    const empty: SkillTreeState = { ...STATE, levels: {} };
    const html = section(render({ state: empty, totals: EMPTY_SKILL_TOTALS, pricing: null }), 'skill-tree-totals');
    expect(rows(html).map((row) => row.label)).toEqual([labels.goldSpent, labels.goldToMax]);
    expect(html).toContain(labels.treeProgress(0, 1095));
    expect(html).toContain(labels.gold(0));
  });

  it('sums the owned levels, the gold they cost and the gold the rest would', () => {
    const labels = labelsTagged('aa');
    const h01 = skillNode('H01');
    const d01 = skillNode('D01');
    if (!h01 || !d01) throw new Error('missing nodes');
    const spent = h01.costs.slice(0, 5).reduce((sum, cost) => sum + cost, 0) + d01.costs.slice(0, 2).reduce((sum, cost) => sum + cost, 0);
    const everything = SKILL_TREE.nodes
      .filter((node) => node.tier !== 'start')
      .reduce((sum, node) => sum + node.costs.reduce((inner, cost) => inner + cost, 0), 0);
    const html = section(render(), 'skill-tree-totals');
    expect(html).toContain(labels.treeProgress(7, 1095));
    expect(html).toContain(labels.gold(spent));
    expect(html).toContain(labels.gold(everything - spent));
  });
});

describe('SkillTreeScreen — where its words come from', () => {
  it('changes every word when a differently worded bag is supplied', () => {
    const html = render({ labels: labelsTagged('bb'), selectedId: 'D01' });
    expect(html).not.toContain('aa-');
    expect(html).toContain('bb-title');
  });

  it('hands the objective toggle straight to the host', () => {
    const onObjectiveChange = vi.fn();
    expect(render({ onObjectiveChange })).toContain('aria-pressed="true"');
    expect(onObjectiveChange).not.toHaveBeenCalled();
  });
});
