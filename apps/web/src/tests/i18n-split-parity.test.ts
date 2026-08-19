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

/**
 * Fixture re-baseline — 2026-08-17.
 *
 * `apps/web/src/tests/fixtures/i18n-strings-main.json` was regenerated from live `STRINGS`
 * (both `en` and `pt`), as its own deliberate, standalone, tracked change — not as part of a
 * feature PR. Every declared-delta list below (`KEYS_REMOVED`, `KEYS_ADDED`,
 * `PROSE_EDITED_PATHS`) is empty as of this re-baseline: the fixture and live `STRINGS` are the
 * same shape, key for key, value for value.
 *
 * Why this is a *deliberate, rare* move and not a routine fix: the whole point of comparing
 * `STRINGS` against a frozen snapshot is to catch UNINTENDED copy drift. If the fixture is
 * regenerated inside the same PR that changes the copy, the comparison degrades to
 * `STRINGS == STRINGS` — permanently green, permanently blind to the very drift it exists to
 * catch. So between re-baselines the fixture stays byte-unchanged (MOD-03, `docs/naming.md`),
 * and every feature that adds, removes, or rewords a string declares the change explicitly in
 * exactly one of the three lists below, with a comment naming the feature and explaining the
 * change. That declare-every-delta discipline is what makes an undeclared drift fail loudly.
 *
 * A re-baseline resets those lists to empty once they have accumulated across enough features
 * that they stop reading as a meaningful diff and start reading as bookkeeping for its own
 * sake — this one followed ten named lists and 114 declared entries in this file. It does not
 * loosen the comparison itself (still an exact match, not `objectContaining` — see AD-081, and
 * the note below on why that alternative is rejected); it only clears the backlog of old
 * entries and gives the mechanism a fresh floor to accumulate from.
 */
const fixturePath = join(WEB_PACKAGE_ROOT, 'src/tests/fixtures/i18n-strings-main.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  en: Strings;
  pt: Strings;
};

/**
 * Declare deltas here. A feature that changes `STRINGS` in a way that would otherwise fail one
 * of the parity checks below adds an entry to exactly one of these three lists — never by
 * loosening a comparison. Rather than an `objectContaining`-style comparison (which would stop
 * failing on *any* addition), this keeps the exact-match semantics and pins the exact set of
 * keys/paths allowed to differ from the frozen fixture; every other leaf, at every depth
 * (including inside `explainSections[].p[]`), must still match byte-for-byte.
 */

/**
 * Keys present in the frozen fixture that no longer exist in live STRINGS.
 *
 * The merged-row feature (2026-08-18) collapsed the Economy and Drops panels' wiki/yours ROW
 * PAIRS into one row per figure, showing the boosted total with the wiki base and the boost as
 * subtext. Each pair's two labels carried a parenthesised "(wiki)"/"(yours)" that the merged row
 * has no place for, so the six gold labels below have no reader left.
 *
 * `phasesXpPerProp` is deliberately NOT listed: the same feature revived it as the merged XP
 * row's label, and it is back in live STRINGS at the fixture's own value ("XP per prop" /
 * "XP por prop"). A key that leaves and returns unchanged is not a delta.
 */
const KEYS_REMOVED: readonly string[] = [
  'phasesGoldComumWiki',
  'phasesGoldComumActual',
  'phasesAvgGoldWiki',
  'phasesAvgGoldActual',
  'phasesMapGoldWiki',
  'phasesMapGoldActual',
];

/**
 * Keys present in live STRINGS with no counterpart in the frozen fixture at all — a genuinely
 * new key, not a reworded existing one. `diffLeafPaths` reports "present in STRINGS, absent
 * from the fixture" the same way it reports a changed value, so entries here are folded into
 * the "differs at exactly" comparisons alongside `PROSE_EDITED_PATHS`, and separately excluded
 * from the sorted-key-set comparison (which compares SETS, not diffs).
 *
 * The XP-multiplier / drop-chances feature (2026-08-18): the new Drops panel (gate-filtered rows
 * per drop type) and the Account import summary's new XP-multiplier row.
 *
 * The merged-row feature (same day) then collapsed each panel's wiki/yours pair into one row, so
 * the ten drop labels and the XP pair this list used to carry were replaced by the single-label
 * keys below before ever reaching a fixture re-baseline. They are dropped from this list rather
 * than moved to `KEYS_REMOVED`: they never existed in the frozen fixture, so their departure is
 * invisible to the comparison.
 *
 * `phasesBoost*` named the boost SOURCE in the merged row's subtext ("0.100% +17% luck"), which
 * the old paired rows expressed by labelling one row "(yours)". They are NOT listed below: the
 * tooltip-on-subtext feature (2026-08-19) dropped the trailing source word from every boosted
 * subtext ("0.100% + 17%" — the tooltip now carried on the subtext itself explains the source
 * instead), so `phasesBoostXp`/`phasesBoostGold`/`phasesBoostLuck` lost their only reader in the
 * same feature that added them. Same precedent as the drop labels above: a key that was added and
 * removed before ever reaching a fixture re-baseline is dropped from this list rather than moved
 * to `KEYS_REMOVED` — it never existed in the frozen fixture, so its departure is invisible to
 * the comparison.
 */
