import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import {
  loadTeamPlanEnvelope,
  removeTeamPlanEnvelope,
  saveTeamPlanEnvelope,
  TEAM_PLAN_KEY,
  type TeamPlanEnvelope,
} from '@/shared/lib/team-plan-storage';

function memoryLocalStorage(opts?: { throwOnSet?: boolean }) {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (opts?.throwOnSet) throw new Error('QuotaExceededError');
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

function samplePlan(): TeamPlan {
  return {
    steps: [],
    forgeList: [],
    moveList: [],
    pointResets: [],
    perHero: [],
    proposedLoadouts: {},
    regime: 'underSaturated',
    sumDuty: 1,
    slots: 3,
    currentDps: 100,
    planDps: 120,
    forgeFloorApplied: 10,
    allowedChanges: 'both',
    scoredPhase: 51,
    scoredPhaseSource: 'account',
    scoredPhaseInfeasible: false,
    gearBreakdown: { forgeDelta: 0, moveDelta: 0 },
    requiresFullPlan: false,
    gearDipDps: 0,
    runedHeroNames: [],
    run: { rounds: 1, evaluations: 1, budgetExhausted: false, elapsedMs: 1, seedUsed: 'seed' },
  };
}

function sampleEnvelope(targetPhase: number | null = null): TeamPlanEnvelope {
  return {
    version: 1,
    signature: 'sig-1',
    objective: 'farm',
    allowedChanges: 'both',
    ignoreFieldCrowding: false,
    targetPhase,
    plan: samplePlan(),
  };
}

const PLAN_MEMBERS = [
  'steps',
  'forgeList',
  'moveList',
  'pointResets',
  'perHero',
  'currentDps',
  'planDps',
  'scoredPhaseSource',
] as const;

function envelopeWithout(field: keyof TeamPlanEnvelope): string {
  const { [field]: _dropped, ...rest } = sampleEnvelope();
  return JSON.stringify(rest);
}

function envelopeWithoutPlanMember(member: (typeof PLAN_MEMBERS)[number]): string {
  const envelope = sampleEnvelope();
  const { [member]: _dropped, ...plan } = envelope.plan;
  return JSON.stringify({ ...envelope, plan });
}

describe('team plan envelope storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads no plan from an absent key, broken JSON, an array, the wrong version, a plan missing any of its eight members, or a bad control, and never throws', () => {
    const rows: Array<[string, string | null]> = [
      ['absent key', null],
      ['broken JSON', '{'],
      ['an array', '[]'],
      ['the wrong version', JSON.stringify({ version: 2 })],
      ['signature missing', envelopeWithout('signature')],
      ['non-string signature', JSON.stringify({ ...sampleEnvelope(), signature: 7 })],
      ['plan missing', envelopeWithout('plan')],
      ['empty plan', JSON.stringify({ version: 1, plan: {} })],
      ...PLAN_MEMBERS.map(
        (member): [string, string] => [`plan without ${member}`, envelopeWithoutPlanMember(member)],
      ),
      ['bad objective', JSON.stringify({ ...sampleEnvelope(), objective: 'gold' })],
      ['bad allowed changes', JSON.stringify({ ...sampleEnvelope(), allowedChanges: 'everything' })],
      ['non-boolean crowding flag', JSON.stringify({ ...sampleEnvelope(), ignoreFieldCrowding: 'yes' })],
      ['string target phase', JSON.stringify({ ...sampleEnvelope(), targetPhase: '51' })],
    ];
    expect(rows).toHaveLength(20);

    for (const [label, stored] of rows) {
      localStorage.clear();
      if (stored !== null) localStorage.setItem(TEAM_PLAN_KEY, stored);
      expect(() => loadTeamPlanEnvelope(), label).not.toThrow();
      expect(loadTeamPlanEnvelope(), label).toBeNull();
    }
  });

  it('reads back exactly what it wrote', () => {
    for (const targetPhase of [null, 51]) {
      const envelope = sampleEnvelope(targetPhase);
      expect(saveTeamPlanEnvelope(envelope)).toBe(true);
      expect(loadTeamPlanEnvelope()).toEqual(envelope);
      expect(loadTeamPlanEnvelope()?.targetPhase).toBe(targetPhase);
    }
  });

  it('removes the key on request and returns false when the write fails', () => {
    saveTeamPlanEnvelope(sampleEnvelope());
    expect(localStorage.getItem(TEAM_PLAN_KEY)).not.toBeNull();
    removeTeamPlanEnvelope();
    expect(localStorage.getItem(TEAM_PLAN_KEY)).toBeNull();

    vi.stubGlobal('localStorage', memoryLocalStorage({ throwOnSet: true }));
    expect(() => saveTeamPlanEnvelope(sampleEnvelope())).not.toThrow();
    expect(saveTeamPlanEnvelope(sampleEnvelope())).toBe(false);
  });
});
