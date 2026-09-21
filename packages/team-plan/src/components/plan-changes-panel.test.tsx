import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { NO_AURAS_AT_CAP } from '@bombfarm/domain/team-buffs';
import { teamPlanEn, type TeamPlanScreenCopy } from '../copy';
import { sub } from '@bombfarm/hero/copy';
import { describePlanChanges, type PlanBasis } from '../core/plan-changes';
import type { TeamPlanInputs } from '../core/team-plan-inputs';
import type { TeamPlanControls } from '../core/team-plan-controls';
import { PlanChangesPanel, PlanChangesPanelBody, planChangesViewModel, wordPlanChange } from './plan-changes-panel';

const t = {
  ...teamPlanEn,
  rankLv: 'Lv',
  statShort: { attack: 'Attack', energy: 'Energy', speed: 'Speed', critChance: 'Crit', critDmg: 'Crit dmg', penetration: 'Pen', cdr: 'CDR', luck: 'Luck' },
} as unknown as TeamPlanScreenCopy;

const ZERO = { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 };

function hero(overrides: Partial<HeroRecord> & { id: string; name: string }): HeroRecord {
  return {
    updatedAt: 1,
    rarity: 'Raro',
    level: 95,
    stars: 0,
    naked: { ...ZERO, attack: 100 },
    loadout: {},
    altLoadout: null,
    gearedOverride: ZERO,
    abilities: {},
    pts: { ...ZERO, attack: 40 },
    statPointsAvailable: 0,
    deployed: false,
    battleAllowed: true,
    ...overrides,
  };
}

function item(overrides: Partial<InventoryItem> & { id: string }): InventoryItem {
  return { defId: 'autumn_boots', rarityIdx: 1, level: 50, upgrade: 12, slot: 'bota', equipped: true, equippedBy: 'minato', defResolved: true, marketBlocked: false, ...overrides };
}

function inputs(heroes: HeroRecord[], items: InventoryItem[], overrides: Partial<TeamPlanInputs> = {}): TeamPlanInputs {
  return {
    heroes,
    inventory: { version: 1, importedAt: 0, items },
    treeDanoTotal: 41, treeEnergy: 0, treeSpeed: 0, treeCritChance: 0, treeCritDmg: 0, treeLuckFlatPct: 0, treeTeamCoinPct: 0, treeXpMult: 1,
    houseIdx: 3, houseLevel: 2, phase: 91, mitigationPct: 0, slots: 5, fieldSlots: 9,
    houseCycleSecs: 300, houseCycleSecsHouseIdx: 3, houseCycleSecsLevel: 2, maxPhase: 91, farmChosenPhase: 91,
    ...overrides,
  };
}

const controls: TeamPlanControls = { scopeByHeroId: {}, forgeFloor: 12, objective: 'farm', allowedChanges: 'both', ignoreFieldCrowding: false, aurasAtCap: NO_AURAS_AT_CAP, targetPhase: null, targetPhaseChosen: false };

const rowan = hero({ id: 'rowan', name: 'Rowan' });
const minato = hero({ id: 'minato', name: 'Minato' });
const boots = item({ id: 'boots' });
const basis: PlanBasis = { inputs: inputs([rowan, minato], [boots]), controls };

const plan = {
  steps: [],
  forgeList: [{ itemId: 'boots', defId: 'autumn_boots', from: 12, to: 14 }],
  moveList: [],
  pointResets: [],
} as unknown as TeamPlan;

function render(now: TeamPlanInputs, withPlan: TeamPlan | null = plan): string {
  const ledger = describePlanChanges(basis, { inputs: now, controls }, withPlan);
  return renderToStaticMarkup(
    createElement(PlanChangesPanel, { t, lang: 'en', ledger, basis, now, onRecompute: () => {}, recomputeBlocked: false, busy: false }),
  );
}

/** The table + notice lines, rendered directly — bypasses the panel's own fold, the way a
 *  reader only sees this once they open it, so a test on row content does not also have to
 *  drive the disclosure. */
function renderBody(now: TeamPlanInputs, withPlan: TeamPlan | null = plan): string {
  const ledger = describePlanChanges(basis, { inputs: now, controls }, withPlan);
  const { heroes, items, heroNames } = planChangesViewModel(basis, now);
  return renderToStaticMarkup(createElement(PlanChangesPanelBody, { t, lang: 'en', ledger, heroes, items, heroNames }));
}

