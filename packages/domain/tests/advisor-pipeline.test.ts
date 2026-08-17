import { describe, expect, it, beforeEach } from 'vitest';
import { findGateCandidate, type Context } from '@bombfarm/domain/model';
import { applyGear, emptyLoadout, type Loadout, type SheetStats } from '@bombfarm/domain/gear';
import { ZERO_PTS, GATES } from '@bombfarm/domain/planner-constants';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { PROPS, propHp, hitsToKill, oneshotGapPct } from '@bombfarm/domain/phases';
import { gateDamage } from '@bombfarm/domain/model';
import {
  computeAdvisorPipeline,
  energySwitchPointCallCount,
  resetEnergySwitchPointCallCount,
  type AdvisorPipelineInput,
} from '@bombfarm/domain/advisor-pipeline';

const sampleNaked = (): SheetStats => ({
  attack: 200,
  energy: 400,
  speed: 55,
  critChance: 10,
  critDmg: 80,
  penetration: 5,
  cdr: 4,
  luck: 15,
});

function baseInput(overrides: Partial<AdvisorPipelineInput> = {}): AdvisorPipelineInput {
  const naked = sampleNaked();
  return {
    naked,
    geared: { ...naked },
    loadout: emptyLoadout(),
    altLoadout: null,
    pts: ZERO_PTS(),
    abilities: {},
    rarity: 'Comum',
    level: 1,
    stars: 0,
    // No tree by default: `geared: { ...naked }` above is a "no gear, no tree" baseline.
    // BSPW4-04 (AC-33/AC-34) makes `adjusted`/`expectedSheet` genuinely tree-aware, so a
    // nonzero default here would no longer be a no-op the way it was pre-wave (when both
    // sides ignored the tree uniformly) — it would silently make `geared`/`expectedSheet`
    // internally inconsistent for every test that doesn't override `geared`. Tests that
    // want a real tree pass `treeDanoTotal` explicitly (see below).
    treeDanoTotal: 1,
    treeCritChance: 0,
    treeCritDmg: 0,
    treeSpeed: 0,
    treeEnergy: 0,
    treeLuckFlatPct: 0,
    teamBuffs: zeroTeamBuffs(),
    houseIdx: 0,
    houseLevel: 1,
    phase: 1,
    mitigationPct: 6.7,
    rankMode: 'dps',
    targetProp: PROPS[1]?.name ?? PROPS[0].name,
    ...overrides,
  };
}

