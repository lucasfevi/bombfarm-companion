import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import type { HeroRune } from '@bombfarm/domain/runes';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import type { TeamPlanInputs } from './team-plan-inputs';
import type { TeamPlanControls } from './team-plan-controls';
import type { ScopeState } from './hero-scope';
import { resolveHeroScope } from './hero-scope';
import { resolveTeamPlanTargetPhase } from './target-phase';

/**
 * What a plan was computed from: the inputs and the controls as they stood when the run began.
 * A host freezes one at `startRun` so that, later, the screen can say what has changed since —
 * not that something has.
 */
export type PlanBasis = {
  readonly inputs: TeamPlanInputs;
  readonly controls: TeamPlanControls;
};

/**
 * The planning view of one hero: every field the solver reads, and nothing it does not. The game
 * flips `deployed` on every field rotation, `battleAllowed` on the player's or an automation's
 * whim, ticks a rune's seconds down on every read and re-derives `power` from the rest — none of
 * which moves the answer, and each of which used to mark a plan stale. `battleAllowed` reaches
 * the plan only through the default scope, so it is read in {@link planningControlsView} through
 * the scope it resolves to, never here.
 */
type RuneView = { axis: HeroRune['axis']; strengthPct: number; rarity: number };
type HeroView = {
  id: string;
  name: string;
  rarity: HeroRecord['rarity'];
  level: number;
  stars: number;
  naked: HeroRecord['naked'];
  birth: HeroRecord['birth'] | null;
  gearedOverride: HeroRecord['gearedOverride'];
  loadout: HeroRecord['loadout'];
  altLoadout: HeroRecord['altLoadout'];
  abilities: Record<string, number>;
  pts: HeroRecord['pts'];
  statPointsAvailable: number;
  runes: readonly RuneView[];
};

function runeView(rune: HeroRune): RuneView {
  return { axis: rune.axis, strengthPct: rune.strengthPct, rarity: rune.rarity };
}

export function planningHeroView(hero: HeroRecord): HeroView {
  return {
    id: hero.id,
    name: hero.name,
    rarity: hero.rarity,
    level: hero.level,
    stars: hero.stars,
    naked: hero.naked,
    birth: hero.birth ?? null,
    gearedOverride: hero.gearedOverride,
    loadout: hero.loadout,
    altLoadout: hero.altLoadout,
    abilities: hero.abilities,
    pts: hero.pts,
    statPointsAvailable: hero.statPointsAvailable ?? 0,
    runes: (hero.runes ?? []).map(runeView),
  };
}

type ItemView = {
  id: string;
  defId: string;
  rarityIdx: number;
  level: number;
  upgrade: number;
  slot: string | null;
  equippedBy: string | null;
};

export function planningItemView(item: InventoryItem): ItemView {
  return {
    id: item.id,
    defId: item.defId,
    rarityIdx: item.rarityIdx,
    level: item.level,
    upgrade: item.upgrade,
    slot: item.slot,
    equippedBy: item.equipped ? item.equippedBy : null,
  };
}

export const TREE_AXES = [
  'treeDanoTotal',
  'treeEnergy',
  'treeSpeed',
  'treeCritChance',
  'treeCritDmg',
  'treeLuckFlatPct',
  'treeTeamCoinPct',
  'treeXpMult',
] as const;
export type TreeAxis = (typeof TREE_AXES)[number];

export const ACCOUNT_FIELDS = ['houseIdx', 'houseLevel', 'phase', 'maxPhase', 'slots', 'fieldSlots', 'houseCycleSecs'] as const;
export type AccountField = (typeof ACCOUNT_FIELDS)[number];

type AccountView = Record<TreeAxis, number> & Record<AccountField, number | null>;

function planningAccountView(inputs: TeamPlanInputs): AccountView {
  const view = {} as AccountView;
  for (const axis of TREE_AXES) view[axis] = inputs[axis];
  for (const field of ACCOUNT_FIELDS) view[field] = inputs[field] ?? null;
  return view;
}

export const CONTROL_FIELDS = ['forgeFloor', 'objective', 'allowedChanges', 'ignoreFieldCrowding', 'aurasAtCap', 'targetPhase'] as const;
export type ControlField = (typeof CONTROL_FIELDS)[number];

type ControlsView = {
  forgeFloor: number;
  objective: TeamPlanControls['objective'];
  allowedChanges: TeamPlanControls['allowedChanges'];
  ignoreFieldCrowding: boolean;
  aurasAtCap: string;
  targetPhase: number | null;
  scopeByHeroId: Record<string, ScopeState>;
};

