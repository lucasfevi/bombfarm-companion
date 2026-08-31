import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFarmRespecDepTuple, type FarmInputs } from '@bombfarm/farm/core';
import type { FarmRespecProposal } from '@bombfarm/farm';
import type { FarmRespecResult } from '@bombfarm/domain/farm-optimize';
import {
  acceptRespec,
  freshProposal,
  initialFarmRespecState,
  reRankActive,
  type FarmRespecState,
} from './farm-respec-store';

/** Only the 19 tuple members matter here; nothing below reads a rate or a hero. */
function inputsWith(overrides: Partial<FarmInputs> = {}): FarmInputs {
  return {
    heroes: [],
    treeDanoTotal: 0,
    treeCritChance: 0,
    treeCritDmg: 0,
    treeSpeed: 0,
    treeEnergy: 0,
    treeTeamCoinPct: 0,
    treeLuckFlatPct: 0,
    effectiveTeamBuffs: {},
    teamBuffsOverride: null,
    houseIdx: 0,
    houseLevel: 1,
    slots: undefined,
    fieldSlots: null,
    houseCycleSecs: null,
    houseCycleSecsHouseIdx: 0,
    houseCycleSecsLevel: 1,
    maxPhase: null,
    farmPoolOverrides: {},
    farmReturnBonus: 'off',
    ...overrides,
  };
}

const RESULT = { gainPct: 12 } as FarmRespecResult;

function proposalFor(inputs: FarmInputs): FarmRespecProposal {
  return { deps: readFarmRespecDepTuple(inputs), result: RESULT };
}

function solved(inputs: FarmInputs): FarmRespecState {
  return acceptRespec(acceptRespec(initialFarmRespecState, { kind: 'solving' }), {
    kind: 'solved',
    proposal: proposalFor(inputs),
  });
}

describe('the solve lifecycle', () => {
  it('starts idle with nothing to show', () => {
    expect(initialFarmRespecState).toEqual({
      proposal: null,
      status: 'idle',
      panelOpen: false,
      reRank: false,
    });
  });

  it('pressing Optimize opens the panel and marks the solve running', () => {
    const state = acceptRespec(initialFarmRespecState, { kind: 'solving' });
    expect(state.status).toBe('solving');
    expect(state.panelOpen).toBe(true);
  });

  it('a second solving arrival while one runs changes nothing — no concurrent second run', () => {
    const running = acceptRespec(initialFarmRespecState, { kind: 'solving' });
    expect(acceptRespec(running, { kind: 'solving' })).toBe(running);
  });

  it('a failure names itself and shows no proposal', () => {
    const failed = acceptRespec(solved(inputsWith()), { kind: 'failed' });
    expect(failed.status).toBe('failed');
    expect(failed.proposal).toBeNull();
  });

  it('closing the panel is a no-op when it is already closed', () => {
    const state = solved(inputsWith());
    const closed = acceptRespec(state, { kind: 'panel', open: false });
    expect(acceptRespec(closed, { kind: 'panel', open: false })).toBe(closed);
  });

  it('turning re-rank on closes the panel, and turning it off re-opens it — neither re-solves', () => {
    const state = solved(inputsWith());
    const reRanking = acceptRespec(state, { kind: 'rerank', active: true });
    expect(reRanking.reRank).toBe(true);
    expect(reRanking.panelOpen).toBe(false);
    expect(reRanking.proposal).toBe(state.proposal);

    const back = acceptRespec(reRanking, { kind: 'rerank', active: false });
    expect(back.panelOpen).toBe(true);
    expect(back.proposal).toBe(state.proposal);
  });
});

describe('a proposal is renderable only against the inputs it was solved from', () => {
  it('is handed back for the inputs it was solved from', () => {
    const inputs = inputsWith();
    const state = solved(inputs);
    expect(freshProposal(state, inputs)).toBe(state.proposal);
  });

  it('an equal-by-value tuple read again is still the same proposal — a re-render is not an edit', () => {
    // The three members compared by REFERENCE, held so both records carry the same ones.
    const byReference = {
      heroes: [] as FarmInputs['heroes'],
      effectiveTeamBuffs: {} as FarmInputs['effectiveTeamBuffs'],
      farmPoolOverrides: {},
    };
    const state = solved(inputsWith(byReference));
    // What a second read of the same account produces: a fresh record over the very same members.
    expect(freshProposal(state, inputsWith(byReference))).toBe(state.proposal);
  });

  it('any tuple member moving makes it unrenderable, with no arrival needed to clear it', () => {
    const state = solved(inputsWith());
    expect(freshProposal(state, inputsWith({ farmReturnBonus: 'vip' }))).toBeNull();
    expect(freshProposal(state, inputsWith({ maxPhase: 40 }))).toBeNull();
    // A recompute rebuilds the roster array; a fresh-but-equal reference is a real edit here.
    expect(freshProposal(state, inputsWith({ heroes: [] }))).toBeNull();
  });

  it('the status still reads done — freshness is a derivation, never a second write path', () => {
    const state = solved(inputsWith());
    expect(state.status).toBe('done');
    expect(freshProposal(state, inputsWith({ farmReturnBonus: 'vip' }))).toBeNull();
  });

  it('there is no proposal at all before a solve, and none without inputs', () => {
    expect(freshProposal(initialFarmRespecState, inputsWith())).toBeNull();
    expect(freshProposal(solved(inputsWith()), null)).toBeNull();
  });
});

describe('re-rank never outlives the proposal it re-ranks by', () => {
  it('is active only while the proposal is fresh', () => {
    const inputs = inputsWith();
    const reRanking = acceptRespec(solved(inputs), { kind: 'rerank', active: true });
    expect(reRankActive(reRanking, inputs)).toBe(true);
    expect(reRankActive(reRanking, inputsWith({ farmReturnBonus: 'vip' }))).toBe(false);
  });

  it('is false while the flag is off, fresh proposal or not', () => {
    const inputs = inputsWith();
    expect(reRankActive(solved(inputs), inputs)).toBe(false);
  });
});

describe('the staleness mechanism is the shared one, not a second copy', () => {
  const source = readFileSync(path.join(__dirname, 'farm-respec-store.ts'), 'utf8');

  it('compares the package\'s own dependency tuple with the package\'s own comparator', () => {
    expect(source).toMatch(/farmDepsEqual\(\s*state\.proposal\.deps,\s*readFarmRespecDepTuple\(inputs\)/);
  });

  it('has no comparison of its own — no timestamp, no counter, no deep equality', () => {
    expect(source).not.toMatch(/Date\.now|JSON\.stringify|generation|version\b/);
  });
});
