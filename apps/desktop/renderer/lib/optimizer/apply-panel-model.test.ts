import { describe, expect, it } from 'vitest';
import type { AccountFidelity, AccountPayload, AccountView, ApplyPointsUnit } from '@bombfarm/contracts';
import { composeSheetFromBirth } from '@bombfarm/domain/birth-sheet';
import { emptyLoadout, emptySheetOther } from '@bombfarm/domain/gear';
import type { SheetStats } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { birthFromSave } from '@bombfarm/domain/save-units';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { estimateApplyDurationMs } from '@bombfarm/domain/team-plan';
import { en } from '../copy/en';
import {
  buildApplyFacts,
  groupSkips,
  nextUndoneStep,
  stepGate,
  unitLabels,
  walletShortHeroes,
  type ApplyStepId,
  type StepFacts,
} from './apply-panel-model';
import type { RowSkipReason } from './apply-labels';

const NOW = '2026-09-20T00:00:00.000Z';

function resolvedFidelity(): AccountFidelity {
  return {
    account: { status: 'resolved', capturedAt: NOW },
    heroes: { status: 'resolved', capturedAt: NOW },
    skills: { status: 'resolved', capturedAt: NOW },
    casa: { status: 'resolved', capturedAt: NOW },
    items: { status: 'resolved', capturedAt: NOW },
  };
}

const BIRTH_RAW = {
  dmg: 100,
  energia: 100,
  speed: 50,
  crit_chance: 0.05,
  crit_dmg: 1.5,
  penetration: 0,
  cooldown_reduction: 0,
  luck: 0,
};

function rawStatsFromSheet(sheet: SheetStats): Record<string, unknown> {
  return {
    dmg: sheet.attack,
    energia: sheet.energy,
    speed: sheet.speed,
    penetration: sheet.penetration,
    crit_chance: sheet.critChance / 100,
    cooldown_reduction: sheet.cdr / 100,
    crit_dmg: sheet.critDmg / 100 + 1,
    luck: sheet.luck / 100,
  };
}

/** A raw hero record whose `stats` is the exact forward composition of `pts` from `BIRTH_RAW` —
 *  so the real import inversion recovers `pts` exactly, without hand-solving the point-gain
 *  math. `pts` all zero (the default) reproduces `birth_stats` verbatim. */
function rawHero(id: string, name: string, level: number, pts: Record<string, number> = ZERO_PTS()) {
  const sheet = composeSheetFromBirth({
    birth: birthFromSave(BIRTH_RAW),
    level,
    stars: 1,
    sheetOther: emptySheetOther(),
    loadout: emptyLoadout(),
    pts: pts as never,
    tree: { danoStatic: 1, energyPct: 0, speedPct: 0, critChancePct: 0, critDmgPct: 0, luckFlatPct: 0 },
  });
  return {
    id,
    name,
    level,
    rarity: 2,
    stars: 1,
    birth_stats: BIRTH_RAW,
    stats: rawStatsFromSheet(sheet),
    stat_points_available: Object.values(pts).reduce((sum, value) => sum + value, 0),
  };
}

function basePayload(overrides: Partial<AccountPayload> = {}): AccountPayload {
  return {
    account: { phase: 60, max_phase: 88, gold: 1_000 },
    heroes: [
      rawHero('h1', 'Orin', 20),
      rawHero('h2', 'Bram', 20),
      rawHero('h9', 'Ghost', 20),
      rawHero('h-respec', 'Respec Hero', 20),
      rawHero('h-place', 'Place Hero', 20),
      // `luck`'s pool is a percentage of a zero birth base here, so a luck point composes to no
      // change at all — attack is the axis with a real non-zero base to invert against.
      rawHero('h-changed', 'Changed Hero', 20, { ...ZERO_PTS(), attack: 2 }),
    ],
    skills: { totals: {} },
    casa: { active_casa: 1, levels: [10] },
    items: [
      // i-move: the plan expects it on h1, but it is actually worn by h9 — "one piece moved".
      { id: 'i-move', def_id: 'clay_arma', rarity: 2, level: 20, upgrade: 3, equipped_on: 'h9' },
      // i-bag deliberately absent from the live bag — "one piece missing".
      // i-ready: bag-resident, exactly where the plan expects it — the one pending equip call.
      { id: 'i-ready', def_id: 'steel_luva', rarity: 1, level: 20, upgrade: 0 },
    ],
    fidelity: resolvedFidelity(),
    ...overrides,
  };
}

