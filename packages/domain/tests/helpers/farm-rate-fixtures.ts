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
 * The 11-hero roster of 2026-08-25, read for its SHAPE by the ability suites (`abilities-pass`,
 * `ability-gain`, `team-aura-deltas`): a rank-20 ponta_diamante carrier (IDK) beside naked young
 * heroes (Hale L2, Joric L5). It is out of regime for `sheet` (see `helpers/capture-regime.ts`),
 * so no value assertion may read it — the scorer suite that used to moved to
 * {@link FARM_POINT_RANK_FIXTURE}.
 */
export const FARM_RANK_FIXTURE = 'save-20260825-11heroes-one-shot-spread.json';

/**
 * The in-regime roster for the next-point SCORER suite (`farm-point-rank.test.ts`): the main
 * account captured 2026-09-14 at phase 101 / max_phase 230, 20 heroes. Thirteen geared heroes at
 * L40-L151 one-shot a phase-42 prop and the seven naked ones at L1-L24 do not, so both sides of
 * the one-shot contrast sit on one roster. The seven are `battle_allowed: false` on the capture,
 * so a suite that wants them in the pool passes every id as `enabledHeroIds` rather than taking
 * the default pool.
 */
export const FARM_POINT_RANK_FIXTURE = 'save-20260914-20heroes-phase101.json';

/**
 * The in-regime roster for the RESPEC OPTIMIZER suites: the second account captured 2026-09-14
 * at phase 61 / max_phase 155 — 9 heroes, eight geared 8/8 (Nolan L127 down to Nyx L41) and one
 * naked with her whole budget unspent (Isolde L67, 67 points). Past every regime boundary with
 * no waiver needed.
 *
 * Chosen over {@link FARM_POINT_RANK_FIXTURE} for two reasons that both matter here. It is a
 * DIFFERENT ACCOUNT from every other post-boundary capture, so a band that holds on both is
 * evidence about the optimizer rather than about one player's build — which is exactly the
 * check the findings in `farm-optimize-486.test.ts` rest on. And it is SMALL: `solveFarmRespec`
 * over its 9 heroes runs in ~1.5s, across roughly a dozen call sites.
 */
export const FARM_OPTIMIZE_FIXTURE = 'save-20260914-9heroes-second-account.json';

export type FarmRateFixture = {
  heroes: HeroRecord[];
  account: AccountShared;
  /** `account.maxPhase` straight off the parsed fixture (42 on the default 5-hero capture). */
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
    // The farm-rate module never reads this field — it prices the auras itself, over the rotation
    // (`farmTeamBuffs`). It is filled from the capture's own deployed line-up so a suite that
    // hands this account straight to `pipelineForHero` prices the auras the capture was taken
    // under rather than none; a suite comparing against farm-rate's own facts must use
    // `farmPricedAccount` instead (see `farm-basis-parity.test.ts`).
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
