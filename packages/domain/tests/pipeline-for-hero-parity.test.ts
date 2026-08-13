/**
 * Layer 1 of MP3 F2's desktop/web parity proof (design.md §9, MPV-03, MPV-21). One committed
 * fixture payload, through the source-neutral entry point (`parseAccountPayload`) and the
 * exported `pipelineForHero` (`AD-032`), compared against a `computeAdvisorPipeline` call
 * assembled field-for-field with `apps/web/src/shared/stores/selectors/advisor-selectors.ts`'s
 * own field list — the same genre as the existing, untouched `apps/web/src/tests/roster-dps.test.ts`,
 * which already proves `computeHeroSoloDps` matches a direct pipeline call for one hero, extended
 * here to the ranking and to the exported entry point.
 *
 * MP5 F1 (`AD-069`, re-pointed onto the post-patch export): the 2026-08-13 patch removed
 * `crit_dmg_mult` from `skills.totals` entirely — the key is now absent, not `1`. That still
 * lands inside `{1, 2}` because `treeTotalsFromSave`'s `asNumber(totalsRaw.crit_dmg_mult, 1)`
 * defaults an absent key to `1`, which is exactly where `pipelineForHero`'s omission of
 * `treeCritDmgMult` (`AD-038`) and the web's forwarding of it legitimately agree. This is F2's
 * concern going forward — once `crit_dmg_mult` is deleted from `packages/domain/src`, this
 * precondition test (and `AD-038` itself) becomes F2's to re-evaluate, not F1's.
 */
import { describe, expect, it } from 'vitest';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { computeAdvisorPipeline } from '@bombfarm/domain/advisor-pipeline';
import { phaseLine } from '@bombfarm/domain/phases';
import { zeroTeamBuffs, type TeamBuffId } from '@bombfarm/domain/team-buffs';
import { DEFAULT_TARGET_PROP } from '@bombfarm/domain/farm-context';
import type { HeroRecord, AccountShared } from '@bombfarm/domain/shims/storage';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

const FIXTURE = 'save-20260813-5heroes.json';