function viewOf(payload: AccountPayload): AccountView {
  return { payload, gameRunning: false, store: { status: 'ok', reason: null, binding: 'better-sqlite3' } };
}

function fixturePlan(overrides: Partial<TeamPlan> = {}): TeamPlan {
  return {
    steps: [],
    forgeList: [{ itemId: 'i-move', defId: 'clay_arma', from: 3, to: 6 }],
    moveList: [
      { phase: 'unequip', itemId: 'i-move', defId: 'clay_arma', slot: 'arma', fromHeroId: 'h1', toHeroId: null },
      { phase: 'equip', itemId: 'i-move', defId: 'clay_arma', slot: 'arma', fromHeroId: 'h1', toHeroId: 'h2' },
      { phase: 'equip', itemId: 'i-bag', defId: 'clay_elmo', slot: 'elmo', fromHeroId: null, toHeroId: 'h9' },
      { phase: 'equip', itemId: 'i-ready', defId: 'steel_luva', slot: 'luva', fromHeroId: null, toHeroId: 'h1' },
    ],
    pointResets: [
      {
        heroId: 'h-respec',
        ptsBefore: { ...ZERO_PTS(), attack: 3 },
        pts: { ...ZERO_PTS(), luck: 3 },
        heroGainDpsPct: 0,
        rosterGainObjective: 0,
        resetCostGold: 20_000,
      },
      {
        heroId: 'h-place',
        ptsBefore: ZERO_PTS(),
        pts: { ...ZERO_PTS(), energy: 2 },
        heroGainDpsPct: 0,
        rosterGainObjective: 0,
        resetCostGold: 0,
      },
      {
        heroId: 'h-changed',
        // The plan assumed h-changed started at zero — the live account (built with `attack: 2`
        // already spent) matches neither zero nor this baseline, so the preflight reads it as a
        // conflict rather than a pending commit.
        ptsBefore: ZERO_PTS(),
        pts: { ...ZERO_PTS(), attack: 5 },
        heroGainDpsPct: 0,
        rosterGainObjective: 0,
        resetCostGold: 20_000,
      },
    ],
    perHero: [],
    proposedLoadouts: {},
    regime: 'underSaturated',
    sumDuty: 0,
    slots: 6,
    currentDps: 0,
    planDps: 0,
    forgeFloorApplied: 3,
    allowedChanges: 'both',
    scoredPhase: null,
    scoredPhaseSource: 'account',
    scoredPhaseInfeasible: false,
    gearBreakdown: { forgeDelta: 0, moveDelta: 0 },
    requiresFullPlan: false,
    gearDipDps: 0,
    runedHeroNames: [],
    run: { rounds: 0, evaluations: 0, budgetExhausted: false, elapsedMs: 0, seedUsed: 'current' },
    ...overrides,
  };
}

function facts(payloadOverrides: Partial<AccountPayload> = {}, planOverrides: Partial<TeamPlan> = {}) {
  return buildApplyFacts({
    plan: fixturePlan(planOverrides),
    planHeroes: null,
    liveView: viewOf(basePayload(payloadOverrides)),
    t: en,
    locale: 'en',
  });
}

describe('buildApplyFacts — the ledger', () => {
  it('every figure matches a hand computation for the fixture plan', () => {
    const result = facts();
    // Equip: 4 units (unequip i-move, equip i-move, equip i-bag, equip i-ready), all free —
    // the ledger counts every derived call, not only the ones the live preflight still allows.
    expect(result.ledger.equip).toEqual({ calls: 4, estimatedMs: estimateApplyDurationMs(4) });
    // Points: h-respec needs a respec (2 calls), h-place and h-changed place only (1 call each) = 4 calls.
    expect(result.ledger.points.calls).toBe(4);
    expect(result.ledger.points.heroes).toBe(3);
    expect(result.ledger.points.respecs).toBe(1);
    expect(result.ledger.points.goldExact).toBe(40_000);
    // Forge: i-move climbs 3 → 6, priced against the live item (upgrade 3, level 20, rarity 2).
    expect(result.ledger.forge.pieces).toBe(1);
    expect(result.ledger.forge.goldExpected).not.toBeNull();
    expect(result.ledger.totalGold).toBe(40_000 + (result.ledger.forge.goldExpected ?? 0));
  });

  it('reads wallet before -> after from the live account, both finite', () => {
    const result = facts({ account: { phase: 60, max_phase: 88, gold: 100_000 } });
    expect(result.ledger.walletBefore).toBe(100_000);
    expect(result.ledger.walletAfter).toBe(100_000 - result.ledger.totalGold);
  });

  it('a wallet the account did not carry as a finite number leaves walletAfter null too', () => {
    const result = facts({ account: { phase: 60, max_phase: 88 } });
    expect(result.ledger.walletBefore).toBeNull();
    expect(result.ledger.walletAfter).toBeNull();
  });

  it('forge reads "no estimate" (goldExpected null) when the piece cannot be priced', () => {
    const result = facts({ items: [] }, { forgeList: [{ itemId: 'unpriceable', defId: 'x', from: 3, to: 6 }] });
    expect(result.ledger.forge.goldExpected).toBeNull();
  });
});