function text(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

describe('PlanChangesPanel — folded by default', () => {
  it('renders nothing at all when only field rotation moved', () => {
    const now = inputs([{ ...rowan, deployed: true }, minato], [boots]);
    expect(render(now)).toBe('');
  });

  it('shows the title, a summary count and the recompute button — nothing else', () => {
    const html = render(inputs([{ ...rowan, level: 96 }, minato], [boots]));
    expect(html).toContain('data-testid="team-plan-changes"');
    expect(html).toContain('data-counted="1"');
    expect(text(html)).toContain(t.teamPlanChangesCountOne);
    expect(html).toContain('data-testid="team-plan-changes-recompute"');
    expect(text(html)).toContain(t.teamPlanChangesRecompute);
    expect(html).not.toContain('data-testid="team-plan-changes-body"');
    expect(html).not.toContain('data-testid="team-plan-change"');
    expect(html).not.toContain('data-testid="team-plan-changes-keep"');
  });

  it('the summary line names each non-empty group and its count', () => {
    const html = render(
      inputs([{ ...rowan, level: 96 }, minato], []),
      { ...plan, forgeList: [] },
    );
    const summary = text(html);
    // Rowan levelled ("Changes the plan") and the boots left the bag used, which BREAKS the plan.
    expect(summary).toContain(sub(t.teamPlanChangesSummaryBreaks, { n: 1 }));
    expect(summary).toContain(sub(t.teamPlanChangesSummaryPlan, { n: 1 }));
  });

  it('a worn piece that has left the bag BREAKS the plan, shown by the outer tone even while folded', () => {
    const html = render(inputs([rowan, minato], []));
    expect(html).toContain('data-breaks="true"');
    expect(html).not.toContain('data-testid="team-plan-change"');
  });

  it('never renders a "keep this plan" button', () => {
    const html = render(inputs([{ ...rowan, level: 96 }, minato], [boots]));
    expect(html).not.toContain('Keep this plan');
    expect(text(html)).not.toContain('Keep this plan');
  });
});

describe('PlanChangesPanelBody — the ledger table, opened', () => {
  it('names a levelled hero with its before and after, under "Changes the plan"', () => {
    const html = renderBody(inputs([{ ...rowan, level: 96 }, minato], [boots]));
    expect(html).toMatch(/data-verdict="plan"[^>]*data-field="level"/);
    const body = text(html);
    expect(body).toContain('Rowan');
    expect(body).toContain(`${t.teamPlanChangesLevel}`);
    expect(body).toMatch(/95\s*→\s*96/);
    expect(body).toContain(t.teamPlanChangesGroupPlan);
  });

  it('a forge step the plan asked for is progress, inside the Progress group\'s own fold, closed by default', () => {
    const html = renderBody(inputs([rowan, minato], [{ ...boots, upgrade: 13 }]));
    expect(html).toMatch(/data-verdict="progress"[^>]*data-field="forge"/);
    // The row is present (its words are testable) but carries `hidden` — the group's fold starts closed.
    const rowTag = html.match(/<tr[^>]*data-verdict="progress"[^>]*data-field="forge"[^>]*>/)?.[0];
    expect(rowTag).toMatch(/\bhidden\b/);
    const body = text(html);
    expect(body).toContain(t.teamPlanChangesGroupProgress);
    expect(body).toMatch(/\+12\s*→\s*\+13/);
    expect(body).toContain('plan asked +14');
    expect(body).not.toContain(t.teamPlanChangesGroupPlan);
  });

  it('the Progress group header is a trigger carrying its own row count', () => {
    const html = renderBody(inputs([rowan, minato], [{ ...boots, upgrade: 13 }]));
    expect(html).toContain('data-testid="team-plan-changes-progress-toggle"');
    expect(html).toContain('aria-expanded="false"');
    expect(text(html)).toContain(`${t.teamPlanChangesGroupProgress} · 1`);
  });

  it('the rotation the reader may have noticed is one muted line, never a row', () => {
    const html = renderBody(inputs([{ ...rowan, level: 96, deployed: true }, { ...minato, deployed: true }], [boots]));
    expect(html).toContain('data-testid="team-plan-changes-rotation"');
    expect(text(html)).toContain('2 heroes rotated on or off the field');
    expect(html.match(/data-testid="team-plan-change"/g)).toHaveLength(1);
  });

  it('a worn piece that has left the bag BREAKS the plan: its own group first, in the down tone, named by what the plan knew of it', () => {
    const html = renderBody(inputs([rowan, minato], []));
    expect(html).toMatch(/data-verdict="breaks"[^>]*data-field="itemRemoved"/);
    const body = text(html);
    expect(body).toContain(t.teamPlanChangesGroupBreaks);
    expect(body).toContain(t.teamPlanChangesItemRemovedUsed);
    expect(body.indexOf(t.teamPlanChangesGroupBreaks)).toBeLessThan(body.indexOf(t.teamPlanChangesColWhat) + 400);
  });

  it('a new piece says what it is, not a dash and a plus-zero', () => {
    const html = renderBody(inputs([rowan, minato], [boots, item({ id: 'helm', defId: 'autumn_helm', slot: 'elmo', rarityIdx: 2, upgrade: 0, equipped: false, equippedBy: null })]));
    const body = text(html);
    expect(body).toContain(`${t.teamPlanChangesItemAdded} · Rare · Lv 50`);
    expect(body).not.toContain('—');
    expect(body).not.toContain('+0');
  });

  it('a piece the plan asked unequipped, moved as asked, reads as a move to the inventory, the hero it came off shown as a chip', () => {
    // Only a progress-verdict `equippedBy` row is ever drawn as a table row (a `plan`-verdict one
    // folds into the "also changed" line) — so this needs a plan that asked for exactly this move.
    const unequipAsked = {
      steps: [],
      forgeList: [],
      pointResets: [],
      moveList: [{ phase: 'unequip', itemId: 'boots', defId: 'autumn_boots', slot: 'bota', fromHeroId: 'minato', toHeroId: null }],
    } as unknown as TeamPlan;
    const html = renderBody(inputs([rowan, minato], [{ ...boots, equipped: false }]), unequipAsked);
    expect(html).toMatch(/data-verdict="progress"[^>]*data-field="equippedBy"/);
    const body = text(html);
    expect(body).toContain(t.teamPlanChangesMovedToInventory);
    expect(body).not.toContain(t.teamPlanChangesEquippedBy);
    expect(body).toContain('Minato');
    expect(body).toContain(t.teamPlanChangesInventory);
    expect(body).not.toContain('nobody');
  });

  it('a piece the plan asked equipped, moved as asked, reads Inventory → hero', () => {
    const ring = item({ id: 'ring', defId: 'ring_of_focus', slot: 'anel', equipped: false, equippedBy: null });
    const equipAsked = {
      steps: [],
      forgeList: [],
      pointResets: [],
      moveList: [{ phase: 'equip', itemId: 'ring', defId: 'ring_of_focus', slot: 'anel', fromHeroId: null, toHeroId: 'rowan' }],
    } as unknown as TeamPlan;
    const basisWithRing: PlanBasis = { inputs: inputs([rowan, minato], [boots, ring]), controls };
    const now = inputs([rowan, minato], [boots, { ...ring, equipped: true, equippedBy: 'rowan' }]);
    const ledger = describePlanChanges(basisWithRing, { inputs: now, controls }, equipAsked);
    const { heroes, items, heroNames } = planChangesViewModel(basisWithRing, now);
    const html = renderToStaticMarkup(createElement(PlanChangesPanelBody, { t, lang: 'en', ledger, heroes, items, heroNames }));
    expect(html).toMatch(/data-verdict="progress"[^>]*data-field="equippedBy"/);
    const body = text(html);
    expect(body).toContain(t.teamPlanChangesEquippedBy);
    expect(body).toContain(t.teamPlanChangesInventory);
    expect(body).toContain('Rowan');
    expect(body).not.toContain('nobody');
  });

  it('changes the plan cares about but does not list are said in one line, each kind once', () => {
    const html = renderBody(inputs([{ ...rowan, pts: { ...ZERO, attack: 41 }, abilities: { bomba_dupla: 1 } }, minato], [boots]), null);
    expect(html).not.toContain('data-testid="team-plan-change"');
    expect(text(html)).toContain(sub(t.teamPlanChangesAlso, { kinds: `${t.teamPlanChangesKindPoints}, ${t.teamPlanChangesKindAbilities}` }));
  });
});

describe('wordPlanChange — every kind of change has words, and none is a raw field name', () => {
  const names = new Map([['rowan', 'Rowan'], ['minato', 'Minato']]);

  it('a control change prints the option labels, not the enum values', () => {
    const ledger = describePlanChanges(basis, { inputs: basis.inputs, controls: { ...controls, objective: 'dps', allowedChanges: 'points', ignoreFieldCrowding: true } }, null);
    const words = ledger.other.map((entry) => wordPlanChange(entry, t, 'en', names));
    expect(
      words.map((w) => `${w.change}: ${w.before.kind === 'text' ? w.before.value : w.before.name} → ${w.after.kind === 'text' ? w.after.value : w.after.name}`),
    ).toEqual([
      `${t.teamPlanChangesControlObjective}: ${t.teamPlanObjectiveOptionGold} → ${t.teamPlanObjectiveOptionDamage}`,
      `${t.teamPlanChangesControlAllowedChanges}: ${t.teamPlanAllowedChangesOptionBoth} → ${t.teamPlanAllowedChangesOptionPoints}`,
      `${t.teamPlanChangesControlIgnoreFieldCrowding}: ${t.teamPlanChangesOff} → ${t.teamPlanChangesOn}`,
    ]);
  });

  it('a piece moved between heroes names both heroes as hero chips, and the inventory word when it comes off', () => {
    const moved = describePlanChanges(basis, { inputs: inputs([rowan, minato], [{ ...boots, equippedBy: 'rowan' }]), controls }, null);
    expect(wordPlanChange(moved.other[0]!, t, 'en', names)).toMatchObject({
      change: t.teamPlanChangesEquippedBy,
      before: { kind: 'hero', id: 'minato', name: 'Minato' },
      after: { kind: 'hero', id: 'rowan', name: 'Rowan' },
    });
    const off = describePlanChanges(basis, { inputs: inputs([rowan, minato], [{ ...boots, equipped: false }]), controls }, null);
    expect(wordPlanChange(off.other[0]!, t, 'en', names)).toMatchObject({
      change: t.teamPlanChangesMovedToInventory,
      before: { kind: 'hero', id: 'minato', name: 'Minato' },
      after: { kind: 'text', value: t.teamPlanChangesInventory },
    });
  });

  it('a piece equipped from the inventory keeps the "equipped by" label, Inventory before, the hero after', () => {
    const ring = item({ id: 'ring', defId: 'ring_of_focus', slot: 'anel', equipped: false, equippedBy: null });
    const before: PlanBasis = { inputs: inputs([rowan, minato], [boots, ring]), controls };
    const now = inputs([rowan, minato], [boots, { ...ring, equipped: true, equippedBy: 'rowan' }]);
    const ledger = describePlanChanges(before, { inputs: now, controls }, null);
    const ringRow = ledger.other.find((entry) => entry.detail.field === 'equippedBy')!;
    expect(wordPlanChange(ringRow, t, 'en', names)).toMatchObject({
      change: t.teamPlanChangesEquippedBy,
      before: { kind: 'text', value: t.teamPlanChangesInventory },
      after: { kind: 'hero', id: 'rowan', name: 'Rowan' },
    });
  });

  it('a "plan asked" note that names a hero splits the sentence around it, so a chip can sit inline', () => {
    const askedRowan = {
      steps: [],
      forgeList: [],
      pointResets: [],
      moveList: [{ phase: 'equip', itemId: 'boots', defId: 'autumn_boots', slot: 'bota', fromHeroId: 'minato', toHeroId: 'rowan' }],
    } as unknown as TeamPlan;
    const now = inputs([rowan, minato], [{ ...boots, equipped: false }]);
    const ledger = describePlanChanges(basis, { inputs: now, controls }, askedRowan);
    const word = wordPlanChange(ledger.other[0]!, t, 'en', names);
    expect(word.note).toMatchObject({ kind: 'askedHero', hero: { id: 'rowan', name: 'Rowan' } });
    if (word.note?.kind === 'askedHero') {
      expect(`${word.note.before}Rowan${word.note.after}`).toBe('plan asked Rowan');
    }
  });

  it('a phase the account advanced through, with no phase pinned, is named twice: the farm and the scoring phase', () => {
    const ledger = describePlanChanges(basis, { inputs: inputs([rowan, minato], [boots], { phase: 92, farmChosenPhase: null }), controls }, null);
    const words = ledger.other.map((entry) => wordPlanChange(entry, t, 'en', names).change);
    expect(words).toEqual([t.teamPlanChangesFieldPhase, t.teamPlanChangesControlTargetPhase]);
  });
});
