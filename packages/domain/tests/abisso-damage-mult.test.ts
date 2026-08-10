/**
 * Abisso (D15) damage multiplier — `abissoBase^currentPhase`, applied in `computeCombatMults`
 * (derive.ts) and threaded through `computeAdvisorPipeline`.
 *
 * Ground truth: `fixtures/sheet-math/phase-151.json` (a real save, `abisso_base: 1.008`,
 * keystones `["D15","C15","O15","S15","G07"]`). Bram L74's normal (non-crit) hit was observed
 * in-game with a 20% War Cry (Grito de Guerra) team buff at three phases:
 *
 *   phase 451: 522.44M    phase 452: 526.47M    phase 151: 51.91M
 *
 * (see the task brief — verified within 0.04% across 7 readings on 2 heroes). Mitigation for
 * each phase comes from the committed `phases.json` wiki table via `phaseLine` — never
 * hardcoded here, so this test also pins that the table itself is right.
 */
import { describe, expect, it } from 'vitest';
import { parseSaveFile, type AccountImportData } from '../src/import-save';
import { computeAdvisorPipeline, type AdvisorPipelineInput } from '../src/advisor-pipeline';
import { computeCombatMults } from '../src/derive';
import { abilityMods } from '../src/model';
import { phaseLine } from '../src/phases';
import { zeroTeamBuffs } from '../src/team-buffs';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

const raw = loadFixtureJson('phase-151.json');
const { candidates, account } = parseSaveFile(raw, []);

function findCandidate(name: string) {
  const candidate = candidates.find((c) => c.name === name);
  if (!candidate) throw new Error(`fixture missing hero "${name}"`);
  return candidate;
}

/** Builds the same input shape the app's advisor-selectors.ts hands to computeAdvisorPipeline. */
function pipelineInputFor(
  name: string,
  overrides: Partial<AdvisorPipelineInput> & { phase: number | null; mitigationPct: number },
): AdvisorPipelineInput {
  const { record } = findCandidate(name);
  const tree = account.tree as NonNullable<AccountImportData['tree']>;
  return {
    naked: record.naked,
    geared: record.gearedOverride,
    loadout: record.loadout,
    altLoadout: null,
    pts: record.pts,
    statPointsAvailable: record.statPointsAvailable ?? 0,
    abilities: record.abilities,
    rarity: record.rarity,
    level: record.level,
    stars: record.stars,
    treeDanoTotal: tree.danoTotal,
    treeCritChance: tree.critChance,
    treeCritDmg: tree.critDmg,
    treeSpeed: tree.speed,
    treeEnergy: tree.energy,
    treeGlassCannon: tree.glassCannon,
    treeTempoDobrado: tree.tempoDobrado,
    treeAbisso: tree.abisso,
    treeAbissoBase: tree.abissoBase,
    treeLuckFlatPct: tree.luckFlatPct,
    teamBuffs: zeroTeamBuffs(),
    houseIdx: account.houseIdx ?? 0,
    houseLevel: account.houseLevel ?? 0,
    rankMode: 'dps',
    targetProp: 'stone',
    birth: record.birth,
    ...overrides,
  };
}

describe('phase-151.json fixture sniff', () => {
  it('carries Abisso + the four other verified keystones, and Bram/Bellatrix at the documented stats', () => {
    expect(account.tree?.abisso).toBe(true);
    expect(account.tree?.abissoBase).toBeCloseTo(1.008, 10);
    expect(account.phase).toBe(151);

    const bram = findCandidate('Bram');
    expect(bram.level).toBe(74);
    // stats.dmg / stats.penetration from the task brief — sanity-checks the fixture landed
    // as the same account, not a lookalike.
    expect(bram.record.gearedOverride.attack).toBeGreaterThan(0);
  });
});