describe('buildApplyFacts — step facts', () => {
  it('the equip step counts only the pending calls (three of the four units conflict), no gold, no heroes, no respecs', () => {
    const step = facts().steps.equip;
    if (step.kind !== 'units') throw new Error('expected units');
    expect(step.units).toHaveLength(4);
    expect(step.calls).toBe(1);
    expect(step.aboutMs).toBe(estimateApplyDurationMs(1));
    expect(step.gold).toBe(0);
    expect(step.heroes).toBe(0);
    expect(step.respecs).toBe(0);
  });

  it('the points step counts heroes, respecs, calls and exact gold over the pending units', () => {
    const step = facts().steps.points;
    if (step.kind !== 'units') throw new Error('expected units');
    expect(step.heroes).toBe(3);
    expect(step.respecs).toBe(1);
    expect(step.calls).toBe(4);
    expect(step.gold).toBe(40_000);
  });

  it('an empty step reads "nothing"', () => {
    const step = facts({}, { moveList: [] }).steps.equip;
    expect(step).toEqual({ kind: 'nothing' });
  });

  it('the equip step carries a skip for the missing piece and a skip for the moved piece', () => {
    const step = facts().steps.equip;
    if (step.kind !== 'units') throw new Error('expected units');
    const reasons = step.skips.map((skip) => skip.reason);
    expect(reasons).toContain('itemMissing');
    expect(reasons).toContain('itemMoved');
  });

  it('the points step carries an allocationChanged skip for the hero whose live points moved', () => {
    const step = facts().steps.points;
    if (step.kind !== 'units') throw new Error('expected units');
    const changedUnit = step.units.find((unit) => unit.subject === 'Changed Hero');
    expect(changedUnit).toBeDefined();
    const skip = step.skips.find((s) => s.index === changedUnit?.index);
    expect(skip?.reason).toBe('allocationChanged');
  });

  const FUNDED_ACCOUNT = { phase: 60, max_phase: 88, gold: 100_000 };
  const RESPEC_UNREAD_PLAN: Partial<TeamPlan> = {
    moveList: [],
    pointResets: [
      {
        heroId: 'h-respec',
        ptsBefore: { ...ZERO_PTS(), attack: 3 },
        pts: { ...ZERO_PTS(), luck: 3 },
        heroGainDpsPct: 0,
        rosterGainObjective: 0,
        resetCostGold: 20_000,
      },
    ],
  };

  it('a hero still on the roster whose spent points the read could not recover is pending, never "no longer on the roster"', () => {
    // A hero whose sheet inverts to more points than its level grants is held on the roster with a
    // zeroed `pts` — what a stats read one equip ahead of the items read produces on every hero
    // the gear just moved on. The optimizer leaves that hero out of its own inputs, but the plan
    // was solved while it was readable, so its reset is still a unit here.
    const step = facts(
      { account: FUNDED_ACCOUNT, heroes: [rawHero('h-respec', 'Respec Hero', 5, { ...ZERO_PTS(), attack: 6 })] },
      RESPEC_UNREAD_PLAN,
    ).steps.points;
    if (step.kind !== 'units') throw new Error('expected units');
    expect(step.skips).toEqual([]);
    expect(step.pending).toEqual([0]);
  });

  it('a hero the live roster no longer holds is the one and only heroMissing skip', () => {
    const step = facts({ account: FUNDED_ACCOUNT, heroes: [rawHero('h1', 'Orin', 20)] }, RESPEC_UNREAD_PLAN).steps.points;
    if (step.kind !== 'units') throw new Error('expected units');
    expect(step.skips).toEqual([{ index: 0, reason: 'heroMissing' }]);
    expect(step.pending).toEqual([]);
  });
});

