import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  STRINGS,
  sub,
  parseEmphasis,
  loadLang,
  saveLang,
  type Lang,
  type Strings,
  type ExplainSection,
} from '@/shared/i18n';
import * as chrome from '@/shared/i18n/namespaces/chrome';
import * as planner from '@/shared/i18n/namespaces/planner';
import * as gear from '@/shared/i18n/namespaces/gear';
import * as abilities from '@/shared/i18n/namespaces/abilities';
import * as account from '@/shared/i18n/namespaces/account';
import * as advice from '@/shared/i18n/namespaces/advice';
import * as breakdown from '@/shared/i18n/namespaces/breakdown';
import * as phases from '@/shared/i18n/namespaces/phases';
import * as teamPlan from '@/shared/i18n/namespaces/team-plan';
import * as importNs from '@/shared/i18n/namespaces/import';
import * as stats from '@/shared/i18n/namespaces/stats';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

const fixturePath = join(WEB_PACKAGE_ROOT, 'src/tests/fixtures/i18n-strings-main.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  en: Strings;
  pt: Strings;
};

/** MP5 F3 — the 12 keys this feature deletes. The fixture is MOD-03-frozen
 *  (docs/naming.md:74), so parity subtracts this list rather than regenerating. */
export const KEYSTONE_KEYS_REMOVED = [
  'treeGlassCannon',
  'treeGlassCannonHint',
  'treeAbisso',
  'treeAbissoHint',
  'treeTempoDobrado',
  'treeTempoDobradoHint',
  'keystoneOn',
  'keystoneOff',
  'importKeystoneOn',
  'bdNoteGlassCannon',
  'bdNoteTempoDobrado',
  'bdTermAbisso',
] as const;

function omitKeys<T extends Record<string, unknown>>(obj: T, keys: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = { ...obj };
  for (const key of keys) delete out[key];
  return out as Partial<T>;
}

/**
 * MP5 F3 also rewrites 5 surviving strings (both languages) to drop keystone terms from prose
 * that stays — e.g. `accountFarmPhaseHint` loses "and Abisso's damage multiplier"; the two
 * `explainSections` paragraphs (advice.ts §1 and §8) lose their keystone clauses whole (both
 * languages, `docs/i18n.md`'s Portuguese-chrome-quality rule). KEYSTONE_KEYS_REMOVED alone
 * cannot express that — a deleted key and an edited value are different shapes of drift. Rather
 * than loosen the frozen-fixture comparison to `objectContaining` (which would stop failing on
 * *any* other addition — the exact alternative AD-081 rejects), this pins the *exact set of
 * leaf paths* allowed to differ from the frozen fixture. Every other leaf, at every depth
 * (including inside `explainSections[].p[]`), must still match byte-for-byte.
 */
const KEYSTONE_PROSE_EDITED_PATHS = [
  'accountFarmPhaseHint',
  'accountTip',
  'bdFormulaDmg',
  'explainSections.0.p.1',
  'explainSections.7.p.0',
  // Farm Ranking (T1): the Phases page is renamed Farm — navPhases's VALUE
  // changes to "Farm" in both languages (key name kept, i18n.md rule 3).
  'navPhases',
].sort();

/**
 * The rank-mode retirement — two keys retired, four added, two existing values reworded. The
 * retired/added keys are their own named lists (`RANK_MODE_KEYS_REMOVED` /
 * `RANK_MODE_KEYS_ADDED`, below); these two leaf paths are the reworded VALUES on keys that
 * survive: `accountTargetPropHint` drops the one-shot ranking claim, and the "next point
 * ranking" explain paragraph (`explainSections[5].p[0]`) drops the "Oneshot mode..." sentence
 * for one about what farm mode ranks.
 */
const RANK_MODE_PROSE_EDITED_PATHS = ['accountTargetPropHint', 'explainSections.5.p.0'].sort();

/** Retired with the one-shot ranking heuristic: the mode option's own label, and the
 *  Account-tab setup string that only existed to require a target prop for that mode. */
