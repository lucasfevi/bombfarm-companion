/**
 * MP5 F3 — the repo-wide keystone identifier guard (MSC-04, `AD-080`). Scans exactly the four
 * roots spec.md's own AC and design.md's own clause table both name — `apps/web/**`,
 * `apps/desktop/**`, `packages/ui/**`, `tools/**` — never `packages/domain` (F2's surface, out of
 * F3's touch scope by the git protocol) and never repo-root `docs/` (outside the four stated
 * roots; `AD-080`'s two `docs/base-ui-first.md` / `docs/content-fit-ui.md` allowlist entries
 * describe provenance lines that live outside this guard's actual scan surface, so they need no
 * entry here — see `validation.md` for the measurement).
 *
 * Two clauses, per `AD-080`:
 *   A — hard zero for `keystone`/`abisso`/`glassCannon`/`tempoDobrado` (and their casing/
 *       underscore/display-string variants) outside an explicit, non-wideable, per-file allowlist.
 *   B — a pinned `file → sorted line numbers` map for `critDmgMult`/`crit_dmg_mult`, because
 *       `packages/domain` deliberately kept the always-`1` combat pass-through (`AD-073`) and
 *       `apps/web` legitimately reads it (`advice-column.tsx`) — a hard zero on this token would
 *       force deleting a surviving public signature, crossing F3's own Out of Scope.
 *
 * `packages/ui` carries NO allowlist entry in either clause — that is the one surface where F3
 * can prove the deletion is total, and the surface the DS-09 story is about (`AD-082`).
 *
 * Re-pinned for MP5 F4 (`AD-090`, T12): both maps below were re-derived from the tree at F4's
 * T11 tip with the exact `git grep` commands this file runs — see the commit body for the raw
 * output. Re-pinned once, from the settled tree — never widened beyond what T9/T10/T11 actually
 * added, and never re-pinned mid-feature (T9–T11 deliberately left this file red).
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SCAN_ROOTS = ['apps/web', 'apps/desktop', 'packages/ui', 'tools'];

/**
 * Release-note prose is outside both clauses' scan surface.
 *
 * `changeset version` moves the SAME text from `.changeset/<name>.md` into the `CHANGELOG.md` of
 * every package the batch bumps. A changeset describing this removal has to name what was
 * removed, so that text lives in a different file on the release branch than on `develop` — at
 * different line numbers, and in packages that carry no entry below. Pinning it therefore fails
 * every release instead of catching drift: release PR #67 went red on two CHANGELOGs that had
 * never held a token before and on a third whose count moved 3 -> 17, none of them a live
 * surface, while `develop` was green on identical source.
 *
 * This guard polices editable source. `AD-080`'s allowlist already classes CHANGELOGs as
 * "historical release prose" and `AD-082`'s surface 5 as "release-note history", so dropping
 * them keeps the stated intent and removes only the part that cannot hold still across a
 * release. Note this preserves `packages/ui`'s hard zero in substance — its generated release
 * notes were never the surface `AD-082` is about.
 */
const EXCLUDE_RELEASE_PROSE = [':(exclude)**/CHANGELOG.md', ':(exclude).changeset/*.md'];

function grepCounts(pattern, pathspecs) {
  let out;
  try {
    out = execFileSync('git', ['grep', '-nE', pattern, '--', ...pathspecs], {
      cwd: root,
      encoding: 'utf8',
    });
  } catch (err) {
    if (err.status === 1) return [];
    throw err;
  }
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const firstColon = line.indexOf(':');
      const secondColon = line.indexOf(':', firstColon + 1);
      return { file: line.slice(0, firstColon), lineNo: Number(line.slice(firstColon + 1, secondColon)) };
    });
}

// --- Clause A — hard zero, enumerated allowlist -------------------------------------------

const CLAUSE_A_PATTERN =
  'keystone|Keystone|abisso|Abisso|abissoBase|abisso_base|glassCannon|glass_cannon|tempoDobrado|tempo_dobrado|Glass Cannon|Tempo Dobrado';

