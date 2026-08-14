/**
 * Layer 1 of MP3 F2's desktop/web parity proof (design.md §9, MPV-03, MPV-21). One committed
 * fixture payload, through the source-neutral entry point (`parseAccountPayload`) and the
 * exported `pipelineForHero` (`AD-032`), compared against a `computeAdvisorPipeline` call
 * assembled field-for-field with `apps/web/src/shared/stores/selectors/advisor-selectors.ts`'s
 * own field list — the same genre as the existing, untouched `apps/web/src/tests/roster-dps.test.ts`,
 * which already proves `computeHeroSoloDps` matches a direct pipeline call for one hero, extended
 * here to the ranking and to the exported entry point.
 *
 * The two call paths now receive byte-identical field lists, so the identity below is
 * unconditional rather than a closeness bound — see this file's "ranking order…" case.
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
    // own field list, now identical on both sides (MKR-24/26). `statPointsAvailable`/`birth`
    // are read the same way the web store reads them.
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
    // receive byte-identical arguments, so MKR-26's "unconditional identity" is tightened from
    // a 9-decimal closeness bound to exact identity (design TD-9).
    expect(viaExportedPipeline.ranking.map((entry) => entry.stat)).toEqual(
      viaWebFieldList.ranking.map((entry) => entry.stat),
    );
    viaExportedPipeline.ranking.forEach((entry, index) => {
      expect(entry.dpsGainPct).toBe(viaWebFieldList.ranking[index]!.dpsGainPct);
    });
    expect(viaExportedPipeline.best.stat).toBe(viaWebFieldList.best.stat);
    expect(viaExportedPipeline.dps).toBe(viaWebFieldList.dps);
  });

  // MKR-27: the old red state passed a field the exported pipeline could never produce; that
  // field is gone now, so the red state is re-pointed onto a SURVIVING field (treeDanoTotal)
  // instead. The old red state must not reappear under a new name.
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
