/**
 * Everything a row, a confirm and the modal's unit labels need, computed once per live view from
 * the plan. Pure — no React, no IPC. The panel (`apply-panel.tsx`) is the only caller; every rule
 * here is a function with a test, not a component.
 */
import {
  toDomainLang,
  type AccountView,
  type ApplyEquipUnit,
  type ApplyPointsUnit,
  type ApplyStep,
  type ApplyUnitVerdict,
  type AppLocale,
  type DomainLang,
} from '@bombfarm/contracts';
import {
  COMMIT_ORDER,
  computeApplyLedger,
  derivePointsUnits,
  deriveEquipUnits,
  estimateApplyDurationMs,
  liveGearStateFromRows,
  pointsToCommitVector,
  preflightEquipUnits,
  preflightPointsUnit,
  preflightPointsUnitsOffline,
  summarizeApplyVerdicts,
  type ApplyLedger,
} from '@bombfarm/domain/team-plan';
import type { ForgeAction, TeamPlan } from '@bombfarm/domain/team-plan/types';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { itemName, sheetStatShortLabel } from '@bombfarm/domain/game-labels';
import { buildInventoryView, type InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { forgeLevel, forgeLabels, type ForgeLabels } from '../../app/forge/forge-labels';
import { gearOf } from '../forge/forge-rows';
import { finiteNumber } from '../format';
import type { Copy } from '../copy';
import { buildOptimizerInputs } from './optimizer-inputs';
import type { ApplyUnitLabel, RowSkipReason } from './apply-labels';

export type ApplyStepId = 'equip' | 'forge' | 'points';

export type StepFacts =
  | { readonly kind: 'nothing' }
  | {
      readonly kind: 'units';
      readonly units: readonly ApplyUnitLabel[];
      readonly pending: readonly number[];
      readonly done: readonly number[];
      readonly skips: readonly { readonly index: number; readonly reason: RowSkipReason }[];
      readonly calls: number;
      readonly aboutMs: number;
      readonly gold: number;
      readonly heroes: number;
      readonly respecs: number;
    };

export type ApplyFacts = {
  readonly ledger: ApplyLedger;
  readonly steps: Record<'equip' | 'points', StepFacts>;
  readonly forgeRow: {
    readonly forgeList: readonly ForgeAction[];
    readonly gear: readonly InventoryViewItem[];
    readonly labels: ForgeLabels;
  };
};

export type StepGate =
  | { readonly enabled: true; readonly notes: readonly 'pausesQueue'[] }
  | {
      readonly enabled: false;
      readonly reason: 'otherRunning' | 'switchOff' | 'stale' | 'nothing' | 'allDone' | 'nothingLeft' | 'loading' | 'running';
    };

const NO_HEROES: readonly HeroRecord[] = [];

function heroMap(heroes: readonly HeroRecord[]): ReadonlyMap<string, HeroRecord> {
  return new Map(heroes.map((hero) => [hero.id, hero]));
}

function equipVerdicts(units: readonly ApplyEquipUnit[], liveView: AccountView | null): ApplyUnitVerdict[] {
  const live = liveView === null ? null : liveGearStateFromRows(liveView.payload.items, liveView.payload.heroes);
  if (live === null) {
    return units.map((unit) => ({ index: unit.index, status: 'conflict', reason: 'itemMissing' }));
  }
  return preflightEquipUnits(units, live);
}

function pointsVerdicts(units: readonly ApplyPointsUnit[], liveHeroes: ReadonlyMap<string, HeroRecord>): ApplyUnitVerdict[] {
  const liveHeroIds = new Set(liveHeroes.keys());
  const offline = preflightPointsUnitsOffline(units, liveHeroIds);
  return units.map((unit, index) => {
    const hero = liveHeroes.get(unit.heroId);
    if (hero === undefined) return offline[index] ?? { index: unit.index, status: 'conflict', reason: 'heroMissing' };
    const alloc = pointsToCommitVector(hero.pts);
    const spent = alloc.reduce((sum, value) => sum + value, 0);
    return preflightPointsUnit(unit, { alloc, spent });
  });
}

/** The row's own reason set — the four conflict reasons plus `notEnoughGold`, folded in
 *  separately since it never comes from a domain verdict (A-6/AC1.6). */
function toRowSkips(
  verdicts: readonly ApplyUnitVerdict[],
  shortIndexes: ReadonlySet<number>,
): readonly { readonly index: number; readonly reason: RowSkipReason }[] {
  const skips: { index: number; reason: RowSkipReason }[] = [];
  for (const verdict of verdicts) {
    if (shortIndexes.has(verdict.index)) {
      skips.push({ index: verdict.index, reason: 'notEnoughGold' });
    } else if (verdict.status === 'conflict' && verdict.reason !== undefined) {
      skips.push({ index: verdict.index, reason: verdict.reason });
    }
  }
  return skips;
}

function heroName(heroId: string, planHeroes: readonly HeroRecord[], liveHeroes: ReadonlyMap<string, HeroRecord>): string {
  return planHeroes.find((hero) => hero.id === heroId)?.name ?? liveHeroes.get(heroId)?.name ?? heroId;
}

export function liveItemsById(liveView: AccountView | null): ReadonlyMap<string, InventoryViewItem> {
  if (liveView === null) return new Map();
  return new Map(buildInventoryView(liveView.payload.items).items.map((item) => [item.id, item]));
}

function isEquipUnit(unit: ApplyEquipUnit | ApplyPointsUnit): unit is ApplyEquipUnit {
  return 'itemId' in unit;
}

function equipUnitLabel(
  unit: ApplyEquipUnit,
  planHeroes: readonly HeroRecord[],
  liveHeroes: ReadonlyMap<string, HeroRecord>,
  items: ReadonlyMap<string, InventoryViewItem>,
  lang: DomainLang,
): ApplyUnitLabel {
  const upgrade = items.get(unit.itemId)?.upgrade ?? 0;
  const subject = `${itemName({ defId: unit.defId }, lang)} ${forgeLevel(upgrade)}`;
  return {
    index: unit.index,
    call: unit.call,
    subject,
    from: unit.fromHeroId === null ? null : heroName(unit.fromHeroId, planHeroes, liveHeroes),
    to: unit.toHeroId === null ? null : heroName(unit.toHeroId, planHeroes, liveHeroes),
    points: null,
    gold: 0,
    heroId: unit.toHeroId ?? unit.fromHeroId,
    itemId: unit.itemId,
    alloc: null,
  };
}

/** Stat by stat, in the sheet's order: after a refund every point is placed again, so the whole
 *  vector is what goes on; with nothing refunded only the points added move. */
export function pointsAllocation(unit: ApplyPointsUnit, lang: DomainLang): { readonly stat: string; readonly points: number }[] {
  return COMMIT_ORDER.map((stat, position) => {
    const after = unit.vector[position] ?? 0;
    const before = unit.needsRespec ? 0 : (unit.vectorBefore[position] ?? 0);
    return { stat: sheetStatShortLabel(stat, lang), points: after - before };
  }).filter((entry) => entry.points > 0);
}

function pointsUnitLabel(
  unit: ApplyPointsUnit,
  planHeroes: readonly HeroRecord[],
  liveHeroes: ReadonlyMap<string, HeroRecord>,
  lang: DomainLang,
): ApplyUnitLabel {
  return {
    index: unit.index,
    call: unit.needsRespec ? 'respec' : 'commit',
    subject: heroName(unit.heroId, planHeroes, liveHeroes),
    from: null,
    to: null,
    points: unit.pointsPlaced,
    gold: unit.respecGold,
    heroId: unit.heroId,
    alloc: pointsAllocation(unit, lang),
  };
}

/**
 * A unit's label, resolved once and frozen — an item's name with its current `+N`, or a hero's
 * name — from the plan's own heroes first, the live roster second (A-10). Re-derives the live
 * roster from `liveView` itself, so a caller freezing labels at confirm time needs no other
 * state; `farmChosenPhase` plays no part in a hero's name or its inferred points, so this always
 * reads the roster with none pinned.
 */
export function unitLabels(
  units: readonly (ApplyEquipUnit | ApplyPointsUnit)[],
  planHeroes: readonly HeroRecord[] | null,
  liveView: AccountView | null,
  lang: DomainLang,
): ApplyUnitLabel[] {
  const heroes = planHeroes ?? NO_HEROES;
  const liveInputs = liveView === null ? null : buildOptimizerInputs(liveView, null);
  const liveHeroes = heroMap(liveInputs?.inputs.heroes ?? NO_HEROES);
  const items = liveItemsById(liveView);
  return units.map((unit) =>
    isEquipUnit(unit) ? equipUnitLabel(unit, heroes, liveHeroes, items, lang) : pointsUnitLabel(unit, heroes, liveHeroes, lang),
  );
}

/** The reset row's per-hero wallet-short line (AC1.6) — a respec the live wallet cannot cover,
 *  named on the row and counted among its skips. `null` wallet never names a hero short: the
 *  run-time check is main's (edge case, "no finite gold"). */
export function walletShortHeroes(
  pointsUnits: readonly ApplyPointsUnit[],
  wallet: number | null,
  planHeroes: readonly HeroRecord[],
  liveHeroes: ReadonlyMap<string, HeroRecord>,
): readonly { readonly index: number; readonly heroId: string; readonly name: string; readonly needed: number; readonly onHand: number }[] {
  if (wallet === null) return [];
  return pointsUnits
    .filter((unit) => unit.needsRespec && unit.respecGold > wallet)
    .map((unit) => ({
      index: unit.index,
      heroId: unit.heroId,
      name: heroName(unit.heroId, planHeroes, liveHeroes),
      needed: unit.respecGold,
      onHand: wallet,
    }));
}

/** Groups a step's conflict verdicts by reason, counted — the row's "{count} of {total} will be
 *  skipped — {reasons}" line groups on this. */
export function groupSkips(
  skips: readonly { readonly reason: RowSkipReason }[],
): { readonly count: number; readonly groups: readonly { readonly reason: RowSkipReason; readonly count: number }[] } {
  const counts = new Map<RowSkipReason, number>();
  for (const skip of skips) counts.set(skip.reason, (counts.get(skip.reason) ?? 0) + 1);
  return { count: skips.length, groups: [...counts.entries()].map(([reason, count]) => ({ reason, count })) };
}

function stepFacts(
  verdicts: readonly ApplyUnitVerdict[],
  units: readonly ApplyUnitLabel[],
  extraSkips: readonly { readonly index: number }[],
  calls: number,
  gold: number,
  heroes: number,
  respecs: number,
): StepFacts {
  if (units.length === 0) return { kind: 'nothing' };
  const shortIndexes = new Set(extraSkips.map((skip) => skip.index));
  const skips = toRowSkips(verdicts, shortIndexes);
  const pending = verdicts.filter((v) => v.status !== 'done' && v.status !== 'conflict').map((v) => v.index);
  const done = verdicts.filter((v) => v.status === 'done').map((v) => v.index);
  return {
    kind: 'units',
    units,
    pending,
    done,
    skips,
    calls,
    aboutMs: estimateApplyDurationMs(calls),
    gold,
    heroes,
    respecs,
  };
}

export function buildApplyFacts(input: {
  readonly plan: TeamPlan;
  readonly planHeroes: readonly HeroRecord[] | null;
  readonly liveView: AccountView | null;
  readonly farmChosenPhase: number | null;
  readonly t: Copy;
  readonly locale: AppLocale;
}): ApplyFacts {
  const { plan, liveView, farmChosenPhase, t, locale } = input;
  const lang: DomainLang = toDomainLang(locale);
  const planHeroes = input.planHeroes ?? NO_HEROES;

  const equipUnits = deriveEquipUnits(plan.moveList);
  const pointsUnits = derivePointsUnits(plan);

  const liveInputs = liveView === null ? null : buildOptimizerInputs(liveView, farmChosenPhase);
  const liveHeroes = heroMap(liveInputs?.inputs.heroes ?? NO_HEROES);
  const items = liveItemsById(liveView);

  const equipVerdictList = equipVerdicts(equipUnits, liveView);
  const pointsVerdictList = pointsVerdicts(pointsUnits, liveHeroes);

  const wallet = liveView === null ? null : finiteNumber(liveView.payload.account?.gold);
  const walletShort = walletShortHeroes(pointsUnits, wallet, planHeroes, liveHeroes);

  const equipLabels = equipUnits.map((unit) => equipUnitLabel(unit, planHeroes, liveHeroes, items, lang));
  const pointsLabels = pointsUnits.map((unit) => pointsUnitLabel(unit, planHeroes, liveHeroes, lang));

  const equipCounts = summarizeApplyVerdicts(equipVerdictList);
  const pointsPendingUnits = pointsUnits.filter((unit, i) => pointsVerdictList[i]?.status !== 'done');
  const pointsPendingCalls = pointsPendingUnits.reduce((sum, unit) => sum + (unit.needsRespec ? 2 : 1), 0);
  const pointsPendingGold = pointsPendingUnits.reduce((sum, unit) => sum + unit.respecGold, 0);
  const pointsPendingRespecs = pointsPendingUnits.filter((unit) => unit.needsRespec).length;

  const equipPendingCalls = equipCounts.pending;

  const liveInventoryItems = buildInventoryView(liveView?.payload.items).items;
  const ledgerItems = liveInventoryItems.map((item) => ({
    id: item.id,
    upgrade: item.upgrade,
    level: item.level,
    rarityIdx: item.rarityIdx,
  }));

  const ledger = computeApplyLedger({
    equipUnits,
    pointsUnits,
    forgeList: plan.forgeList,
    items: ledgerItems,
    walletBefore: wallet,
  });

  return {
    ledger,
    steps: {
      equip: stepFacts(equipVerdictList, equipLabels, [], equipPendingCalls, 0, 0, 0),
      points: stepFacts(
        pointsVerdictList,
        pointsLabels,
        walletShort,
        pointsPendingCalls,
        pointsPendingGold,
        pointsPendingUnits.length,
        pointsPendingRespecs,
      ),
    },
    forgeRow: {
      forgeList: plan.forgeList,
      // The live pool, never the plan's frozen snapshot — a piece the plan named may have moved
      // or already reached its target since.
      gear: gearOf(liveInventoryItems),
      labels: forgeLabels(t, lang, locale),
    },
  };
}

/**
 * First reason that applies, in order: another step running → switch off (equip/points only —
 * the forge row is gated by neither the switch nor the account source, contract item 4) → stale
 * (only before any step of this plan run id has been applied, A-2) → nothing to do → all done →
 * nothing left to apply → ready (`pausesQueue` noted for equip/points only, while the queue runs).
 */
export function stepGate(
  facts: StepFacts,
  step: ApplyStepId,
  ctx: {
    readonly forgeWritesEnabled: boolean;
    readonly isStale: boolean;
    readonly anyStepApplied: boolean;
    readonly running: ApplyStep | null;
    readonly queueRunning: boolean;
  },
): StepGate {
  if (ctx.running !== null && ctx.running === step) return { enabled: false, reason: 'running' };
  if (ctx.running !== null) return { enabled: false, reason: 'otherRunning' };
  if (step !== 'forge' && !ctx.forgeWritesEnabled) return { enabled: false, reason: 'switchOff' };
  if (ctx.isStale && !ctx.anyStepApplied) return { enabled: false, reason: 'stale' };
  if (facts.kind === 'nothing') return { enabled: false, reason: 'nothing' };
  if (facts.pending.length > 0) {
    const notes: readonly 'pausesQueue'[] = step !== 'forge' && ctx.queueRunning ? ['pausesQueue'] : [];
    return { enabled: true, notes };
  }
  return facts.done.length === facts.units.length ? { enabled: false, reason: 'allDone' } : { enabled: false, reason: 'nothingLeft' };
}

const UNDONE_ORDER: readonly ApplyStepId[] = ['equip', 'forge', 'points'];

/** The next step of this run whose record is still `idle` (the `'forge'` key counts as undone
 *  while `idle` too), scanning a fixed priority and skipping the step just finished. `null` when
 *  none is left. */
export function nextUndoneStep(
  records: Readonly<Record<ApplyStepId, { readonly status: string }>>,
  from: ApplyStepId | null,
): ApplyStepId | null {
  for (const id of UNDONE_ORDER) {
    if (id === from) continue;
    if (records[id].status === 'idle') return id;
  }
  return null;
}