/**
 * Every file below is a measured, justified survivor — none is a live, editable, or rendered
 * keystone surface. Categories:
 *   - F4-owned raw save/API schema literals (fingerprint key space, not typed tree fields)
 *   - The frozen i18n fixture (`docs/naming.md:74`, MOD-03) and F1's provenance manifest
 *   - CHANGELOGs (historical release prose)
 *   - This guard's own source, and the sibling `tools/` guards that must name the tokens they
 *     forbid or discharge (`AD-038`'s closed pin, F1's own negative-discriminator guard)
 *   - F3's OWN absence-proving tests and doc amendments — a test/doc that proves a keystone
 *     field or control is gone necessarily names it once. This category did not exist when
 *     `AD-080` was designed (before F3's suites and doc edits existed); it is measured here,
 *     not estimated. `packages/ui` gets none of this category — its bar is a hard zero with no
 *     exception, matched by construction (T5 re-skinned every story, no absence test needed to
 *     name the literal).
 *   - F4-owned drop-rule modules and their absence-proving tests (`AD-090`) — `stale-sections.ts`
 *     (desktop) and `stale-account.ts` (web) must each name the retired vocabulary they detect
 *     and delete; their test files, T7's `save-acceptance-guards.test.mjs`, and T8's
 *     `import-rejection-copy.test.ts` / `import.ts` forbidden-token comment all prove the same
 *     tokens are gone from a live surface. `apps/desktop/tests/fixtures/account-full.json` and
 *     `apps/web/e2e/fixtures/sample-save.json` are REMOVED from this list — T11 re-baselined both
 *     onto the post-patch schema, so neither carries a clause-A token anymore.
 */
const ALLOWLIST = [
  // Frozen fixture (MOD-03, docs/naming.md:74) — AD-081, byte-unchanged by design.
  { file: 'apps/web/src/tests/fixtures/i18n-strings-main.json', count: 32, owner: 'frozen fixture (AD-081)' },
  // F1's provenance manifest — must name the forbidden keys to forbid them.
  { file: 'apps/web/src/tests/fixtures/sheet-math/README.md', count: 2, owner: "F1 provenance manifest" },
  // (CHANGELOGs used to be pinned here; they are excluded from the scan now — see
  // EXCLUDE_RELEASE_PROSE for why an entry could not survive a release.)
  // tools/ guard sources that must name the forbidden/closed tokens to forbid/discharge them.
  { file: 'tools/advisor-input-parity.test.mjs', count: 1, owner: 'AD-038 closed-pin history (T9)' },
  { file: 'tools/fixture-corpus-parity.test.mjs', count: 8, owner: 'MFR-15 pattern + history + five-surface residual map (this guard\'s sibling)' },
  // F1's own negative-discriminator guard — must name the forbidden keys to forbid them.
  { file: 'apps/web/src/tests/fixture-corpus.test.ts', count: 3, owner: 'F1 negative-discriminator guard' },
  // F3's own doc amendments describing the removal (MSC-12 requires the local-data-compat.md
  // row; account-shared.ts's normalizeTree doc names the discarded stale keys it now discards).
  // F4/T9 (AD-089) adds a second local-data-compat.md mention (the superseding drop rule).
  { file: 'apps/web/docs/local-data-compat.md', count: 2, owner: 'F3 Removed-fields row (MSC-12) + F4/T9 AD-089 supersession' },
  { file: 'apps/web/src/shared/lib/account-shared.ts', count: 3, owner: 'F3 normalizeTree doc comment (MSC-10)' },
  { file: 'apps/web/src/tests/fixtures/storage-roundtrip-20260729.json', count: 1, owner: 'F3 fixture history log (AD-083)' },
  // F3's own absence-proving tests (MSC-01/03/05/06/07/10/18) — each must name the token once to
  // prove it is gone.
  { file: 'apps/web/e2e/account-panel.spec.ts', count: 8, owner: 'F3 MSC-01 DOM absence proof' },
  { file: 'apps/web/src/tests/account-slice.test.ts', count: 3, owner: 'F3 MSC-03 runtime absence proof' },
  { file: 'apps/web/src/tests/advisor-selectors.test.ts', count: 1, owner: 'F3 dep-tuple-length test title' },
  { file: 'apps/web/src/tests/derive.test.ts', count: 3, owner: 'F3 AC-29 compile-guard + explanatory comments' },
  { file: 'apps/web/src/tests/ds-panel-field.test.ts', count: 5, owner: 'F3 MSC-18 recipe absence proof' },
  { file: 'apps/web/src/tests/i18n-keystone-absence.test.ts', count: 9, owner: 'F3 MSC-05/06 value-scan suite' },
  { file: 'apps/web/src/tests/i18n-split-parity.test.ts', count: 10, owner: 'F3 MSC-07 KEYSTONE_KEYS_REMOVED list' },
  { file: 'apps/web/src/tests/import-inventory-sync.test.ts', count: 4, owner: 'F3 explanatory comment (recorded loss)' },
  { file: 'apps/web/src/tests/import-save.test.ts', count: 2, owner: 'F4/T7 flipped baseSave() literal + historical comment' },
  { file: 'apps/web/src/tests/stat-breakdown.test.ts', count: 1, owner: 'F3 explanatory comment' },
  { file: 'apps/web/src/tests/storage-legacy-keystone-fields.test.ts', count: 9, owner: 'F4/T9 AD-089 rewritten legacy-drop suite (supersedes MSC-10)' },
  // F4-owned drop-rule modules (AD-090: "a module that must name the vocabulary it forbids") and
  // their absence-proving / forbidden-token test suites.
  { file: 'apps/desktop/src/main/storage/stale-sections.ts', count: 2, owner: 'F4/T10 desktop drop-rule module (AD-089)' },
  { file: 'apps/desktop/src/main/storage/stale-sections.test.ts', count: 6, owner: 'F4/T10 desktop drop-rule absence proof (incl. the sole-cause discriminating case)' },
  { file: 'apps/desktop/src/main/storage/account-store-restore.test.ts', count: 2, owner: 'F4/T10 stale-section drop integration test' },
  { file: 'apps/web/src/shared/lib/stale-account.ts', count: 5, owner: 'F4/T9 web drop-rule module (AD-089)' },
  { file: 'apps/web/src/tests/stale-account-drop.test.ts', count: 8, owner: 'F4/T9 web drop-rule absence proof (incl. the presence-vs-truthiness discriminating case)' },
  { file: 'apps/web/src/shared/i18n/namespaces/import.ts', count: 1, owner: 'F4/T8 forbidden-token comment (MSG-14)' },
  { file: 'apps/web/src/tests/import-rejection-copy.test.ts', count: 3, owner: 'F4/T8 forbidden-token guard test' },
  { file: 'tools/save-acceptance-guards.test.mjs', count: 7, owner: 'F4/T7 acceptance-gate absence proof (MSG-11)' },
  // This guard's own source — its filename, doc comment and error messages necessarily name
  // the tokens it forbids (the same self-reference AD-080 allowlist #10 anticipates).
  { file: 'tools/keystone-surface-absence.test.mjs', count: 11, owner: 'this guard, self-reference' },
];

