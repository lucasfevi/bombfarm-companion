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

/** The table, rendered directly — bypasses the panel's own fold, the way a reader only sees this
 *  once they open it, so a test on row content does not also have to drive the disclosure. */
function renderBody(now: TeamPlanInputs, withPlan: TeamPlan | null = plan): string {
  const ledger = describePlanChanges(basis, { inputs: now, controls }, withPlan);
  const { heroes, items, heroNames } = planChangesViewModel(basis, now);
  return renderToStaticMarkup(createElement(PlanChangesPanelBody, { t, lang: 'en', ledger, heroes, items, heroNames }));
}

function text(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

describe('PlanChangesPanel — folded by default, and only ever drawn for a breaking change', () => {
  it('renders nothing at all when only field rotation moved', () => {
    const now = inputs([{ ...rowan, deployed: true }, minato], [boots]);
    expect(render(now)).toBe('');
  });

  it('renders nothing at all when the only change is one the plan merely cares about', () => {
    const now = inputs([{ ...rowan, level: 96 }, minato], [boots]);
    expect(render(now)).toBe('');
  });

  it('shows the title, a summary count and the recompute button — nothing else', () => {
    const html = render(inputs([rowan, minato], []));
    expect(html).toContain('data-testid="team-plan-changes"');
    expect(html).toContain('data-counted="1"');
    expect(text(html)).toContain(t.teamPlanChangesCountOne);
    expect(html).toContain('data-testid="team-plan-changes-recompute"');
    expect(text(html)).toContain(t.teamPlanChangesRecompute);
    expect(html).not.toContain('data-testid="team-plan-changes-body"');
    expect(html).not.toContain('data-testid="team-plan-change"');
    expect(html).not.toContain('data-testid="team-plan-changes-keep"');
  });

  it('the summary line counts every breaking change, plural', () => {
    const scopedControls: TeamPlanControls = { ...controls, scopeByHeroId: { rowan: 'optimize' } };
    const scopedBasis: PlanBasis = { inputs: inputs([rowan, minato], [boots]), controls: scopedControls };
    const now = inputs([minato], []);
    const ledger = describePlanChanges(scopedBasis, { inputs: now, controls: scopedControls }, plan);
    const html = renderToStaticMarkup(
      createElement(PlanChangesPanel, { t, lang: 'en', ledger, basis: scopedBasis, now, onRecompute: () => {}, recomputeBlocked: false, busy: false }),
    );
    // Rowan (placed by the plan through its scope) is gone, and the boots the plan forged left
    // the bag too — two rows, both breaks, nothing else.
    expect(text(html)).toContain(sub(t.teamPlanChangesCountMany, { n: 2 }));
  });

  it('a worn piece that has left the bag BREAKS the plan, shown by the outer tone even while folded', () => {
    const html = render(inputs([rowan, minato], []));
    expect(html).toContain('data-breaks="true"');
    expect(html).not.toContain('data-testid="team-plan-change"');
  });

  it('never renders a "keep this plan" button', () => {
    const html = render(inputs([rowan, minato], []));
    expect(html).not.toContain('Keep this plan');
    expect(text(html)).not.toContain('Keep this plan');
  });
});

describe('PlanChangesPanelBody — the ledger table, opened, draws only what breaks the plan', () => {
  it('a worn piece that has left the bag BREAKS the plan, named by what the plan knew of it', () => {
    const html = renderBody(inputs([rowan, minato], []));
    expect(html).toMatch(/data-verdict="breaks"[^>]*data-field="itemRemoved"/);
    const body = text(html);
    expect(body).toContain(t.teamPlanChangesGroupBreaks);
    expect(body).toContain(t.teamPlanChangesItemRemovedUsed);
  });

  it('a hero the plan placed leaving the roster BREAKS the plan too', () => {
    const scopedControls: TeamPlanControls = { ...controls, scopeByHeroId: { rowan: 'optimize' } };
    const scopedBasis: PlanBasis = { inputs: inputs([rowan, minato], [boots]), controls: scopedControls };
    const now = inputs([minato], [boots]);
    const ledger = describePlanChanges(scopedBasis, { inputs: now, controls: scopedControls }, null);
    const { heroes, items, heroNames } = planChangesViewModel(scopedBasis, now);
    const html = renderToStaticMarkup(createElement(PlanChangesPanelBody, { t, lang: 'en', ledger, heroes, items, heroNames }));
    expect(html).toMatch(/data-verdict="breaks"[^>]*data-field="heroRemoved"/);
    const body = text(html);
    expect(body).toContain('Rowan');
    expect(body).toContain(t.teamPlanChangesHeroRemovedUsed);
  });

  it('only the row that breaks the plan is drawn — a level the plan merely cares about and a forge step it made progress on are both left out', () => {
    const ring = item({ id: 'ring', defId: 'ring_of_focus', slot: 'anel', equippedBy: 'rowan', rarityIdx: 0, upgrade: 0 });
    const basisWithRing: PlanBasis = { inputs: inputs([rowan, minato], [boots, ring]), controls };
    const planWithRing: TeamPlan = { ...plan, forgeList: [...plan.forgeList, { itemId: 'ring', defId: 'ring_of_focus', from: 0, to: 2 }] };
    // Rowan levels ("changes the plan"), the boots forge one step towards what the plan asked
    // ("progress on this plan"), and the ring the plan also forged leaves the bag ("breaks it").
    const now = inputs([{ ...rowan, level: 96 }, minato], [{ ...boots, upgrade: 13 }]);
    const ledger = describePlanChanges(basisWithRing, { inputs: now, controls }, planWithRing);
    const { heroes, items, heroNames } = planChangesViewModel(basisWithRing, now);
    const html = renderToStaticMarkup(createElement(PlanChangesPanelBody, { t, lang: 'en', ledger, heroes, items, heroNames }));
    expect(html.match(/data-testid="team-plan-change"/g)).toHaveLength(1);
    expect(html).toMatch(/data-verdict="breaks"[^>]*data-field="itemRemoved"/);
    expect(html).not.toContain('data-field="level"');
    expect(html).not.toContain('data-field="forge"');
  });

  it('renders nothing when there is nothing that breaks the plan', () => {
    const html = renderBody(inputs([{ ...rowan, level: 96 }, minato], [boots]));
    expect(html).not.toContain('data-testid="team-plan-change"');
    expect(html).not.toContain('<table');
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

  it('a levelled hero states its before and after, plainly — this no longer draws in the panel, but the words still have to be right', () => {
    const ledger = describePlanChanges(basis, { inputs: inputs([{ ...rowan, level: 96 }, minato], [boots]), controls }, null);
    const row = ledger.plan.find((entry) => entry.detail.field === 'level')!;
    expect(wordPlanChange(row, t, 'en', names)).toMatchObject({
      change: t.teamPlanChangesLevel,
      before: { kind: 'text', value: '95' },
      after: { kind: 'text', value: '96' },
    });
  });

  it('a forge step formats before/after with a "+" prefix and names what the plan asked', () => {
    const ledger = describePlanChanges(basis, { inputs: inputs([rowan, minato], [{ ...boots, upgrade: 13 }]), controls }, plan);
    const row = ledger.progress.find((entry) => entry.detail.field === 'forge')!;
    const word = wordPlanChange(row, t, 'en', names);
    expect(word).toMatchObject({ change: t.teamPlanChangesForge, before: { kind: 'text', value: '+12' }, after: { kind: 'text', value: '+13' } });
    expect(word.note).toMatchObject({ kind: 'text', value: 'plan asked +14' });
  });

  it('a new piece says what it is, not a dash or a plus-zero', () => {
    const ledger = describePlanChanges(basis, { inputs: inputs([rowan, minato], [boots, item({ id: 'helm', defId: 'autumn_helm', slot: 'elmo', rarityIdx: 2, upgrade: 0, equipped: false, equippedBy: null })]), controls }, null);
    const row = ledger.plan.find((entry) => entry.detail.field === 'itemAdded')!;
    const word = wordPlanChange(row, t, 'en', names);
    expect(word.change).toBe(`${t.teamPlanChangesItemAdded} · Rare · Lv 50`);
    expect(word.before).toEqual({ kind: 'text', value: '' });
    expect(word.after).toEqual({ kind: 'text', value: '' });
  });
});
