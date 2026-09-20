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
import { PlanChangesPanel, wordPlanChange } from './plan-changes-panel';

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

function text(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

describe('PlanChangesPanel — the ledger of what changed since the plan', () => {
  it('renders nothing at all when only field rotation moved', () => {
    const now = inputs([{ ...rowan, deployed: true }, minato], [boots]);
    expect(render(now)).toBe('');
  });

  it('names a levelled hero with its before and after, under "Changes the plan"', () => {
    const html = render(inputs([{ ...rowan, level: 96 }, minato], [boots]));
    expect(html).toContain('data-testid="team-plan-changes"');
    expect(html).toContain('data-counted="1"');
    expect(text(html)).toContain(t.teamPlanChangesCountOne);
    expect(html).toMatch(/data-verdict="plan"[^>]*data-field="level"/);
    const body = text(html);
    expect(body).toContain('Rowan');
    expect(body).toContain(`${t.teamPlanChangesLevel}`);
    expect(body).toMatch(/95\s*→\s*96/);
    expect(body).toContain(t.teamPlanChangesGroupPlan);
  });

  it('a forge step the plan asked for is progress, with the target beside it', () => {
    const html = render(inputs([rowan, minato], [{ ...boots, upgrade: 13 }]));
    expect(html).toMatch(/data-verdict="progress"[^>]*data-field="forge"/);
    const body = text(html);
    expect(body).toContain(t.teamPlanChangesGroupProgress);
    expect(body).toMatch(/\+12\s*→\s*\+13/);
    expect(body).toContain('plan asked +14');
    expect(body).not.toContain(t.teamPlanChangesGroupPlan);
  });

  it('the rotation the reader may have noticed is one muted line, never a row', () => {
    const html = render(inputs([{ ...rowan, level: 96, deployed: true }, { ...minato, deployed: true }], [boots]));
    expect(html).toContain('data-testid="team-plan-changes-rotation"');
    expect(text(html)).toContain('2 heroes rotated on or off the field');
    expect(html.match(/data-testid="team-plan-change"/g)).toHaveLength(1);
  });

  it('carries the two presses: keep this plan, and build it again through the same trigger', () => {
    const html = render(inputs([{ ...rowan, level: 96 }, minato], [boots]));
    expect(html).toContain('data-testid="team-plan-changes-keep"');
    expect(html).toContain('data-testid="team-plan-changes-recompute"');
    expect(text(html)).toContain(t.teamPlanChangesRecompute);
  });

  it('a worn piece that has left the bag BREAKS the plan: its own group first, in the down tone, named by what the plan knew of it', () => {
    const html = render(inputs([rowan, minato], []));
    expect(html).toContain('data-breaks="true"');
    expect(html).toMatch(/data-verdict="breaks"[^>]*data-field="itemRemoved"/);
    const body = text(html);
    expect(body).toContain(t.teamPlanChangesGroupBreaks);
    expect(body).toContain(t.teamPlanChangesItemRemovedUsed);
    expect(body.indexOf(t.teamPlanChangesGroupBreaks)).toBeLessThan(body.indexOf(t.teamPlanChangesColWhat) + 400);
  });

  it('a new piece says what it is, not a dash and a plus-zero', () => {
    const html = render(inputs([rowan, minato], [boots, item({ id: 'helm', defId: 'autumn_helm', slot: 'elmo', rarityIdx: 2, upgrade: 0, equipped: false, equippedBy: null })]));
    const body = text(html);
    expect(body).toContain(`${t.teamPlanChangesItemAdded} · Rare · Lv 50`);
    expect(body).not.toContain('—');
    expect(body).not.toContain('+0');
  });

  it('changes the plan cares about but does not list are said in one line, each kind once', () => {
    const html = render(inputs([{ ...rowan, pts: { ...ZERO, attack: 41 }, abilities: { bomba_dupla: 1 } }, minato], [boots]), null);
    expect(html).not.toContain('data-testid="team-plan-change"');
    expect(text(html)).toContain(sub(t.teamPlanChangesAlso, { kinds: `${t.teamPlanChangesKindPoints}, ${t.teamPlanChangesKindAbilities}` }));
    expect(text(html)).toContain(sub(t.teamPlanChangesCountMany, { n: 2 }));
  });
});

describe('wordPlanChange — every kind of change has words, and none is a raw field name', () => {
  const names = new Map([['rowan', 'Rowan'], ['minato', 'Minato']]);

  it('a control change prints the option labels, not the enum values', () => {
    const ledger = describePlanChanges(basis, { inputs: basis.inputs, controls: { ...controls, objective: 'dps', allowedChanges: 'points', ignoreFieldCrowding: true } }, null);
    const words = ledger.other.map((entry) => wordPlanChange(entry, t, 'en', names));
    expect(words.map((w) => `${w.change}: ${w.before} → ${w.after}`)).toEqual([
      `${t.teamPlanChangesControlObjective}: ${t.teamPlanObjectiveOptionGold} → ${t.teamPlanObjectiveOptionDamage}`,
      `${t.teamPlanChangesControlAllowedChanges}: ${t.teamPlanAllowedChangesOptionBoth} → ${t.teamPlanAllowedChangesOptionPoints}`,
      `${t.teamPlanChangesControlIgnoreFieldCrowding}: ${t.teamPlanChangesOff} → ${t.teamPlanChangesOn}`,
    ]);
  });

  it('a piece moved between heroes names both heroes, and nobody when it comes off', () => {
    const moved = describePlanChanges(basis, { inputs: inputs([rowan, minato], [{ ...boots, equippedBy: 'rowan' }]), controls }, null);
    expect(wordPlanChange(moved.other[0]!, t, 'en', names)).toMatchObject({ change: t.teamPlanChangesEquippedBy, before: 'Minato', after: 'Rowan' });
    const off = describePlanChanges(basis, { inputs: inputs([rowan, minato], [{ ...boots, equipped: false }]), controls }, null);
    expect(wordPlanChange(off.other[0]!, t, 'en', names)).toMatchObject({ before: 'Minato', after: t.teamPlanChangesNobody });
  });

  it('a phase the account advanced through, with no phase pinned, is named twice: the farm and the scoring phase', () => {
    const ledger = describePlanChanges(basis, { inputs: inputs([rowan, minato], [boots], { phase: 92, farmChosenPhase: null }), controls }, null);
    const words = ledger.other.map((entry) => wordPlanChange(entry, t, 'en', names).change);
    expect(words).toEqual([t.teamPlanChangesFieldPhase, t.teamPlanChangesControlTargetPhase]);
  });
});