describe('groupSkips', () => {
  it('counts and groups by reason', () => {
    const skips: readonly { reason: RowSkipReason }[] = [
      { reason: 'itemMissing' },
      { reason: 'itemMissing' },
      { reason: 'allocationChanged' },
    ];
    const grouped = groupSkips(skips);
    expect(grouped.count).toBe(3);
    expect(grouped.groups).toEqual([
      { reason: 'itemMissing', count: 2 },
      { reason: 'allocationChanged', count: 1 },
    ]);
  });
});

describe('walletShortHeroes', () => {
  const units: readonly ApplyPointsUnit[] = [
    { index: 0, heroId: 'h-respec', level: 20, needsRespec: true, respecGold: 20_000, vectorBefore: ZERO_PTS() as never, vector: ZERO_PTS() as never, pointsPlaced: 3 },
    { index: 1, heroId: 'h-place', level: 20, needsRespec: false, respecGold: 0, vectorBefore: ZERO_PTS() as never, vector: ZERO_PTS() as never, pointsPlaced: 2 },
  ];

  it('names the hero a respec the wallet cannot cover, with what is needed and on hand', () => {
    const short = walletShortHeroes(units, 5_000, [], new Map());
    expect(short).toEqual([{ index: 0, heroId: 'h-respec', name: 'h-respec', needed: 20_000, onHand: 5_000 }]);
  });

  it('never names anyone when the wallet is not a finite number', () => {
    expect(walletShortHeroes(units, null, [], new Map())).toEqual([]);
  });

  it('never names a place-only hero — a respec-free placement is never charged', () => {
    const short = walletShortHeroes(units, 0, [], new Map());
    expect(short.map((s) => s.heroId)).toEqual(['h-respec']);
  });
});

describe('stepGate precedence', () => {
  const nothingFacts: StepFacts = { kind: 'nothing' };
  const readyFacts: StepFacts = {
    kind: 'units',
    units: [{ index: 0, call: 'equip', subject: 'x', from: null, to: 'h1', points: null, gold: 0 }],
    pending: [0],
    done: [],
    skips: [],
    calls: 1,
    aboutMs: 1,
    gold: 0,
    heroes: 0,
    respecs: 0,
  };
  const allDoneFacts: StepFacts = { ...readyFacts, pending: [], done: [0] };
  const nothingLeftFacts: StepFacts = { ...readyFacts, pending: [], done: [] };

  const baseCtx = { forgeWritesEnabled: true, isStale: false, anyStepApplied: false, running: null, queueRunning: false };

  it('another step running beats everything else', () => {
    expect(stepGate(readyFacts, 'equip', { ...baseCtx, forgeWritesEnabled: false, running: 'points' })).toEqual({
      enabled: false,
      reason: 'otherRunning',
    });
  });

  it('the switch off gate disables equip/points but never forge', () => {
    expect(stepGate(readyFacts, 'equip', { ...baseCtx, forgeWritesEnabled: false })).toEqual({ enabled: false, reason: 'switchOff' });
    expect(stepGate(readyFacts, 'points', { ...baseCtx, forgeWritesEnabled: false })).toEqual({ enabled: false, reason: 'switchOff' });
    expect(stepGate(readyFacts, 'forge', { ...baseCtx, forgeWritesEnabled: false })).not.toEqual({ enabled: false, reason: 'switchOff' });
  });

  it('a stale plan disables every row only before any step of this run id has applied', () => {
    expect(stepGate(readyFacts, 'equip', { ...baseCtx, isStale: true, anyStepApplied: false })).toEqual({ enabled: false, reason: 'stale' });
    expect(stepGate(readyFacts, 'equip', { ...baseCtx, isStale: true, anyStepApplied: true })).toEqual({ enabled: true, notes: [] });
  });

  it('nothing to do, all done and nothing left are each their own reason', () => {
    expect(stepGate(nothingFacts, 'equip', baseCtx)).toEqual({ enabled: false, reason: 'nothing' });
    expect(stepGate(allDoneFacts, 'equip', baseCtx)).toEqual({ enabled: false, reason: 'allDone' });
    expect(stepGate(nothingLeftFacts, 'equip', baseCtx)).toEqual({ enabled: false, reason: 'nothingLeft' });
  });

  it('ready notes pausesQueue for equip/points while the forge queue runs, never for forge itself', () => {
    expect(stepGate(readyFacts, 'equip', { ...baseCtx, queueRunning: true })).toEqual({ enabled: true, notes: ['pausesQueue'] });
    expect(stepGate(readyFacts, 'forge', { ...baseCtx, queueRunning: true })).toEqual({ enabled: true, notes: [] });
  });

  it("stepGate('forge', …) ignores forgeWritesEnabled and evaluates only otherRunning and stale", () => {
    const switchOffCtx = { ...baseCtx, forgeWritesEnabled: false };
    expect(stepGate(readyFacts, 'forge', switchOffCtx)).toEqual({ enabled: true, notes: [] });
    expect(stepGate(readyFacts, 'forge', { ...switchOffCtx, running: 'equip' as const })).toEqual({ enabled: false, reason: 'otherRunning' });
    expect(stepGate(readyFacts, 'forge', { ...switchOffCtx, isStale: true, anyStepApplied: false })).toEqual({ enabled: false, reason: 'stale' });
  });
});