describe('computeAdvisorPipeline', () => {
  beforeEach(() => {
    resetEnergySwitchPointCallCount();
  });

  it('returns derive A metrics, ranking, expected sheet, and tables', () => {
    const out = computeAdvisorPipeline(baseInput());

    expect(out.dps).toBeGreaterThan(0);
    expect(out.active).toBeGreaterThan(0);
    expect(out.predHit).toBeGreaterThan(0);
    expect(out.ranking).toHaveLength(7);
    expect(out.best.stat).toBe(out.ranking[0].stat);
    expect(out.eSwitch).toBeGreaterThan(10);
    expect(out.eSwitch).toBeLessThan(6000);
    expect(out.expectedSheet.attack).toBeCloseTo(out.adjusted.attack, 6);
    expect(out.propRows).toHaveLength(PROPS.length);
    expect(out.gateRows).toHaveLength(GATES.length);
    expect(out.B).toBeNull();
    expect(out.bDiff).toBe(0);
    expect(energySwitchPointCallCount).toBe(1);
    expect(out.attackMult).toBeGreaterThan(0);
    expect(out.energyMult).toBeGreaterThan(0);
    expect(out.speedMult).toBeGreaterThan(0);
    expect(out.critDmgMult).toBeGreaterThan(0);
    expect(out.teamCritChanceFlat).toBeGreaterThanOrEqual(0);
  });

  it('propRows and gateRows carry correct per-row values, not just correct lengths (T4 extraction guard)', () => {
    const out = computeAdvisorPipeline(baseInput());

    const firstProp = out.propRows[0];
    const expectedHp = propHp(out.stoneHp, PROPS[0].hpMult);
    expect(firstProp.name).toBe(PROPS[0].name);
    expect(firstProp.hp).toBeCloseTo(expectedHp, 6);
    expect(firstProp.hits).toBe(hitsToKill(out.avgHit, expectedHp));
    expect(firstProp.oneshotGapPct).toBeCloseTo(oneshotGapPct(out.avgHit, expectedHp), 6);

    const firstGate = out.gateRows[0];
    expect(firstGate.name).toBe(GATES[0].name);
    expect(firstGate.secs).toBe(GATES[0].secs);
    expect(firstGate.dmg).toBeCloseTo(
      gateDamage(out.effective, out.context, GATES[0].secs) * out.dmgMult * out.gateAttackMult,
      6,
    );
  });

  it('derives B and compare diffs when altLoadout is set', () => {
    const naked = sampleNaked();
    const alt = emptyLoadout();
    // Mark alt as present (empty gear still changes path through applyGear).
    const out = computeAdvisorPipeline(
      baseInput({
        naked,
        geared: { ...naked, attack: naked.attack + 50 },
        altLoadout: alt,
      }),
    );

    expect(out.B).not.toBeNull();
    expect(typeof out.bDiff).toBe('number');
    expect(typeof out.bHitDiff).toBe('number');
  });

  it('reports 0% compare delta when clone loadout matches current (even if sheet ≠ catalog gear)', () => {
    const naked = sampleNaked();
    const loadout: Loadout = emptyLoadout();
    loadout.arma = { defId: 'clay_arma', rarityIdx: 2, level: 40, upgrade: 10 };
    loadout.elmo = { defId: 'clay_elmo', rarityIdx: 2, level: 40, upgrade: 10 };
    const catalogGeared = applyGear(naked, loadout);
    // Typed sheet drifts from catalog math (common with 0.1 display rounding).
    const geared: SheetStats = {
      ...catalogGeared,
      attack: catalogGeared.attack + 1.2,
      speed: catalogGeared.speed + 0.1,
      critChance: catalogGeared.critChance - 0.05,
    };
    const altLoadout = structuredClone(loadout);

    const out = computeAdvisorPipeline(
      baseInput({ naked, geared, loadout, altLoadout }),
    );

    expect(out.B).not.toBeNull();
    expect(out.B!.dps).toBe(out.dps);
    expect(out.B!.hit).toBe(out.predHit);
    expect(out.bDiff).toBe(0);
    expect(out.bHitDiff).toBe(0);
  });

  it('reports a non-zero compare delta when clone gear differs', () => {
    const naked = sampleNaked();
    const loadout: Loadout = emptyLoadout();
    loadout.arma = { defId: 'clay_arma', rarityIdx: 2, level: 40, upgrade: 10 };
    const geared = applyGear(naked, loadout);
    const altLoadout: Loadout = emptyLoadout();
    altLoadout.arma = { defId: 'clay_arma', rarityIdx: 3, level: 40, upgrade: 15 };

    const out = computeAdvisorPipeline(
      baseInput({ naked, geared, loadout, altLoadout }),
    );

    expect(out.B).not.toBeNull();
    expect(out.bDiff).not.toBe(0);
  });

  it('builds a Context matching house rest and fixed serial cycle', () => {
    const out = computeAdvisorPipeline(
      baseInput({ houseIdx: 0, houseLevel: 1, mitigationPct: 10 }),
    );
    const context: Context = out.context;
    expect(context.restSeconds).toBe(19 * 60);
    expect(context.mitigation).toBeCloseTo(0.1, 6);
    expect(context.walkDelay).toBe(0.15);
    expect(context.cycleModel).toBe('serial');
  });

  it('uses phase 1 HP when farm phase is null', () => {
    const phase1 = computeAdvisorPipeline(baseInput({ phase: 1 }));
    const unset = computeAdvisorPipeline(baseInput({ phase: null, mitigationPct: 99 }));
    expect(unset.stoneHp).toBe(phase1.stoneHp);
  });

  it('increments energySwitchPointCallCount on each pipeline call', () => {
    computeAdvisorPipeline(baseInput());
    computeAdvisorPipeline(baseInput({ treeDanoTotal: 1.5 }));
    expect(energySwitchPointCallCount).toBe(2);
  });

  it('keeps adjusted ≈ expectedSheet when points are spent on a catalog-matching geared sheet', () => {
    const naked = sampleNaked();
    const loadout: Loadout = emptyLoadout();
    loadout.arma = { defId: 'clay_arma', rarityIdx: 2, level: 40, upgrade: 10 };
    const geared = applyGear(naked, loadout);
    const pts = { ...ZERO_PTS(), critDmg: 5, attack: 3 };

    // `geared` above is a pure applyGear() catalog projection (no tree folded in), so this
    // needs the identity tree (baseInput()'s default) to stay internally consistent — the
    // test below exercises a real, nonzero tree with a tree-consistent `geared` instead.
    const out = computeAdvisorPipeline(baseInput({ naked, geared, loadout, pts, level: 50 }));

    // Points are layered onto geared in derive — compare adjusted, not raw geared.
    expect(out.adjusted.critDmg).toBeCloseTo(out.expectedSheet.critDmg, 6);
    expect(out.adjusted.attack).toBeCloseTo(out.expectedSheet.attack, 6);
    // Raw geared must stay pre-points (typed Geared column); otherwise Sheet would false-warn.
    expect(out.adjusted.critDmg).toBeGreaterThan(geared.critDmg + 1);
    expect(geared.critDmg).toBeCloseTo(naked.critDmg, 6);
  });

  it('keeps adjusted ≈ expectedSheet under a REAL nonzero tree, when geared is tree-consistent', () => {
    // The regression this test targets: `expectedSheet` must apply the same skill-tree
    // treatment `adjusted` does (both derive.ts's AC-33/AC-34 delta scaling and
    // computeAdvisorPipeline's own expectedSheet computation), or every hero with a spent
    // attack/energy point and a real account tree would show a false "sheet mismatch".
    const naked = sampleNaked();
    const loadout: Loadout = emptyLoadout();
    const danoStatic = 1.78324567735483;
    // A tree-consistent geared sheet: catalog projection × danoStatic (attack only here,
    // since loadout is empty so gear contributes nothing to the other keys either).
    const geared = { ...applyGear(naked, loadout), attack: naked.attack * danoStatic };
    const pts = { ...ZERO_PTS(), attack: 4 };

    const out = computeAdvisorPipeline(baseInput({ naked, geared, loadout, pts, level: 40, treeDanoTotal: danoStatic }));

    expect(out.adjusted.attack).toBeCloseTo(out.expectedSheet.attack, 4);
  });

  it('birth-backed path ignores stale gearedOverride after residual level drift', () => {
    // Residual rescale understates multiplicative tree on the catalog Δ; birth recompose
    // must still keep Points After === compose Total.
    const birth = sampleNaked();
    const level = 61;
    const stars = 1;
    const danoStatic = 1.78324567735483;
    const loadout: Loadout = emptyLoadout();
    const pts = { ...ZERO_PTS(), attack: 56, energy: 1, critDmg: 4 };
    const staleGeared = {
      ...birth,
      // Deliberately wrong post-level residual (understated tree).
      attack: birth.attack * 2.5,
    };
    const staleNaked = { ...birth, attack: birth.attack * 2 };

    const out = computeAdvisorPipeline(
      baseInput({
        birth,
        naked: staleNaked,
        geared: staleGeared,
        loadout,
        pts,
        level,
        stars,
        treeDanoTotal: danoStatic,
      }),
    );

    expect(out.adjusted.attack).toBeCloseTo(out.expectedSheet.attack, 6);
    // Must not follow the stale stored override.
    expect(out.adjusted.attack).not.toBeCloseTo(staleGeared.attack + 1, 0);
  });

  it('birth-backed clone preview DPS matches applying the alt loadout (tree × gear)', () => {
    // reverseGear+applyGear on a tree-inclusive sheet understates/overstates
    // dmg_static and pooled tree adds whenever flat/pool gear changes.
    // Apply to current recomposes from birth — preview must use that same path.
    const birth = sampleNaked();
    const danoStatic = 1.78324567735483;
    const loadout: Loadout = emptyLoadout();
    loadout.peito = { defId: 'clay_peito', rarityIdx: 3, level: 40, upgrade: 10 };
    loadout.arma = { defId: 'crimson_arma', rarityIdx: 1, level: 50, upgrade: 10 };
    const altLoadout: Loadout = emptyLoadout();
    altLoadout.peito = { defId: 'crimson_peito', rarityIdx: 3, level: 50, upgrade: 10 };
    altLoadout.arma = { defId: 'crimson_arma', rarityIdx: 1, level: 50, upgrade: 10 };
    const shared = {
      birth,
      treeDanoTotal: danoStatic,
      treeEnergy: 81.27,
      treeCritChance: 15,
      treeSpeed: 10,
      level: 50,
      stars: 1,
      pts: { ...ZERO_PTS(), attack: 12, energy: 4, critChance: 8 },
    } as const;

    const preview = computeAdvisorPipeline(baseInput({ ...shared, loadout, altLoadout }));
    const applied = computeAdvisorPipeline(
      baseInput({ ...shared, loadout: altLoadout, altLoadout: structuredClone(altLoadout) }),
    );

    expect(preview.B).not.toBeNull();
    expect(preview.B!.dps).toBeCloseTo(applied.dps, 6);
    expect(preview.B!.hit).toBeCloseTo(applied.predHit, 6);
    expect(preview.B!.dps).not.toBeCloseTo(preview.dps, 0);
  });

  it('ranks crit chance at zero gain when the SHEET already fills the 100% cap (BSP-22)', () => {
    // REWRITTEN (was: reached the cap THROUGH `treeCritChance: 25` on top of a naked 80% —
    // `derive` no longer adds a tree addend to `effective.critChance`, since the tree is
    // applied once, at the sheet, by `applySkillTree` upstream (BSP-23c). This test now
    // reaches 100% through `geared.critChance` directly — the sheet the account tree would
    // already have produced — so the cap assertion is proven through the correct source.
    const naked = { ...sampleNaked(), critChance: 80 };
    const out = computeAdvisorPipeline(
      baseInput({
        naked,
        geared: { ...naked, critChance: 100 },
      }),
    );
    expect(out.effective.critChance).toBeCloseTo(100, 6);
    const critRank = out.ranking.find((r) => r.stat === 'critChance');
    expect(critRank?.gainPct).toBe(0);
  });

  it('ranks CDR with positive gain at 70% effective CDR (below 80% cap)', () => {
    const naked = { ...sampleNaked(), cdr: 50 };
    const geared = { ...naked, cdr: 70 };
    const out = computeAdvisorPipeline(
      baseInput({
        naked,
        geared,
        pts: ZERO_PTS(),
        level: 55,
        stars: 1,
      }),
    );
    expect(out.effective.cdr).toBeCloseTo(70, 1);
    const cdrRank = out.ranking.find((r) => r.stat === 'cdr');
    expect(cdrRank?.gainPct).toBeGreaterThan(0);
  });

  it('ranks CDR at zero when effective CDR is at 80% cap', () => {
    const naked = { ...sampleNaked(), cdr: 50 };
    const geared = { ...naked, cdr: 80 };
    const out = computeAdvisorPipeline(
      baseInput({
        naked,
        geared,
        pts: ZERO_PTS(),
        level: 55,
      }),
    );
    expect(out.effective.cdr).toBeCloseTo(80, 1);
    const cdrRank = out.ranking.find((r) => r.stat === 'cdr');
    expect(cdrRank?.gainPct).toBe(0);
  });

  it('ranks penetration with positive gain at 70% effective pen', () => {
    const naked = { ...sampleNaked(), penetration: 40 };
    const geared = { ...naked, penetration: 70 };
    const out = computeAdvisorPipeline(
      baseInput({
        naked,
        geared,
        pts: ZERO_PTS(),
        level: 55,
        mitigationPct: 50,
      }),
    );
    expect(out.effective.penetration).toBeCloseTo(70, 1);
    const penRank = out.ranking.find((r) => r.stat === 'penetration');
    expect(penRank?.gainPct).toBeGreaterThan(0);
  });

  it('ranks penetration at zero when effective pen is at 100% bypass cap', () => {
    const naked = { ...sampleNaked(), penetration: 80 };
    const geared = { ...naked, penetration: 100 };
    const out = computeAdvisorPipeline(
      baseInput({
        naked,
        geared,
        pts: ZERO_PTS(),
        level: 55,
        mitigationPct: 50,
      }),
    );
    expect(out.effective.penetration).toBeCloseTo(100, 1);
    const penRank = out.ranking.find((r) => r.stat === 'penetration');
    expect(penRank?.gainPct).toBe(0);
  });

  it('ranks penetration at zero when sheet pen exceeds 100% (combat saturated)', () => {
    const naked = { ...sampleNaked(), penetration: 90 };
    const geared = { ...naked, penetration: 134 };
    const out = computeAdvisorPipeline(
      baseInput({
        naked,
        geared,
        pts: ZERO_PTS(),
        level: 55,
        mitigationPct: 50,
      }),
    );
    expect(out.effective.penetration).toBeGreaterThan(100);
    const penRank = out.ranking.find((r) => r.stat === 'penetration');
    expect(penRank?.gainPct).toBe(0);
  });

  it('spentDelta counts luck points against the level budget (BSPW2-AC-29, AD-BSP-19)', () => {
    const pts = { ...ZERO_PTS(), attack: 2, luck: 4 };
    const out = computeAdvisorPipeline(baseInput({ pts }));
    expect(out.spentDelta).toBe(6);
  });

  it('AC-17: sheetOther.critDmgFlat is wired from golpe_brutal, and does NOT scale the point delta', () => {
    // Golpe Brutal is a FLAT sheet addend (POINT_GAIN.critDmgFlat), already baked into
    // naked/geared by rescaleNakedCritDmg — items never separately roll crit dmg. The
    // discriminating signal for this builder is therefore `sheetOther.critDmgFlat` itself.
    const withoutGolpe = computeAdvisorPipeline(baseInput({ abilities: {} }));
    const withGolpe = computeAdvisorPipeline(baseInput({ abilities: { golpe_brutal: 13 } }));
    expect(withGolpe.sheetOther.critDmgFlat).toBe(52);
    expect(withoutGolpe.sheetOther.critDmgFlat).toBe(0);
    // A crit-damage point buys the same +5 either way: the marginal gain is flat, so unlike
    // every pooled stat it is NOT diluted by the ability's contribution.
    expect(withoutGolpe.pointDelta.critDmg).toBeCloseTo(5, 10);
    expect(withGolpe.pointDelta.critDmg).toBeCloseTo(5, 10);
  });

  describe('resetAdvice (BSPW4-11, BSPW4-15, AC-64l)', () => {
    it('AC-64l: surfaces resetAdvice built from Tier 1, with tier/gainIsLowerBound fixed', () => {
      const out = computeAdvisorPipeline(baseInput());
      expect(out.resetAdvice.tier).toBe('gate');
      expect(out.resetAdvice.gainIsLowerBound).toBe(true);
      expect(typeof out.resetAdvice.recommend).toBe('boolean');
      expect(out.resetAdvice.currentDps).toBe(out.dps);
      expect(out.resetAdvice.reoptDps).toBeGreaterThanOrEqual(out.resetAdvice.currentDps);
    });

    it('AC-69: reoptDps is the sustained DPS of the vector findGateCandidate actually returns, agreeing with the optimiser on a saturated-crit-chance hero', () => {
      // Points parked in an already-saturated stat (crit chance at cap) cannot recover any
      // DPS through the gate — the pipeline's own resetAdvice.gainPct must equal what a
      // direct findGateCandidate call on the same inputs reports, not an idealised guess.
      const naked = sampleNaked();
      const geared = { ...naked, critChance: 100 };
      const pts = { ...ZERO_PTS(), critChance: 30 };
      const input = baseInput({ naked, geared, pts });
      const out = computeAdvisorPipeline(input);
      const direct = findGateCandidate({
        pts,
        effective: out.effective,
        effectiveDelta: out.A.effectiveDelta,
        context: out.context,
        // The same pool the pipeline hands the gate — read off the input, so the two sides
        // cannot drift apart if this fixture's level ever changes.
        level: input.level,
      });
      expect(out.resetAdvice.gainPct).toBeCloseTo(direct.gainPct, 9);
      expect(out.resetAdvice.reoptDps).toBeCloseTo(direct.reoptDps, 6);
    });

    it('AC-70: the gate is unaffected by rankMode — farm mode with a target prop produces byte-identical resetAdvice to dps mode', () => {
      // rankMode still exists on AdvisorPipelineInput (the persisted UI setting), but this
      // pipeline no longer reads it for anything — the pipeline computes one hero's advice and
      // the farm objective needs the whole rotation, so they cannot be the same call. This case
      // stays as the regression guard for that: the field is present and inert.
      const dpsMode = computeAdvisorPipeline(baseInput({ rankMode: 'dps' }));
      const farmMode = computeAdvisorPipeline(
        baseInput({ rankMode: 'farm', targetProp: PROPS[1]?.name ?? PROPS[0].name }),
      );
      expect(farmMode.resetAdvice).toEqual(dpsMode.resetAdvice);
    });
  });

  it('AC-64m: AdvisorPipelineResult has no optimizeBuild field — Tier 2 ships unwired', () => {
    const out = computeAdvisorPipeline(baseInput());
    expect('optimizeBuild' in out).toBe(false);
  });
});
