/**
 * Lifts the fixture → `{ heroes, account }` recipe from
 * `pipeline-for-hero-parity.test.ts:34-72` into a shared helper so the farm-rate suites don't
 * re-derive it seven times. Extended from that file's single-hero pick to every parsed candidate.
 *
 * Also provides `withAbilityLevels` — the fixture carries no `veia_ouro` / `fortuna` on any hero,
 * so the gold-ability multiplier cases need mutated copies of a parsed
 * hero, not the raw fixture.
 */
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { phaseLine } from '@bombfarm/domain/phases';
import { computeTeamBuffsFromDeployed } from '@bombfarm/domain/team-buffs';
import { DEFAULT_TARGET_PROP } from '@bombfarm/domain/farm-context';
import type { HeroRecord, AccountShared } from '@bombfarm/domain/shims/storage';
import { loadFixtureJson } from './sheet-math-fixtures';

export const FARM_RATE_FIXTURE = 'save-20260813-5heroes.json';

/**
 * The in-regime roster for suites that assert RANKING outcomes rather than shapes. Eleven heroes
 * captured 2026-08-25, holding both sides of the one-shot contrast at once — nine geared heroes
 * that one-shot a phase-42 prop and two naked young ones that do not (issue #171). Split from
 * {@link FARM_RATE_FIXTURE} rather than replacing it: the 2026-08-13 capture is out of regime for
 * `sheet` (see `helpers/capture-regime.ts`), so a value assertion may not read it, but the ~40
 * structural suites that read it for roster shape are unaffected and stay where they are.
 */
export const FARM_RANK_FIXTURE = 'save-20260825-11heroes-one-shot-spread.json';

/**
 * The in-regime roster for the RESPEC OPTIMIZER suites. A second, disjoint account captured
 * 2026-08-19, in regime for `sheet` on a waiver its registry row states and
 * `capture-regime-registry.test.ts` verifies (no hero owns either ability the 2026-08-23 patch
 * restated).
 *
 * Chosen over {@link FARM_RANK_FIXTURE} for two reasons that both matter here. It is a DIFFERENT
 * ACCOUNT from every other in-regime capture, so a band that holds on both is evidence about the
 * optimizer rather than about one player's build — which is exactly the check the re-enabled
 * findings in `farm-optimize-486.test.ts` rest on. And it is SMALL: `solveFarmRespec` over its 7
 * heroes runs in ~1s against ~12s for the 11-hero roster, across roughly a dozen call sites.
 */
export const FARM_OPTIMIZE_FIXTURE = 'save-20260819-11882-7heroes.json';

export type FarmRateFixture = {
  heroes: HeroRecord[];
  account: AccountShared;
  /** `account.maxPhase` straight off the parsed fixture (42 on the committed corpus). */
  maxPhase: number | null;
};

/**
 * Parses the committed 5-hero fixture into `{ heroes, account }` — the exact field-for-field
 * recipe `pipeline-for-hero-parity.test.ts` uses for its single hero, extended to every parsed
 * candidate so the farm-rate suites get the full roster.
 */
export function loadFarmRateFixture(
  filename: string = FARM_RATE_FIXTURE,
  dir: string = 'sheet-math',
): FarmRateFixture {
  const raw = loadFixtureJson(filename, dir);
  const parsed = parseAccountPayload(raw, []);
  if (parsed.rejected) {
    throw new Error(`fixture "${filename}" was rejected: ${parsed.rejected.reason}`);
  }

  const accountData = parsed.account;
  if (!accountData.tree) throw new Error('fixture must carry a skill tree for the farm-rate suites');
  const tree = accountData.tree;

  const phase = accountData.phase;
  if (phase == null) throw new Error('fixture must carry account.phase for the farm-rate suites');
  const line = phaseLine(phase);
  if (!line) throw new Error('fixture phase has no phase line');
  const mitigationPct = line.mitig * 100;

  const maxPhase = accountData.maxPhase ?? null;

  const heroes: HeroRecord[] = parsed.candidates.map((candidate, index) => ({
    ...candidate.record,
    id: candidate.sourceId,
    // Not read by pipelineForHero — a fixed, deterministic value keeps the fixture stable
    // across two loads within the same test (purity assertions reuse these objects).
    updatedAt: index,
  }));

  const account: AccountShared = {
    tree: {
      danoTotal: tree.danoTotal,
      critChance: tree.critChance,
      critDmg: tree.critDmg,
      speed: tree.speed,
      energy: tree.energy,
      teamCoinPct: tree.teamCoinPct ?? 0,
      luckFlatPct: tree.luckFlatPct,
      xpMult: tree.xpMult,
    },
    // issue #132: production derives the roster-wide aura total from the deployed roster by
    // default (`computeTeamBuffsFromDeployed`) rather than starting it at zero — this fixture
    // reproduces that default instead of the pre-fix zero, so every derived expectation reflects
    // the auras this fixture's own heroes actually carry.
    teamBuffs: computeTeamBuffsFromDeployed(heroes),
    context: {
      houseIdx: accountData.houseIdx ?? 0,
      houseLevel: accountData.houseLevel ?? 1,
      phase,
      mitigationPct,
      rankMode: 'dps',
      targetProp: DEFAULT_TARGET_PROP,
    },
    // Both slot counts and the House cycle come straight off the parse — the helper's job is to
    // reproduce production's `AccountImportData -> AccountShared` mapping, not a convenient
    // subset of it. `slots` is `casa.slots` (House recovery), `fieldSlots` is
    // `skills.field_slots` (field concurrency); they are different numbers on a real save.
    slots: accountData.slots ?? undefined,
    fieldSlots: accountData.fieldSlots ?? null,
    houseCycleSecs: accountData.houseCycleSecs ?? null,
    maxPhase,
  };

  return { heroes, account, maxPhase };
}

/**
 * A copy of `hero` with `levels` merged into `abilities` — new keys added, existing ones
 * overwritten, everything else untouched. The fixture has no `veia_ouro` or
 * `fortuna` on any hero, so the gold-ability multiplier cases need this.
 */
export function withAbilityLevels(hero: HeroRecord, levels: Record<string, number>): HeroRecord {
  return {
    ...hero,
    abilities: { ...hero.abilities, ...levels },
  };
}