const KEYS_ADDED: readonly string[] = [
  'phasesXpActualHint',
  'phasesDropsSection',
  'phasesDropChest',
  'phasesDropKey',
  'phasesDropTime',
  'phasesDropGem',
  'phasesDropStone',
  'phasesDropActualHint',
  'phasesGoldComum',
  'phasesAvgGold',
  'phasesMapGold',
  'treeXpMult',
];

/**
 * Leaf paths whose key survives in both the fixture and STRINGS but whose VALUE changed — e.g.
 * a reworded sentence, in either or both languages. Dot-separated; array indices are numeric
 * segments (`explainSections.0.p.1`). A deleted key and an edited value are different shapes of
 * drift, which is why they are two separate lists rather than one.
 *
 * The tooltip-on-subtext feature (2026-08-19): `phasesGoldActualHint` was reworded from
 * "Wiki × (1 + team coin % on Account)" to "base value × (1 + your skill tree's team coin %)" —
 * "Wiki" -> "base value" for the same reason the drop-chance hint moved (the merged row already
 * shows the wiki number inline, so calling it "Wiki" a second time in the tooltip was the
 * confusing name), plus naming the account.tree source explicitly to match the drop-chance hint's
 * "your skill tree's Sorte" phrasing. `phasesXpActualHint` and `phasesDropActualHint` got the
 * same edit but are not listed here: both are already in `KEYS_ADDED` above (added since the last
 * re-baseline, never yet in the frozen fixture), and an added key's value is unconstrained by the
 * comparison regardless of what it is.
 */
const PROSE_EDITED_PATHS: readonly string[] = ['phasesGoldActualHint'];

function omitKeys<T extends Record<string, unknown>>(obj: T, keys: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = { ...obj };
  for (const key of keys) delete out[key];
  return out as Partial<T>;
}

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
  // (docs/naming.md:74) between re-baselines (see the file-top comment for the 2026-08-17
  // one). Parity is measured against the fixture minus KEYS_REMOVED — every undeclared drift
  // stays fatal in both directions.
  it('STRINGS.en differs from the frozen fixture (minus declared-removed keys) at exactly the declared deltas', () => {
    const diffs = diffLeafPaths(STRINGS.en, omitKeys(fixture.en, KEYS_REMOVED)).sort();
    expect(diffs).toEqual([...PROSE_EDITED_PATHS, ...KEYS_ADDED].sort());
  });

  it('STRINGS.pt differs from the frozen fixture (minus declared-removed keys) at exactly the declared deltas', () => {
    const diffs = diffLeafPaths(STRINGS.pt, omitKeys(fixture.pt, KEYS_REMOVED)).sort();
    expect(diffs).toEqual([...PROSE_EDITED_PATHS, ...KEYS_ADDED].sort());
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

  it('sorted key-name list is unchanged vs fixture minus declared-removed keys, plus declared-added keys', () => {
    const fromSplit = Object.keys(STRINGS.en).sort();
    const fromFixture = [...Object.keys(omitKeys(fixture.en, KEYS_REMOVED)), ...KEYS_ADDED].sort();
    expect(fromSplit).toEqual(fromFixture);
  });

  it('every declared-removed key was present in the frozen fixture, both languages', () => {
    for (const key of KEYS_REMOVED) {
      expect(key in fixture.en, `${key} missing from fixture.en`).toBe(true);
      expect(key in fixture.pt, `${key} missing from fixture.pt`).toBe(true);
    }
  });

  it('every declared-removed key is absent from STRINGS, both languages', () => {
    for (const key of KEYS_REMOVED) {
      expect(key in STRINGS.en, `${key} still present in STRINGS.en`).toBe(false);
      expect(key in STRINGS.pt, `${key} still present in STRINGS.pt`).toBe(false);
    }
  });

  it('every declared-added key is absent from the frozen fixture and present in STRINGS, both languages', () => {
    for (const key of KEYS_ADDED) {
      expect(key in fixture.en, `${key} unexpectedly present in fixture.en`).toBe(false);
      expect(key in fixture.pt, `${key} unexpectedly present in fixture.pt`).toBe(false);
      expect(key in STRINGS.en, `${key} missing from STRINGS.en`).toBe(true);
      expect(key in STRINGS.pt, `${key} missing from STRINGS.pt`).toBe(true);
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