export const RANK_MODE_KEYS_REMOVED = ['modeOneshot', 'setupNeedTargetProp'] as const;

/** New for farm-mode ranking: the mode option's label, the two fallback notes (no pool / no
 *  feasible rate), and the "ranked as if added" note for a hero outside the rotation. */
const RANK_MODE_KEYS_ADDED = ['modeFarm', 'rankFarmNoPool', 'rankFarmNoRate', 'rankFarmAddedToPool'] as const;

/**
 * MP5 F4 (T8, MSG-14) — genuinely NEW keys with no counterpart in the frozen fixture at all
 * (not a prose edit of an existing key). `diffLeafPaths` reports "present in STRINGS, absent
 * from the fixture" the same way it reports a changed value, so this list is folded into the
 * "differs at exactly" comparisons alongside `KEYSTONE_PROSE_EDITED_PATHS`, and separately
 * excluded from the sorted-key-set comparison (which compares SETS, not diffs).
 */
const F4_KEYS_ADDED = ['importRejectedUnsupportedShape'] as const;

/**
 * Farm Ranking T5 — the Farm Ranking board's column headers, genuinely new keys with no
 * counterpart in the frozen fixture (`farmRanking*` prefix, `phases` namespace, deliberately).
 * Same shape as `F4_KEYS_ADDED` above; kept as its own named list so a reviewer can
 * see which feature added which keys.
 */
const FARM_RANKING_KEYS_ADDED = [
  'farmRankingColPhase',
  'farmRankingColMitigation',
  'farmRankingColGold',
  'farmRankingColChests',
  'farmRankingColKeys',
  'farmRankingColGems',
  'farmRankingColTimePieces',
  'farmRankingColXp',
  'farmRankingColItemLevel',
  'farmRankingColClearTime',
  'farmRankingColOneShot',
  'farmRankingColJaula',
  'farmRankingColInfeasible',
  'farmRankingTitle',
  'farmRankingCaption',
  'farmRankingEmptyNoRosterTitle',
  'farmRankingEmptyNoRosterDesc',
  'farmRankingEmptyNoHeroesTitle',
  'farmRankingEmptyNoHeroesDesc',
  'farmRankingEmptyComputeFailedTitle',
  'farmRankingEmptyComputeFailedDesc',
  'farmRankingEmptyNoMatchesTitle',
  'farmRankingEmptyNoMatchesDesc',
  'farmRankingFilterUnlockedLabel',
  'farmRankingFilterUnlockedDisabledReason',
  'farmRankingFilterFeasibleLabel',
  'farmRankingFilterAtoLabel',
  'farmRankingFilterAtoAll',
  'farmRankingFilterGateLabel',
  'farmRankingFilterGateAll',
  'farmRankingFilterGateOnly',
  'farmRankingFilterGateNonGate',
  'farmRankingPoolLabel',
  'farmRankingPoolHeroAria',
  'farmRankingReturnBonusLabel',
  'farmRankingReturnBonusOff',
  'farmRankingReturnBonusOn',
  'farmRankingReturnBonusVip',
  'farmRankingGateBadge',
  'farmRankingPushTargetBadge',
  'farmRankingInfeasibleBadge',
  'farmRankingKeysConsumed',
  'farmRankingOneShotYes',
  'farmRankingOneShotNo',
  'farmRankingOneShotTooltipYes',
  'farmRankingOneShotTooltipNo',
  'farmRankingSortedBy',
  'farmRankingSortAsc',
  'farmRankingSortDesc',
  'farmRankingCurrentPhase',
] as const;

/**
 * Farm Respec Advisor T7 — the toolbar, panel, hero-card and frontier copy, genuinely new keys
 * with no counterpart in the frozen fixture. Same shape as `FARM_RANKING_KEYS_ADDED` above; kept
 * as its own named list so a reviewer can see which feature added which keys.
 */
