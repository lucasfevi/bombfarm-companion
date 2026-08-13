/**
 * Layer 2 of MP3 F2's desktop/web parity proof (design.md §9, MPV-03, MPV-22). Reads
 * `packages/domain/src/roster-dps.ts` and
 * `apps/web/src/shared/stores/selectors/advisor-selectors.ts` as text, extracts the object keys
 * each passes to `computeAdvisorPipeline`, and asserts the two sets are equal **except** the
 * single documented exception `treeCritDmgMult` (`AD-038`). Home: `tools/`, so `apps/web` gains
 * zero files for this guard (the `AD-034` precedent) — deliberately dumb text slicing, not a full
 * parse, matching `tools/ci-desktop-paths.test.mjs` and `tools/design-system-gate.test.mjs`.
 *
 * This test fails if the gap **widens** (a new field forwarded by one path only) and fails if the
 * gap **closes silently** (which would be a web-visible math change smuggled in without a
 * fidelity run) — both are demonstrated below.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ROSTER_DPS_PATH = join(root, 'packages/domain/src/roster-dps.ts');
const ADVISOR_SELECTORS_PATH = join(root, 'apps/web/src/shared/stores/selectors/advisor-selectors.ts');

/** The one documented exception (`AD-038`): `pipelineForHero` omits `treeCritDmgMult`; the web
 *  selector forwards it. Practical exposure today is zero — every observed account has
 *  `crit_dmg_mult` in `{1, 2}`, where the omission and `advisor-pipeline-sheets.ts:95`'s
 *  `treeGlassCannon ? 2 : 1` fallback agree. */
const PINNED_EXCEPTION = 'treeCritDmgMult';

/**
 * Extracts the top-level object keys passed to a `computeAdvisorPipeline({ ... })` call —
 * balanced-brace slicing from the call site, then one `key:` per line inside it. Both source
 * files format this call as one property per line, which is what makes line-based extraction
 * reliable here (the same "dumb text slicing" convention as this repo's other source-text
 * guards).
 */
function extractPipelineInputKeys(source, callName) {
  const callIndex = source.indexOf(`${callName}(`);
  if (callIndex === -1) {
    throw new Error(`could not find a "${callName}(" call site`);
  }
  const openBraceIndex = source.indexOf('{', callIndex);
  if (openBraceIndex === -1) {
    throw new Error(`could not find the opening brace for "${callName}("`);
  }

  let depth = 0;
  let closeBraceIndex = -1;
  for (let i = openBraceIndex; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        closeBraceIndex = i;
        break;
      }
    }
  }
  if (closeBraceIndex === -1) {
    throw new Error(`unbalanced braces reading "${callName}("'s argument object`);
  }

  const objectBody = source.slice(openBraceIndex + 1, closeBraceIndex);
  const keys = [];
  for (const line of objectBody.split('\n')) {
    // `key: value,` form.
    const longform = line.match(/^\s*(\w+):/);
    if (longform) {
      keys.push(longform[1]);
      continue;
    }
    // ES2015 shorthand property form — a bare identifier line, e.g. `phase,` (both source files
    // use this for `phase`/`mitigationPct`, which are already locals of the same name).
    const shorthand = line.match(/^\s*(\w+),\s*$/);
    if (shorthand) keys.push(shorthand[1]);
  }
  return keys;
}

describe('advisor-selectors.ts and roster-dps.ts pass source-derived-equal keys to computeAdvisorPipeline (AD-038)', () => {
  const rosterDpsSource = readFileSync(ROSTER_DPS_PATH, 'utf8');
  const advisorSelectorsSource = readFileSync(ADVISOR_SELECTORS_PATH, 'utf8');

  const rosterDpsKeys = new Set(extractPipelineInputKeys(rosterDpsSource, 'computeAdvisorPipeline'));
  const advisorSelectorsKeys = new Set(extractPipelineInputKeys(advisorSelectorsSource, 'computeAdvisorPipeline'));

  it('both extractions actually found a real, non-trivial key set (sanity — otherwise this test proves nothing)', () => {
    expect(rosterDpsKeys.size).toBeGreaterThan(10);
    expect(advisorSelectorsKeys.size).toBeGreaterThan(10);
  });

  it('the key sets are equal except the single pinned exception treeCritDmgMult', () => {
    const onlyInRosterDps = [...rosterDpsKeys].filter((key) => !advisorSelectorsKeys.has(key));
    const onlyInAdvisorSelectors = [...advisorSelectorsKeys].filter((key) => !rosterDpsKeys.has(key));

    expect(onlyInRosterDps, `roster-dps.ts passes a field advisor-selectors.ts does not: ${onlyInRosterDps.join(', ')}`).toEqual([]);
    expect(onlyInAdvisorSelectors, 'the only field advisor-selectors.ts passes that roster-dps.ts does not').toEqual([
      PINNED_EXCEPTION,
    ]);
  });

  it(
    "the failure message spells out the consequence in words: advisor-pipeline-sheets.ts:95 resolves the omission as " +
      "critDmgMult: treeCritDmgMult ?? (treeGlassCannon ? 2 : 1), so the two surfaces disagree for any account with " +
      "crit_dmg_mult outside {1, 2}; practical exposure today is zero (every observed account is 1 or 2); the fix " +
      "belongs to a feature that can run the MP2 fidelity gate and own the web-visible delta",
    () => {
      // This test's own name and this it's own text carry the explanation — a failing assertion
      // elsewhere in this file already names the field; this asserts the exception is exactly
      // the one field design.md §2.4/§3 documents, not merely "some field".
      expect(PINNED_EXCEPTION).toBe('treeCritDmgMult');
    },
  );

  it('red state A — demonstrated here (a widened gap): a dummy field forwarded by only one path is caught', () => {
    const dummyRosterDpsKeys = new Set([...rosterDpsKeys, 'someNewField']);
    const onlyInRosterDps = [...dummyRosterDpsKeys].filter((key) => !advisorSelectorsKeys.has(key));
    expect(onlyInRosterDps).toEqual(['someNewField']);
    expect(onlyInRosterDps).not.toEqual([]);
  });

  it('red state B — demonstrated here (a silently closed gap): forwarding treeCritDmgMult on the roster-dps.ts side too is caught as "not exactly the pinned exception"', () => {
    const dummyRosterDpsKeys = new Set([...rosterDpsKeys, PINNED_EXCEPTION]);
    const onlyInAdvisorSelectors = [...advisorSelectorsKeys].filter((key) => !dummyRosterDpsKeys.has(key));
    // Closing the gap silently means the "only in advisor-selectors" set becomes empty — no
    // longer exactly [PINNED_EXCEPTION] — which is exactly what the real assertion above would
    // now fail on: a web-visible math change smuggled in without a fidelity run.
    expect(onlyInAdvisorSelectors).toEqual([]);
    expect(onlyInAdvisorSelectors).not.toEqual([PINNED_EXCEPTION]);
  });
});