function planningControlsView(inputs: TeamPlanInputs, controls: TeamPlanControls): ControlsView {
  const scopeByHeroId: Record<string, ScopeState> = {};
  for (const hero of inputs.heroes) scopeByHeroId[hero.id] = resolveHeroScope(hero, controls.scopeByHeroId);
  return {
    forgeFloor: controls.forgeFloor,
    objective: controls.objective,
    allowedChanges: controls.allowedChanges,
    ignoreFieldCrowding: controls.ignoreFieldCrowding,
    aurasAtCap: [...controls.aurasAtCap].sort().join(','),
    targetPhase: resolveTeamPlanTargetPhase(inputs, controls),
    scopeByHeroId,
  };
}

function byId<T extends { id: string }>(list: readonly T[]): Map<string, T> {
  return new Map(list.map((entry) => [entry.id, entry]));
}

function sortedById<T extends { id: string }>(list: readonly T[]): T[] {
  return [...list].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

/** JSON with every object's keys in sorted order, so two views that differ only in key order read
 *  as one. Arrays keep their order — the views above sort what needs sorting. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return entry;
    const record = entry as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) sorted[key] = record[key];
    return sorted;
  });
}

/** The identity of everything in the INPUTS the plan depends on — the account's side alone, with
 *  no control and no host-chosen farm phase in it. A host that holds a copy of the inputs reads
 *  "has the live account moved past my copy" from this. */
export function planInputsSignature(inputs: TeamPlanInputs): string {
  return canonicalJson({
    heroes: sortedById(inputs.heroes.map(planningHeroView)),
    items: sortedById(inputs.inventory.items.map(planningItemView)),
    account: planningAccountView(inputs),
  });
}

/** The identity of everything the plan depends on. Two bases with the same signature would
 *  produce the same plan; two with different signatures differ in at least one thing
 *  {@link describePlanChanges} lists as counted. */
export function planBasisSignature(inputs: TeamPlanInputs, controls: TeamPlanControls): string {
  return canonicalJson({
    heroes: sortedById(inputs.heroes.map(planningHeroView)),
    items: sortedById(inputs.inventory.items.map(planningItemView)),
    account: planningAccountView(inputs),
    controls: planningControlsView(inputs, controls),
  });
}

/* ---------------------------------------------------------------------------------------------
 * The ledger
 * ------------------------------------------------------------------------------------------- */

/**
 * `plan` — the change moves what the optimizer would answer. `progress` — the change is one the
 * plan itself asked for (a forge step taken, points spent where it said). `noise` — the account
 * moved in a way the plan does not depend on; listed so the reader knows it was seen, never as a
 * reason to recompute.
 */
export type PlanChangeVerdict = 'plan' | 'progress' | 'noise';

export type PlanChangeSubject =
  | { kind: 'hero'; id: string; name: string }
  | { kind: 'item'; id: string; defId: string; rarityIdx: number }
  | { kind: 'account' }
  | { kind: 'controls' };

export type PlanChangeDetail =
  | { field: 'heroAdded' }
  | { field: 'heroRemoved' }
  | { field: 'level'; before: number; after: number }
  | { field: 'stars'; before: number; after: number }
  | { field: 'points'; stat: keyof HeroRecord['pts']; before: number; after: number; asked: number | null }
  | { field: 'pointsAvailable'; before: number; after: number }
  | { field: 'ability'; abilityId: string; before: number; after: number }
  | { field: 'runeGained'; axis: HeroRune['axis']; strengthPct: number }
  | { field: 'runeLost'; axis: HeroRune['axis']; strengthPct: number }
  | { field: 'heroOther' }
  | { field: 'itemAdded' }
  | { field: 'itemRemoved' }
  | { field: 'forge'; before: number; after: number; asked: number | null }
  | { field: 'equippedBy'; before: string | null; after: string | null; asked: string | null }
  | { field: 'itemOther' }
  | { field: 'tree'; axis: TreeAxis; before: number; after: number }
  | { field: 'accountField'; name: AccountField; before: number | null; after: number | null }
  | { field: 'control'; name: ControlField; before: string; after: string }
  | { field: 'scope'; heroId: string; heroName: string; before: ScopeState; after: ScopeState }
  | { field: 'fieldRotation'; onField: boolean }
  | { field: 'battleAllowed'; after: boolean }
  | { field: 'power'; before: number; after: number };

export type PlanChange = {
  readonly subject: PlanChangeSubject;
  readonly detail: PlanChangeDetail;
  readonly verdict: PlanChangeVerdict;
};

export type PlanChangeLedger = {
  readonly plan: readonly PlanChange[];
  readonly progress: readonly PlanChange[];
  readonly noise: readonly PlanChange[];
  /** `plan.length + progress.length` — what "stale" means. */
  readonly counted: number;
};

function change(subject: PlanChangeSubject, detail: PlanChangeDetail, verdict: PlanChangeVerdict): PlanChange {
  return { subject, detail, verdict };
}

function heroSubject(hero: HeroRecord): PlanChangeSubject {
  return { kind: 'hero', id: hero.id, name: hero.name };
}

function itemSubject(item: InventoryItem): PlanChangeSubject {
  return { kind: 'item', id: item.id, defId: item.defId, rarityIdx: item.rarityIdx };
}

/** A step is progress when the value moved from where the plan started towards — or onto — where
 *  it asked, and no further. Overshooting or going the other way is a change like any other. */
function isTowards(before: number, after: number, from: number, to: number): boolean {
  if (from === to) return false;
  const forward = to > from;
  const movedForward = forward ? after > before : after < before;
  const within = forward ? after <= to : after >= to;
  return movedForward && within;
}

function heroChanges(
  before: HeroRecord,
  after: HeroRecord,
  plan: TeamPlan | null,
): PlanChange[] {
  const out: PlanChange[] = [];
  const subject = heroSubject(after);
  const beforeView = planningHeroView(before);
  const afterView = planningHeroView(after);

  if (beforeView.level !== afterView.level) out.push(change(subject, { field: 'level', before: beforeView.level, after: afterView.level }, 'plan'));
  if (beforeView.stars !== afterView.stars) out.push(change(subject, { field: 'stars', before: beforeView.stars, after: afterView.stars }, 'plan'));

  const reset = plan?.pointResets.find((entry) => entry.heroId === after.id) ?? null;
  for (const stat of Object.keys(afterView.pts) as (keyof HeroRecord['pts'])[]) {
    const from = beforeView.pts[stat];
    const to = afterView.pts[stat];
    if (from === to) continue;
    const asked = reset === null ? null : (reset.pts[stat] ?? null);
    const askedFrom = reset === null ? null : (reset.ptsBefore[stat] ?? null);
    const progress = asked !== null && askedFrom !== null && isTowards(from, to, askedFrom, asked);
    out.push(change(subject, { field: 'points', stat, before: from, after: to, asked }, progress ? 'progress' : 'plan'));
  }
  if (beforeView.statPointsAvailable !== afterView.statPointsAvailable) {
    out.push(change(subject, { field: 'pointsAvailable', before: beforeView.statPointsAvailable, after: afterView.statPointsAvailable }, 'plan'));
  }

  const abilityIds = new Set([...Object.keys(beforeView.abilities), ...Object.keys(afterView.abilities)]);
  for (const abilityId of abilityIds) {
    const from = beforeView.abilities[abilityId] ?? 0;
    const to = afterView.abilities[abilityId] ?? 0;
    if (from !== to) out.push(change(subject, { field: 'ability', abilityId, before: from, after: to }, 'plan'));
  }

  const runeKey = (rune: RuneView) => `${rune.axis}:${String(rune.strengthPct)}:${String(rune.rarity)}`;
  const beforeRunes = new Map(beforeView.runes.map((rune) => [runeKey(rune), rune]));
  const afterRunes = new Map(afterView.runes.map((rune) => [runeKey(rune), rune]));
  for (const [key, rune] of afterRunes) if (!beforeRunes.has(key)) out.push(change(subject, { field: 'runeGained', axis: rune.axis, strengthPct: rune.strengthPct }, 'plan'));
  for (const [key, rune] of beforeRunes) if (!afterRunes.has(key)) out.push(change(subject, { field: 'runeLost', axis: rune.axis, strengthPct: rune.strengthPct }, 'plan'));

  // Anything the view covers that no row above named — a re-read birth sheet, a loadout the
  // items did not explain — still counts, so the ledger never says "current" over a moved key.
  if (out.length === 0 && canonicalJson(beforeView) !== canonicalJson(afterView)) {
    out.push(change(subject, { field: 'heroOther' }, 'plan'));
  }

  if ((before.deployed ?? false) !== (after.deployed ?? false)) {
    out.push(change(subject, { field: 'fieldRotation', onField: after.deployed ?? false }, 'noise'));
  }
  if ((before.battleAllowed ?? true) !== (after.battleAllowed ?? true)) {
    out.push(change(subject, { field: 'battleAllowed', after: after.battleAllowed ?? true }, 'noise'));
  }
  if ((before.power ?? 0) !== (after.power ?? 0) && out.every((entry) => entry.verdict === 'noise')) {
    out.push(change(subject, { field: 'power', before: before.power ?? 0, after: after.power ?? 0 }, 'noise'));
  }
  return out;
}

function itemChanges(before: InventoryItem, after: InventoryItem, plan: TeamPlan | null): PlanChange[] {
  const out: PlanChange[] = [];
  const subject = itemSubject(after);
  const beforeView = planningItemView(before);
  const afterView = planningItemView(after);

  if (beforeView.upgrade !== afterView.upgrade) {
    const forge = plan?.forgeList.find((action) => action.itemId === after.id) ?? null;
    const progress = forge !== null && isTowards(beforeView.upgrade, afterView.upgrade, forge.from, forge.to);
    out.push(change(subject, { field: 'forge', before: beforeView.upgrade, after: afterView.upgrade, asked: forge?.to ?? null }, progress ? 'progress' : 'plan'));
  }
  if (beforeView.equippedBy !== afterView.equippedBy) {
    const move = plan?.moveList.find((action) => action.itemId === after.id && action.phase === 'equip') ?? null;
    const unequip = plan?.moveList.find((action) => action.itemId === after.id && action.phase === 'unequip') ?? null;
    const asked = move !== null ? move.toHeroId : unequip !== null ? null : undefined;
    const progress = asked !== undefined && asked === afterView.equippedBy;
    out.push(change(subject, { field: 'equippedBy', before: beforeView.equippedBy, after: afterView.equippedBy, asked: asked ?? null }, progress ? 'progress' : 'plan'));
  }
  if (out.length === 0 && canonicalJson(beforeView) !== canonicalJson(afterView)) {
    out.push(change(subject, { field: 'itemOther' }, 'plan'));
  }
  return out;
}

/**
 * Everything that differs between what the plan was computed from and what stands now, each
 * difference with its verdict. `plan` is the plan the basis produced, when the host still holds
 * it: it is what lets a forge step or a point spend read as progress rather than as a change.
 */
export function describePlanChanges(basis: PlanBasis, now: PlanBasis, plan: TeamPlan | null): PlanChangeLedger {
  const out: PlanChange[] = [];

  const heroesBefore = byId(basis.inputs.heroes);
  const heroesAfter = byId(now.inputs.heroes);
  for (const hero of now.inputs.heroes) {
    const previous = heroesBefore.get(hero.id);
    if (previous === undefined) out.push(change(heroSubject(hero), { field: 'heroAdded' }, 'plan'));
    else out.push(...heroChanges(previous, hero, plan));
  }
  for (const hero of basis.inputs.heroes) {
    if (!heroesAfter.has(hero.id)) out.push(change(heroSubject(hero), { field: 'heroRemoved' }, 'plan'));
  }

  const itemsBefore = byId(basis.inputs.inventory.items);
  const itemsAfter = byId(now.inputs.inventory.items);
  for (const item of now.inputs.inventory.items) {
    const previous = itemsBefore.get(item.id);
    if (previous === undefined) out.push(change(itemSubject(item), { field: 'itemAdded' }, 'plan'));
    else out.push(...itemChanges(previous, item, plan));
  }
  for (const item of basis.inputs.inventory.items) {
    if (!itemsAfter.has(item.id)) out.push(change(itemSubject(item), { field: 'itemRemoved' }, 'plan'));
  }

  const accountBefore = planningAccountView(basis.inputs);
  const accountAfter = planningAccountView(now.inputs);
  for (const axis of TREE_AXES) {
    if (accountBefore[axis] !== accountAfter[axis]) out.push(change({ kind: 'account' }, { field: 'tree', axis, before: accountBefore[axis], after: accountAfter[axis] }, 'plan'));
  }
  for (const name of ACCOUNT_FIELDS) {
    if (accountBefore[name] !== accountAfter[name]) out.push(change({ kind: 'account' }, { field: 'accountField', name, before: accountBefore[name], after: accountAfter[name] }, 'plan'));
  }

  const controlsBefore = planningControlsView(basis.inputs, basis.controls);
  const controlsAfter = planningControlsView(now.inputs, now.controls);
  for (const name of CONTROL_FIELDS) {
    const from = controlsBefore[name];
    const to = controlsAfter[name];
    if (from !== to) out.push(change({ kind: 'controls' }, { field: 'control', name, before: String(from), after: String(to) }, 'plan'));
  }
  for (const hero of now.inputs.heroes) {
    const from = controlsBefore.scopeByHeroId[hero.id];
    const to = controlsAfter.scopeByHeroId[hero.id];
    if (from !== undefined && to !== undefined && from !== to) {
      out.push(change({ kind: 'controls' }, { field: 'scope', heroId: hero.id, heroName: hero.name, before: from, after: to }, 'plan'));
    }
  }

  const plan_ = out.filter((entry) => entry.verdict === 'plan');
  const progress = out.filter((entry) => entry.verdict === 'progress');
  const noise = out.filter((entry) => entry.verdict === 'noise');
  return { plan: plan_, progress, noise, counted: plan_.length + progress.length };
}