const FARM_RESPEC_KEYS_ADDED = [
  'farmRespecObjectiveLabel',
  'farmRespecObjectiveGold',
  'farmRespecObjectiveChests',
  'farmRespecObjectiveBlend',
  'farmRespecOptimize',
  'farmRespecOptimizeBusy',
  'farmRespecHeadlineGain',
  'farmRespecHeadlinePhase',
  'farmRespecHeadlineCost',
  'farmRespecGateFailed',
  'farmRespecPaybackHours',
  'farmRespecPaybackNoGoldGain',
  'farmRespecPaybackNoChange',
  'farmRespecPanelHeading',
  'farmRespecClose',
  'farmRespecPanelGain',
  'farmRespecMetricGold',
  'farmRespecMetricChests',
  'farmRespecMetricCost',
  'farmRespecMetricPayback',
  'farmRespecGoldGivenUp',
  'farmRespecChestExplainer',
  'farmRespecBudgetExhausted',
  'farmRespecDiagnostics',
  'farmRespecFailed',
  'farmRespecTerminalTitle',
  'farmRespecTerminalDesc',
  'farmRespecPlateauLabel',
  'farmRespecPlateauRange',
  'farmRespecPlateauSharp',
  'farmRespecHeroesHeading',
  'farmRespecLuckKeep',
  'farmRespecLuckHint',
  'farmRespecUnchangedNote',
  'farmRespecUnchangedGoldSaved',
  'farmRespecKeyCurrent',
  'farmRespecKeyTarget',
  'farmRespecKeyDelta',
  'farmRespecFrontierHeading',
  'farmRespecFrontierHeroCountOne',
  'farmRespecFrontierHeroCountTwo',
  'farmRespecFrontierGainCost',
  'farmRespecFrontierPaybackNone',
  'farmRespecRerankToggle',
  'farmRespecRerankBanner',
  'farmRespecRerankCaption',
] as const;

/**
 * Flat-crit-damage fix (PR #90 review item 5) — the `brutalStrike` ledger note's label, genuinely
 * new with no counterpart in the frozen fixture. Same shape as `F4_KEYS_ADDED` above.
 */
const CRIT_DMG_FLAT_KEYS_ADDED = ['bdNoteBrutalStrike'] as const;

/**
 * The gear slot editor's set select is gone (#106): `catalog.setsByLevel` is a bijection, so that
 * control could only ever offer one option. `itemSet` was its `aria-label`/`title` and has no
 * other reader, so it is retired with the control rather than left as an orphan string. Same
 * shape as `RANK_MODE_KEYS_REMOVED` above — the fixture is frozen, so parity subtracts this list.
 */
export const ITEM_SET_KEYS_REMOVED = ['itemSet'] as const;

/**
 * The set name moved INTO the surviving level option's label, so `itemLevelOpt`'s VALUE gains a
 * `{set}` placeholder in both languages ("Level {n} - {set}" / "Nível {n} - {set}"). The key
 * survives, so this is an edited leaf path, not an added or removed key. `itemLevel` is NOT here:
 * the level select's accessible name is unchanged — the user still picks a level, and the set the
 * level implies is spelled out in the option text the control reads out with it.
 */
const ITEM_SET_PROSE_EDITED_PATHS = ['itemLevelOpt'].sort();

function diffLeafPaths(a: unknown, b: unknown, path: string[] = [], out: string[] = []): string[] {
  if (a === b) return out;
  const aIsObj = a !== null && typeof a === 'object';
  const bIsObj = b !== null && typeof b === 'object';
  if (aIsObj && bIsObj) {
    const aKeys = Array.isArray(a) ? a.map((_, i) => String(i)) : Object.keys(a);
    const bKeys = Array.isArray(b) ? b.map((_, i) => String(i)) : Object.keys(b);
    for (const key of new Set([...aKeys, ...bKeys])) {
      diffLeafPaths((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], [
        ...path,
        key,
      ], out);
    }
    return out;
  }
  out.push(path.join('.'));
  return out;
}