// --- Clause B — pinned per-line map for critDmgMult / crit_dmg_mult -----------------------

/**
 * `critDmgMult` names two populations (§0.3): the deleted `TreeState`-derived field (gone
 * everywhere) and the kept `CombatMults`/`DeriveInput`/`AdvisorPipelineResult`/`PipelineFacts`
 * combat pass-through (`AD-073`, hardcoded `1`). This map does not distinguish them by meaning —
 * it pins every surviving line, of either population, so a house move (delete from one line, add
 * on another) fails by name. `packages/ui` has zero lines and needs no entry.
 */
const CRIT_DMG_MULT_MAP = {
  'apps/desktop/renderer/lib/planning/account-model.test.ts': [46],
  'apps/desktop/renderer/lib/planning/account-view-store.test.ts': [36],
  'apps/desktop/renderer/lib/planning/fixtures/synthetic-views.ts': [123],
  'apps/desktop/renderer/lib/planning/hero-advice.test.ts': [47],
  'apps/desktop/renderer/lib/planning/withhold-matrix.test.ts': [192, 209],
  'apps/desktop/src/main/storage/account-store-restore.test.ts': [497, 530, 548, 581],
  'apps/desktop/src/main/storage/stale-sections.test.ts': [66, 81, 84, 88, 98, 105, 111, 123, 128, 164, 182],
  'apps/desktop/src/main/storage/stale-sections.ts': [11],
  // +2 (line numbers only) from the House/field-slots untangling follow-up: two new
  // AccountShared rows (`fieldSlots`, `houseCycleSecs`) landed above this section. Match itself
  // is unchanged in count and in kind.
  'apps/web/docs/local-data-compat.md': [108, 116],
  'apps/web/src/features/planner/components/advice-column.tsx': [38, 59],
  // +16 (line number only): the House-ceiling fix added `fieldSlots`/`houseCycleSecs`, with
  // their doc comments, to `AccountShared` above this line. The match itself is unchanged in
  // count and in kind — still `normalizeTree`'s doc comment naming a stale key it discards.
  // +11 more: the House-ceiling regression repair (PR #86 finding, house.ts:38) added
  // `houseCycleSecsHouseIdx`/`houseCycleSecsLevel`, with their doc comment, above this line too.
  'apps/web/src/shared/lib/account-shared.ts': [135],
  'apps/web/src/shared/lib/stale-account.ts': [20],
  'apps/web/src/tests/advisor-pipeline.test.ts': [85],
  'apps/web/src/tests/derive.test.ts': [
    75, 77, 158, 186, 225, 256, 281, 321, 335, 388, 428, 465, 512, 549,
  ],
  'apps/web/src/tests/fixture-corpus.test.ts': [23, 65],
  'apps/web/src/tests/fixtures/sheet-math/README.md': [6],
  'apps/web/src/tests/fixtures/storage-roundtrip-20260729.json': [3],
  'apps/web/src/tests/points-reopt.test.ts': [107, 491],
  'apps/web/src/tests/stale-account-drop.test.ts': [31, 72, 73, 78, 89],
  'apps/web/src/tests/stat-breakdown.test.ts': [133, 183, 210],
  'apps/web/src/tests/storage-legacy-keystone-fields.test.ts': [40, 109],
  'apps/web/src/tests/storage-stat-points-available-compat.test.ts': [104],
  'tools/fixture-corpus-parity.test.mjs': [117, 169],
  // Self-map. The last four shifted +3 (line numbers only) when the account-shared entry above
  // gained its three-line explanation; count and kind are unchanged.
  // Line numbers only — the House-ceiling regression repair (PR #86 finding, house.ts:38) added
  // explanatory comment lines above this point (the account-shared.ts entry above, and this
  // entry's own comment), shifting every self-reference below it down.
  // +3 (line numbers only) from the House/field-slots untangling follow-up's own explanatory
  // comment above the local-data-compat.md self-map entry. Count and kind unchanged.
  'tools/keystone-surface-absence.test.mjs': [13, 147, 150, 240, 245, 255, 264],
  'tools/save-acceptance-guards.test.mjs': [53],
};

