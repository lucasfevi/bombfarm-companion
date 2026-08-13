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
    // own field list — minus `treeCritDmgMult`, which no longer exists on either side (AD-038,
    // MKR-24/26). `statPointsAvailable`/`birth` are read the same way the web store reads them.
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
    // best.stat and dps — the fields MPV-03 actually promises are identical. Both paths now
    // receive byte-identical arguments (treeCritDmgMult no longer exists to diverge them), so
    // MKR-26's "unconditional identity" is tightened from a 9-decimal closeness bound to exact
    // identity (AD-038, design TD-9).
    expect(viaExportedPipeline.ranking.map((entry) => entry.stat)).toEqual(
      viaWebFieldList.ranking.map((entry) => entry.stat),
    );
    viaExportedPipeline.ranking.forEach((entry, index) => {
      expect(entry.dpsGainPct).toBe(viaWebFieldList.ranking[index]!.dpsGainPct);
    });
    expect(viaExportedPipeline.best.stat).toBe(viaWebFieldList.best.stat);
    expect(viaExportedPipeline.dps).toBe(viaWebFieldList.dps);
  });

  // AD-038 closure (MP5 F2 T4, MKR-27): the old red state passed a treeCritDmgMult the exported
  // pipeline could never produce — that field is gone now, so the red state is re-pointed onto
  // a SURVIVING field (treeDanoTotal) instead. The old red state must not reappear under a new
  // name (MKR-27).
  it('red state (demonstrated, then restored): a widened treeDanoTotal gap makes dps disagree', () => {
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
      treeDanoTotal: account.tree.danoTotal * 3, // <- deliberately-wrong: proves the field drives `dps`
      treeCritChance: account.tree.critChance,
      treeCritDmg: account.tree.critDmg,
      treeSpeed: account.tree.speed,
      treeEnergy: account.tree.energy,
      treeGlassCannon: account.tree.glassCannon,
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

    expect(viaExportedPipeline.dps).not.toBe(withWidenedGap.dps);
  });
});