const namespaces = [
  chrome,
  planner,
  gear,
  abilities,
  account,
  advice,
  breakdown,
  phases,
  teamPlan,
  importNs,
  stats,
] as const;

describe('i18n split parity', () => {
  // The fixture (apps/web/src/tests/fixtures/i18n-strings-main.json) is MOD-03-frozen
  // (docs/naming.md:74) and stays byte-unchanged. MP5 F3 deletes the 12
  // KEYSTONE_KEYS_REMOVED keys from STRINGS, so parity is measured against the fixture
  // *minus* that enumerated list (AD-081) — every unlisted drift stays fatal in both
  // directions, and the list itself cannot silently grow or shrink (see the three
  // assertions below).
  it('STRINGS.en differs from the frozen fixture (minus removed keys) at exactly the enumerated prose edits — including the set-select removal\'s — plus F4\'s, Farm Ranking\'s, Farm Respec Advisor\'s and the rank-mode retirement\'s new keys', () => {
    const diffs = diffLeafPaths(
      STRINGS.en,
      omitKeys(fixture.en, [
        ...KEYSTONE_KEYS_REMOVED,
        ...RANK_MODE_KEYS_REMOVED,
        ...ITEM_SET_KEYS_REMOVED,
      ]),
    ).sort();
    expect(diffs).toEqual(
      [
        ...KEYSTONE_PROSE_EDITED_PATHS,
        ...RANK_MODE_PROSE_EDITED_PATHS,
        ...ITEM_SET_PROSE_EDITED_PATHS,
        ...F4_KEYS_ADDED,
        ...FARM_RANKING_KEYS_ADDED,
        ...FARM_RESPEC_KEYS_ADDED,
        ...RANK_MODE_KEYS_ADDED,
        ...CRIT_DMG_FLAT_KEYS_ADDED,
      ].sort(),
    );
  });

  it('STRINGS.pt differs from the frozen fixture (minus removed keys) at exactly the enumerated prose edits — including the set-select removal\'s — plus F4\'s, Farm Ranking\'s, Farm Respec Advisor\'s and the rank-mode retirement\'s new keys', () => {
    const diffs = diffLeafPaths(
      STRINGS.pt,
      omitKeys(fixture.pt, [
        ...KEYSTONE_KEYS_REMOVED,
        ...RANK_MODE_KEYS_REMOVED,
        ...ITEM_SET_KEYS_REMOVED,
      ]),
    ).sort();
    expect(diffs).toEqual(
      [
        ...KEYSTONE_PROSE_EDITED_PATHS,
        ...RANK_MODE_PROSE_EDITED_PATHS,
        ...ITEM_SET_PROSE_EDITED_PATHS,
        ...F4_KEYS_ADDED,
        ...FARM_RANKING_KEYS_ADDED,
        ...FARM_RESPEC_KEYS_ADDED,
        ...RANK_MODE_KEYS_ADDED,
        ...CRIT_DMG_FLAT_KEYS_ADDED,
      ].sort(),
    );
  });

  it('namespace key sets are pairwise disjoint', () => {
    const seen = new Map<string, string>();
    for (const ns of namespaces) {
      for (const key of Object.keys(ns.en)) {
        const prior = seen.get(key);
        expect(prior, `duplicate key ${key} also in ${prior}`).toBeUndefined();
        seen.set(key, 'present');
      }
    }
  });

  it('sorted key-name list is unchanged vs fixture minus the removed keystone/rank-mode/item-set keys, plus F4\'s, Farm Ranking\'s, Farm Respec Advisor\'s and the rank-mode retirement\'s new keys', () => {
    const fromSplit = Object.keys(STRINGS.en).sort();
    const fromFixture = [
      ...Object.keys(
        omitKeys(fixture.en, [
          ...KEYSTONE_KEYS_REMOVED,
          ...RANK_MODE_KEYS_REMOVED,
          ...ITEM_SET_KEYS_REMOVED,
        ]),
      ),
      ...F4_KEYS_ADDED,
      ...FARM_RANKING_KEYS_ADDED,
      ...FARM_RESPEC_KEYS_ADDED,
      ...RANK_MODE_KEYS_ADDED,
      ...CRIT_DMG_FLAT_KEYS_ADDED,
    ].sort();
    expect(fromSplit).toEqual(fromFixture);
  });

  it('KEYSTONE_KEYS_REMOVED has exactly 12 entries', () => {
    expect(KEYSTONE_KEYS_REMOVED.length).toBe(12);
  });

  it('every removed key was present in the frozen fixture, both languages', () => {
    for (const key of KEYSTONE_KEYS_REMOVED) {
      expect(key in fixture.en, `${key} missing from fixture.en`).toBe(true);
      expect(key in fixture.pt, `${key} missing from fixture.pt`).toBe(true);
    }
  });

  it('every removed key is absent from STRINGS, both languages', () => {
    for (const key of KEYSTONE_KEYS_REMOVED) {
      expect(key in STRINGS.en, `${key} still present in STRINGS.en`).toBe(false);
      expect(key in STRINGS.pt, `${key} still present in STRINGS.pt`).toBe(false);
    }
  });

  it('F4_KEYS_ADDED has exactly 1 entry, present in STRINGS but absent from the frozen fixture, both languages', () => {
    expect(F4_KEYS_ADDED.length).toBe(1);
    for (const key of F4_KEYS_ADDED) {
      expect(key in fixture.en, `${key} unexpectedly present in fixture.en`).toBe(false);
      expect(key in fixture.pt, `${key} unexpectedly present in fixture.pt`).toBe(false);
      expect(key in STRINGS.en, `${key} missing from STRINGS.en`).toBe(true);
      expect(key in STRINGS.pt, `${key} missing from STRINGS.pt`).toBe(true);
    }
  });

  it('FARM_RANKING_KEYS_ADDED has exactly 50 entries, present in STRINGS but absent from the frozen fixture, both languages', () => {
    expect(FARM_RANKING_KEYS_ADDED.length).toBe(50);
    for (const key of FARM_RANKING_KEYS_ADDED) {
      expect(key in fixture.en, `${key} unexpectedly present in fixture.en`).toBe(false);
      expect(key in fixture.pt, `${key} unexpectedly present in fixture.pt`).toBe(false);
      expect(key in STRINGS.en, `${key} missing from STRINGS.en`).toBe(true);
      expect(key in STRINGS.pt, `${key} missing from STRINGS.pt`).toBe(true);
    }
  });

  it('FARM_RESPEC_KEYS_ADDED has exactly 46 entries, present in STRINGS but absent from the frozen fixture, both languages', () => {
    expect(FARM_RESPEC_KEYS_ADDED.length).toBe(46);
    for (const key of FARM_RESPEC_KEYS_ADDED) {
      expect(key in fixture.en, `${key} unexpectedly present in fixture.en`).toBe(false);
      expect(key in fixture.pt, `${key} unexpectedly present in fixture.pt`).toBe(false);
      expect(key in STRINGS.en, `${key} missing from STRINGS.en`).toBe(true);
      expect(key in STRINGS.pt, `${key} missing from STRINGS.pt`).toBe(true);
    }
  });

  it('RANK_MODE_KEYS_REMOVED has exactly 2 entries', () => {
    expect(RANK_MODE_KEYS_REMOVED.length).toBe(2);
  });

  it('every RANK_MODE_KEYS_REMOVED key was present in the frozen fixture, both languages', () => {
    for (const key of RANK_MODE_KEYS_REMOVED) {
      expect(key in fixture.en, `${key} missing from fixture.en`).toBe(true);
      expect(key in fixture.pt, `${key} missing from fixture.pt`).toBe(true);
    }
  });

  it('every RANK_MODE_KEYS_REMOVED key is absent from STRINGS, both languages', () => {
    for (const key of RANK_MODE_KEYS_REMOVED) {
      expect(key in STRINGS.en, `${key} still present in STRINGS.en`).toBe(false);
      expect(key in STRINGS.pt, `${key} still present in STRINGS.pt`).toBe(false);
    }
  });

  it('RANK_MODE_KEYS_ADDED has exactly 4 entries, present in STRINGS but absent from the frozen fixture, both languages', () => {
    expect(RANK_MODE_KEYS_ADDED.length).toBe(4);
    for (const key of RANK_MODE_KEYS_ADDED) {
      expect(key in fixture.en, `${key} unexpectedly present in fixture.en`).toBe(false);
      expect(key in fixture.pt, `${key} unexpectedly present in fixture.pt`).toBe(false);
      expect(key in STRINGS.en, `${key} missing from STRINGS.en`).toBe(true);
      expect(key in STRINGS.pt, `${key} missing from STRINGS.pt`).toBe(true);
    }
  });

  it('CRIT_DMG_FLAT_KEYS_ADDED has exactly 1 entry, present in STRINGS but absent from the frozen fixture, both languages', () => {
    expect(CRIT_DMG_FLAT_KEYS_ADDED.length).toBe(1);
    for (const key of CRIT_DMG_FLAT_KEYS_ADDED) {
      expect(key in fixture.en, `${key} unexpectedly present in fixture.en`).toBe(false);
      expect(key in fixture.pt, `${key} unexpectedly present in fixture.pt`).toBe(false);
      expect(key in STRINGS.en, `${key} missing from STRINGS.en`).toBe(true);
      expect(key in STRINGS.pt, `${key} missing from STRINGS.pt`).toBe(true);
    }
  });

  it('ITEM_SET_KEYS_REMOVED has exactly 1 entry', () => {
    expect(ITEM_SET_KEYS_REMOVED.length).toBe(1);
  });

  it('every ITEM_SET_KEYS_REMOVED key was present in the frozen fixture, both languages', () => {
    for (const key of ITEM_SET_KEYS_REMOVED) {
      expect(key in fixture.en, `${key} missing from fixture.en`).toBe(true);
      expect(key in fixture.pt, `${key} missing from fixture.pt`).toBe(true);
    }
  });

  it('every ITEM_SET_KEYS_REMOVED key is absent from STRINGS, both languages', () => {
    for (const key of ITEM_SET_KEYS_REMOVED) {
      expect(key in STRINGS.en, `${key} still present in STRINGS.en`).toBe(false);
      expect(key in STRINGS.pt, `${key} still present in STRINGS.pt`).toBe(false);
    }
  });

  it('ITEM_SET_PROSE_EDITED_PATHS has exactly 1 entry, whose key survives in both the fixture and STRINGS with a changed value, both languages', () => {
    expect(ITEM_SET_PROSE_EDITED_PATHS.length).toBe(1);
    for (const key of ITEM_SET_PROSE_EDITED_PATHS) {
      expect(key in fixture.en, `${key} missing from fixture.en`).toBe(true);
      expect(key in fixture.pt, `${key} missing from fixture.pt`).toBe(true);
      expect(key in STRINGS.en, `${key} missing from STRINGS.en`).toBe(true);
      expect(key in STRINGS.pt, `${key} missing from STRINGS.pt`).toBe(true);
      const typedKey = key as keyof Strings;
      expect(STRINGS.en[typedKey], `${key} unchanged in EN — nothing to enumerate`).not.toBe(
        fixture.en[typedKey],
      );
      expect(STRINGS.pt[typedKey], `${key} unchanged in PT — nothing to enumerate`).not.toBe(
        fixture.pt[typedKey],
      );
    }
  });

  it('the combined level option label carries both placeholders, in both languages', () => {
    for (const lang of ['en', 'pt'] as const) {
      expect(STRINGS[lang].itemLevelOpt).toContain('{n}');
      expect(STRINGS[lang].itemLevelOpt).toContain('{set}');
      // The separator the design asks for: space-hyphen-space between level and set.
      expect(STRINGS[lang].itemLevelOpt).toMatch(/\{n\} - \{set\}$/);
    }
    expect(sub(STRINGS.en.itemLevelOpt, { n: 300, set: 'Void' })).toBe('Level 300 - Void');
    expect(sub(STRINGS.pt.itemLevelOpt, { n: 300, set: 'Vazio' })).toBe('Nível 300 - Vazio');
  });

  it('sub() behaves identically on existing fixtures', () => {
    expect(sub('a {x}', { x: 1 })).toBe('a 1');
    expect(sub('Need {pct}% pen', { pct: 12 })).toBe('Need 12% pen');
    expect(sub('missing {gone}', {})).toBe('missing ');
  });

  it('parseEmphasis() behaves identically on existing fixtures', () => {
    expect(parseEmphasis('plain')).toEqual([{ kind: 'text', value: 'plain' }]);
    expect(parseEmphasis('before <em>mid</em> after')).toEqual([
      { kind: 'text', value: 'before ' },
      { kind: 'em', value: 'mid' },
      { kind: 'text', value: ' after' },
    ]);
  });

  it('public API symbols resolve with expected shapes', () => {
    const langs: Lang[] = ['en', 'pt'];
    expect(langs.every((l) => STRINGS[l])).toBe(true);
    expect(typeof loadLang).toBe('function');
    expect(typeof saveLang).toBe('function');
    const section: ExplainSection = { h: 'x', p: ['y'] };
    expect(section.h).toBe('x');
  });
});