describe('pipelineForHero ≡ computeAdvisorPipeline assembled from advisor-selectors.ts field list (MPV-03 layer 1)', () => {
  const raw = loadFixtureJson(FIXTURE);
  const parsed = parseAccountPayload(raw, []);

  it('the fixture actually parses candidates and a tree (sanity — otherwise this test proves nothing)', () => {
    expect(parsed.rejected).toBeNull();
    expect(parsed.candidates.length).toBeGreaterThan(0);
    expect(parsed.account.tree).not.toBeNull();
  });

  it("the fixture's raw crit_dmg_mult is absent, and its resolved account.tree.critDmgMult is in {1, 2} — the set where AD-038's divergence legitimately agrees", () => {
    const totals = (raw as { skills?: { totals?: { crit_dmg_mult?: unknown } } }).skills?.totals;
    expect(totals?.crit_dmg_mult).toBeUndefined();
    expect([1, 2]).toContain(parsed.account.tree?.critDmgMult);
  });

  const candidate = parsed.candidates[0];
  const hero: HeroRecord = {
    ...candidate.record,
    id: candidate.sourceId,
    updatedAt: Date.now(),
  };

  const accountData = parsed.account;
  if (!accountData.tree) throw new Error('fixture must carry a skill tree for this parity test');
  const tree = accountData.tree;

  // Same derivation `apps/web`'s `applyAccountImport` uses (account-slice.ts) — never invented.
  const phase = accountData.phase;
  if (phase == null) throw new Error('fixture must carry account.phase for this parity test');
  const line = phaseLine(phase);
  if (!line) throw new Error('fixture phase has no phase line');
  const mitigationPct = line.mitig * 100;

  const account: AccountShared = {
    tree: {
      danoTotal: tree.danoTotal,
      critChance: tree.critChance,
      critDmg: tree.critDmg,
      speed: tree.speed,
      energy: tree.energy,
      teamCoinPct: tree.teamCoinPct ?? 0,
      glassCannon: tree.glassCannon,
      tempoDobrado: tree.tempoDobrado,
      abisso: tree.abisso,
      abissoBase: tree.abissoBase,
      critDmgMult: tree.critDmgMult,
      luckFlatPct: tree.luckFlatPct,
    },
    teamBuffs: zeroTeamBuffs(),
    context: {
      houseIdx: accountData.houseIdx ?? 0,
      houseLevel: accountData.houseLevel ?? 1,
      phase,
      mitigationPct,
      rankMode: 'dps',
      targetProp: DEFAULT_TARGET_PROP,
    },
    slots: accountData.slots ?? undefined,
  };

  it('ranking order, each dpsGainPct, best.stat and dps are identical between the two call paths', () => {
    const viaExportedPipeline = pipelineForHero(hero, account, phase, mitigationPct);

    // Assembled field-for-field with advisor-selectors.ts's `selectAdvisorPipeline` — the web's
    // own field list, including `treeCritDmgMult` (which `pipelineForHero` omits, AD-038) and
    // `statPointsAvailable`/`birth` read the same way the web store reads them.
    const viaWebFieldList = computeAdvisorPipeline({
      naked: hero.naked,
      geared: hero.gearedOverride,
      loadout: hero.loadout,
      altLoadout: hero.altLoadout,
      pts: hero.pts,
      statPointsAvailable: hero.statPointsAvailable ?? 0,
      abilities: hero.abilities,
      rarity: hero.rarity,
      level: hero.level,
      stars: hero.stars,
      treeDanoTotal: account.tree.danoTotal,
      treeCritChance: account.tree.critChance,
      treeCritDmg: account.tree.critDmg,
      treeSpeed: account.tree.speed,
      treeEnergy: account.tree.energy,
      treeGlassCannon: account.tree.glassCannon,
      treeCritDmgMult: account.tree.critDmgMult,
      treeTempoDobrado: account.tree.tempoDobrado,
      treeAbisso: account.tree.abisso,
      treeAbissoBase: account.tree.abissoBase,
      treeLuckFlatPct: account.tree.luckFlatPct ?? 0,
      teamBuffs: account.teamBuffs as Record<TeamBuffId, number>,
      houseIdx: account.context.houseIdx,
      houseLevel: account.context.houseLevel,
      phase,
      mitigationPct,
      rankMode: account.context.rankMode,
      targetProp: account.context.targetProp,
      birth: hero.birth,
    });

    // Not a snapshot, not a deep-equal on the whole result: ranking order, each dpsGainPct,
    // best.stat and dps — the fields MPV-03 actually promises are identical.
    expect(viaExportedPipeline.ranking.map((entry) => entry.stat)).toEqual(
      viaWebFieldList.ranking.map((entry) => entry.stat),
    );
    viaExportedPipeline.ranking.forEach((entry, index) => {
      expect(entry.dpsGainPct).toBeCloseTo(viaWebFieldList.ranking[index]!.dpsGainPct, 9);
    });
    expect(viaExportedPipeline.best.stat).toBe(viaWebFieldList.best.stat);
    expect(viaExportedPipeline.dps).toBeCloseTo(viaWebFieldList.dps, 9);
  });

  it('red state (demonstrated, then restored): a widened treeCritDmgMult gap makes dps disagree', () => {
    // Temporarily pass a treeCritDmgMult on the computeAdvisorPipeline side that the exported
    // pipelineForHero could never produce (it never forwards the field at all), to prove the
    // assertion above is discriminating and not a tautology. crit_dmg_mult 3 is chosen because
    // it disagrees with both the fixture's real value (1) and the treeGlassCannon fallback (1
    // here, since glassCannon is false on this fixture).
    const viaExportedPipeline = pipelineForHero(hero, account, phase, mitigationPct);
    const withWidenedGap = computeAdvisorPipeline({
      naked: hero.naked,
      geared: hero.gearedOverride,
      loadout: hero.loadout,
      altLoadout: hero.altLoadout,
      pts: hero.pts,
      statPointsAvailable: hero.statPointsAvailable ?? 0,
      abilities: hero.abilities,
      rarity: hero.rarity,
      level: hero.level,
      stars: hero.stars,
      treeDanoTotal: account.tree.danoTotal,
      treeCritChance: account.tree.critChance,
      treeCritDmg: account.tree.critDmg,
      treeSpeed: account.tree.speed,
      treeEnergy: account.tree.energy,
      treeGlassCannon: account.tree.glassCannon,
      treeCritDmgMult: 3, // <- deliberately-wrong: proves the field actually drives `dps`
      treeTempoDobrado: account.tree.tempoDobrado,
      treeAbisso: account.tree.abisso,
      treeAbissoBase: account.tree.abissoBase,
      treeLuckFlatPct: account.tree.luckFlatPct ?? 0,
      teamBuffs: account.teamBuffs as Record<TeamBuffId, number>,
      houseIdx: account.context.houseIdx,
      houseLevel: account.context.houseLevel,
      phase,
      mitigationPct,
      rankMode: account.context.rankMode,
      targetProp: account.context.targetProp,
      birth: hero.birth,
    });

    expect(viaExportedPipeline.dps).not.toBeCloseTo(withWidenedGap.dps, 6);
  });
});