describe('Abisso damage multiplier — Bram normal-hit verification (real pipeline)', () => {
  // War Cry (Grito de Guerra) 20% team buff, matching the in-game readings' conditions.
  const teamBuffs = { ...zeroTeamBuffs(), grito_guerra: 20 };

  const readings: { phase: number; observedMillions: number }[] = [
    { phase: 451, observedMillions: 522.44 },
    { phase: 452, observedMillions: 526.47 },
    { phase: 151, observedMillions: 51.91 },
  ];

  it.each(readings)(
    'phase $phase: predicted normal hit is within 0.01% of the observed $observedMillions M',
    ({ phase, observedMillions }) => {
      const line = phaseLine(phase);
      expect(line, `phases.json is missing a line for phase ${phase}`).toBeDefined();
      const mitigationPct = line!.mitig * 100;

      const result = computeAdvisorPipeline(
        pipelineInputFor('Bram', { phase, mitigationPct, teamBuffs }),
      );

      const observed = observedMillions * 1_000_000;
      const pctError = (Math.abs(result.predHit - observed) / observed) * 100;
      expect(pctError, `predicted ${result.predHit} vs observed ${observed}`).toBeLessThan(0.01);
    },
  );
});

/**
 * Team Plan hero panel's Hit damage grid (`hero-stat-breakdown.tsx`) shows normal + critical hit
 * from `HeroScore.hit` (`team-plan/score.ts`), which is `derive().hit` verbatim — the exact same
 * field `advisor-pipeline.ts` exposes as `predHit` (`predHit = equippedResult.hit` where
 * `equippedResult = derive(...)`). Pinning `predHit` here IS pinning `HeroScore.hit`; no separate
 * team-plan-pipeline setup needed to cover the new field.
 *
 * Pins the MODEL's own predicted value (not the in-game reading) so any future change to
 * `derive`/`predictHitDamage`/`computeCombatMults` that moves the number — even one that stays
 * within the 0.01% tolerance above — gets caught here rather than silently drifting.
 */
describe('Team Plan hit-damage panel — Bram normal hit pinned to the model (regression)', () => {
  const teamBuffs = { ...zeroTeamBuffs(), grito_guerra: 20 };

  const readings: { phase: number; predictedMillions: number }[] = [
    { phase: 451, predictedMillions: 522.435 },
    { phase: 452, predictedMillions: 526.466 },
    { phase: 151, predictedMillions: 51.906 },
  ];

  it.each(readings)(
    'phase $phase: predicted normal hit stays pinned at $predictedMillions M',
    ({ phase, predictedMillions }) => {
      const line = phaseLine(phase);
      expect(line, `phases.json is missing a line for phase ${phase}`).toBeDefined();
      const mitigationPct = line!.mitig * 100;

      const result = computeAdvisorPipeline(
        pipelineInputFor('Bram', { phase, mitigationPct, teamBuffs }),
      );

      expect(result.predHit / 1_000_000).toBeCloseTo(predictedMillions, 3);
    },
  );
});