describe('keystone surface absence — the repo-wide identifier guard (MP5 F3, MSC-04, AD-080)', () => {
  it('non-vacuity: the scan roots resolve to a non-empty, non-trivial file set', () => {
    const allFiles = execFileSync('git', ['ls-files', '--', ...SCAN_ROOTS], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
    expect(allFiles.length, `scanned roots: ${SCAN_ROOTS.join(', ')}`).toBeGreaterThan(500);
  });

  it('the clause-A allowlist is exactly the enumerated set (non-wideable)', () => {
    expect(ALLOWLIST.length).toBe(28);
    expect(ALLOWLIST.every((entry) => entry.file && entry.count > 0 && entry.owner)).toBe(true);
  });

  it('clause A — hard zero outside the allowlist, packages/ui included with NO exception', () => {
    const rows = grepCounts(CLAUSE_A_PATTERN, [...SCAN_ROOTS, ...EXCLUDE_RELEASE_PROSE]);
    const actual = {};
    for (const { file } of rows) actual[file] = (actual[file] ?? 0) + 1;

    const allowedFiles = new Set(ALLOWLIST.map((e) => e.file));
    const unexpected = Object.keys(actual).filter((f) => !allowedFiles.has(f));
    expect(unexpected, `unallowlisted file(s) with a clause-A match: ${unexpected.join(', ')}`).toEqual([]);

    const missing = ALLOWLIST.filter((e) => !(e.file in actual));
    expect(
      missing.map((e) => e.file),
      'allowlisted file(s) with zero matches — a stale entry, widening the list beyond what is real',
    ).toEqual([]);

    for (const entry of ALLOWLIST) {
      expect(actual[entry.file], `${entry.file} (${entry.owner}): match count`).toBe(entry.count);
    }

    const uiRows = rows.filter((r) => r.file.startsWith('packages/ui/'));
    expect(uiRows, 'packages/ui carries zero clause-A matches, no exception').toEqual([]);
  });

  it('clause B — critDmgMult/crit_dmg_mult fall on an exact, pinned per-file/per-line map', () => {
    const rows = grepCounts('\\bcritDmgMult\\b|\\bcrit_dmg_mult\\b', [
      ...SCAN_ROOTS,
      ...EXCLUDE_RELEASE_PROSE,
    ]);
    expect(rows.length, 'non-vacuity: at least one critDmgMult line must survive today').toBeGreaterThan(0);

    const actual = {};
    for (const { file, lineNo } of rows) {
      (actual[file] ??= []).push(lineNo);
    }
    for (const file of Object.keys(actual)) actual[file].sort((a, b) => a - b);

    const expectedFiles = Object.keys(CRIT_DMG_MULT_MAP).sort();
    const actualFiles = Object.keys(actual).sort();
    expect(actualFiles, 'unexpected file with a critDmgMult match, or a mapped file with none').toEqual(
      expectedFiles,
    );

    for (const file of expectedFiles) {
      expect(actual[file], `${file}: matched line numbers`).toEqual(CRIT_DMG_MULT_MAP[file]);
    }

    const uiRows = rows.filter((r) => r.file.startsWith('packages/ui/'));
    expect(uiRows, 'packages/ui carries zero critDmgMult matches').toEqual([]);
  });
});
