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
  // pfr-web-ui (T1, AD-PFR-17): the Phases page is renamed Farm — navPhases's VALUE
  // changes to "Farm" in both languages (key name kept, ASM-C4/i18n.md rule 3).
  'navPhases',
].sort();

/**
 * MP5 F4 (T8, MSG-14) — genuinely NEW keys with no counterpart in the frozen fixture at all
 * (not a prose edit of an existing key). `diffLeafPaths` reports "present in STRINGS, absent
 * from the fixture" the same way it reports a changed value, so this list is folded into the
 * "differs at exactly" comparisons alongside `KEYSTONE_PROSE_EDITED_PATHS`, and separately
 * excluded from the sorted-key-set comparison (which compares SETS, not diffs).
 */
const F4_KEYS_ADDED = ['importRejectedUnsupportedShape'] as const;

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
  it('STRINGS.en differs from the frozen fixture (minus removed keys) at exactly the enumerated prose edits plus F4\'s new keys', () => {
    const diffs = diffLeafPaths(STRINGS.en, omitKeys(fixture.en, KEYSTONE_KEYS_REMOVED)).sort();
    expect(diffs).toEqual([...KEYSTONE_PROSE_EDITED_PATHS, ...F4_KEYS_ADDED].sort());
  });

  it('STRINGS.pt differs from the frozen fixture (minus removed keys) at exactly the enumerated prose edits plus F4\'s new keys', () => {
    const diffs = diffLeafPaths(STRINGS.pt, omitKeys(fixture.pt, KEYSTONE_KEYS_REMOVED)).sort();
    expect(diffs).toEqual([...KEYSTONE_PROSE_EDITED_PATHS, ...F4_KEYS_ADDED].sort());
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

  it('sorted key-name list is unchanged vs fixture minus the removed keystone keys, plus F4\'s new keys', () => {
    const fromSplit = Object.keys(STRINGS.en).sort();
    const fromFixture = [...Object.keys(omitKeys(fixture.en, KEYSTONE_KEYS_REMOVED)), ...F4_KEYS_ADDED].sort();
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