/**
 * EN and PT key sets are structurally equal (compile-time via `pt: typeof en`,
 * asserted again here at runtime) and no PT value for a Farm Ranking key is byte-identical to
 * its EN counterpart, except an explicit allowlist. `navPhases` ("Farm") is the
 * design's own allowlisted collision. `farmRankingReturnBonusVip` ("VIP") is added on the same
 * rationale — a universal loanword used unchanged in Brazilian Portuguese gaming UI, not a
 * missed translation.
 */
describe('Farm Ranking i18n parity', () => {
  const EN_PT_COLLISION_ALLOWLIST = new Set(['navPhases', 'farmRankingReturnBonusVip']);

  it('EN and PT key sets are equal at runtime', () => {
    expect(Object.keys(STRINGS.pt).sort()).toEqual(Object.keys(STRINGS.en).sort());
  });

  it('no farmRanking* PT value is byte-identical to its EN counterpart, except the allowlist', () => {
    const leaks: string[] = [];
    for (const key of Object.keys(STRINGS.en)) {
      if (!key.startsWith('farmRanking') && key !== 'navPhases') continue;
      if (EN_PT_COLLISION_ALLOWLIST.has(key)) continue;
      const enValue = STRINGS.en[key as keyof Strings];
      const ptValue = STRINGS.pt[key as keyof Strings];
      if (typeof enValue === 'string' && enValue === ptValue) leaks.push(key);
    }
    expect(leaks, `EN string left untranslated in PT: ${leaks.join(', ')}`).toEqual([]);
  });
});

/**
 * Farm Respec Advisor T7 — same shape as `Farm Ranking i18n parity` above. None of these
 * strings legitimately collides between EN and PT, so no allowlist entry is needed.
 */
describe('Farm Respec Advisor i18n parity', () => {
  it('no farmRespec* PT value is byte-identical to its EN counterpart', () => {
    const leaks: string[] = [];
    for (const key of Object.keys(STRINGS.en)) {
      if (!key.startsWith('farmRespec')) continue;
      const enValue = STRINGS.en[key as keyof Strings];
      const ptValue = STRINGS.pt[key as keyof Strings];
      if (typeof enValue === 'string' && enValue === ptValue) leaks.push(key);
    }
    expect(leaks, `EN string left untranslated in PT: ${leaks.join(', ')}`).toEqual([]);
  });
});