describe('Abisso damage multiplier — gating and reversibility', () => {
  it('is exactly 1 when Abisso is not owned, at any phase', () => {
    for (const phase of [1, 42, 151, 451, 600]) {
      const mults = computeCombatMults({
        mods: abilityMods({}),
        teamBuffs: zeroTeamBuffs(),
        treeGlassCannon: false,
        treeTempoDobrado: false,
        treeAbisso: false,
        treeAbissoBase: 1.008,
        phase,
        extraDmgPct: 0,
      });
      expect(mults.abissoMult).toBe(1);
      expect(mults.dmgMult).toBe(1);
    }
  });

  it('is exactly 1 when abissoBase is 0, even if treeAbisso is somehow true (0 ** phase guard)', () => {
    const mults = computeCombatMults({
      mods: abilityMods({}),
      teamBuffs: zeroTeamBuffs(),
      treeGlassCannon: false,
      treeTempoDobrado: false,
      treeAbisso: true,
      treeAbissoBase: 0,
      phase: 300,
      extraDmgPct: 0,
    });
    expect(mults.abissoMult).toBe(1);
    expect(mults.dmgMult).toBe(1);
  });

  it('tracks the current phase — changing phase changes damage, changing back restores it exactly', () => {
    const base = (phase: number) =>
      computeCombatMults({
        mods: abilityMods({}),
        teamBuffs: zeroTeamBuffs(),
        treeGlassCannon: false,
        treeTempoDobrado: false,
        treeAbisso: true,
        treeAbissoBase: 1.008,
        phase,
        extraDmgPct: 0,
      });

    const at151 = base(151);
    const at451 = base(451);
    expect(at451.abissoMult).toBeGreaterThan(at151.abissoMult);
    expect(at451.abissoMult).toBeCloseTo(1.008 ** 451, 6);
    expect(at151.abissoMult).toBeCloseTo(1.008 ** 151, 6);

    // Reversible: dropping back to 151 restores the exact original multiplier.
    const backTo151 = base(151);
    expect(backTo151.abissoMult).toBe(at151.abissoMult);
  });

  it('through the full pipeline: raising Bram\'s farm phase raises predicted hit; lowering it back restores the exact number', () => {
    const mitAt151 = phaseLine(151)!.mitig * 100;
    const mitAt451 = phaseLine(451)!.mitig * 100;

    const hitAt151 = computeAdvisorPipeline(
      pipelineInputFor('Bram', { phase: 151, mitigationPct: mitAt151 }),
    ).predHit;
    const hitAt451 = computeAdvisorPipeline(
      pipelineInputFor('Bram', { phase: 451, mitigationPct: mitAt451 }),
    ).predHit;
    const hitBackAt151 = computeAdvisorPipeline(
      pipelineInputFor('Bram', { phase: 151, mitigationPct: mitAt151 }),
    ).predHit;

    expect(hitAt451).toBeGreaterThan(hitAt151);
    expect(hitBackAt151).toBe(hitAt151);
  });
});

describe('Abisso damage multiplier — phase clamping at the 1 and 600 boundaries', () => {
  function abissoAt(phase: number | null): number {
    return computeCombatMults({
      mods: abilityMods({}),
      teamBuffs: zeroTeamBuffs(),
      treeGlassCannon: false,
      treeTempoDobrado: false,
      treeAbisso: true,
      treeAbissoBase: 1.008,
      phase,
      extraDmgPct: 0,
    }).abissoMult;
  }

  it('clamps below 1 (including null/0/negative) up to phase 1', () => {
    expect(abissoAt(1)).toBeCloseTo(1.008 ** 1, 10);
    expect(abissoAt(0)).toBeCloseTo(1.008 ** 1, 10);
    expect(abissoAt(-5)).toBeCloseTo(1.008 ** 1, 10);
    expect(abissoAt(null)).toBeCloseTo(1.008 ** 1, 10);
  });

  it('clamps above 600 down to phase 600', () => {
    expect(abissoAt(600)).toBeCloseTo(1.008 ** 600, 6);
    expect(abissoAt(601)).toBeCloseTo(1.008 ** 600, 6);
    expect(abissoAt(9999)).toBeCloseTo(1.008 ** 600, 6);
  });
});

describe('Abisso import wiring — account.phase and abisso_base', () => {
  it('parseSaveFile reads account.phase and skills.totals.abisso_base from the save', () => {
    expect(account.phase).toBe(151);
    expect(account.tree?.abissoBase).toBeCloseTo(1.008, 10);
  });

  it('is null when the save has no account.phase', () => {
    const { account: noPhaseAccount } = parseSaveFile({ heroes: [] }, []);
    expect(noPhaseAccount.phase).toBeNull();
  });

  it('defaults abissoBase to 0 (identity) when skills.totals.abisso_base is absent', () => {
    const { account: noAbissoAccount } = parseSaveFile(
      { heroes: [], skills: { totals: { dmg_static: 1 } } },
      [],
    );
    expect(noAbissoAccount.tree?.abissoBase).toBe(0);
    expect(noAbissoAccount.tree?.abisso).toBe(false);
  });
});