describe('nextUndoneStep', () => {
  const allIdle: Record<ApplyStepId, { status: string }> = {
    equip: { status: 'idle' },
    points: { status: 'idle' },
    forge: { status: 'idle' },
  };

  it('picks equip first when nothing has run yet — the order the rows are drawn in', () => {
    expect(nextUndoneStep(allIdle, null)).toBe('equip');
  });

  it('skips a done step and picks the next undone one — forge, once equip is done', () => {
    const equipDone = { ...allIdle, equip: { status: 'done' } };
    expect(nextUndoneStep(equipDone, null)).toBe('forge');
  });

  it('the forge key counts as undone while idle', () => {
    const onlyForgeLeft = { equip: { status: 'done' }, points: { status: 'done' }, forge: { status: 'idle' } };
    expect(nextUndoneStep(onlyForgeLeft, null)).toBe('forge');
  });

  it('points comes last, once equip and forge are done', () => {
    const onlyPointsLeft = { equip: { status: 'done' }, points: { status: 'idle' }, forge: { status: 'done' } };
    expect(nextUndoneStep(onlyPointsLeft, null)).toBe('points');
  });

  it('returns null once every step is done', () => {
    const allDone = { equip: { status: 'done' }, points: { status: 'done' }, forge: { status: 'done' } };
    expect(nextUndoneStep(allDone, null)).toBeNull();
  });
});

describe('unitLabels — frozen at confirm time', () => {
  it("an equip unit's label names where it came from, its item and where it is going", () => {
    const view = viewOf(basePayload());
    const [label] = unitLabels(
      [{ index: 0, call: 'equip', itemId: 'i-move', defId: 'sword', slot: 'weapon', fromHeroId: 'h1', toHeroId: 'h2', displacesItemId: null, freedByIndex: null, pendingAt: [], doneAt: [] }],
      null,
      view,
      'en',
    );
    expect(label).toMatchObject({ call: 'equip', from: 'Orin', to: 'Bram' });
    expect(label?.subject).toContain('+3');
  });

  it("a points unit's label carries the hero's name, the points it places and its respec gold", () => {
    const view = viewOf(basePayload());
    const [label] = unitLabels(
      [{ index: 0, heroId: 'h-respec', level: 20, needsRespec: true, respecGold: 20_000, vectorBefore: ZERO_PTS() as never, vector: { ...ZERO_PTS(), luck: 3 } as never, pointsPlaced: 3 }],
      null,
      view,
      'en',
    );
    expect(label).toMatchObject({ call: 'respec', subject: 'Respec Hero', points: 3, gold: 20_000 });
  });
});

describe('buildApplyFacts — the forge row', () => {
  it("hands the live pool's gear, not the plan's frozen snapshot", () => {
    const result = facts();
    // i-move's live upgrade is 3 (the fixture's item record) — a forgeRow built from the plan's
    // own snapshot (which knows nothing of "upgrade") could not carry this at all.
    const piece = result.forgeRow.gear.find((item) => item.id === 'i-move');
    expect(piece?.upgrade).toBe(3);
  });
});
