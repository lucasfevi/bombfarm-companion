/**
 * Layer 2 of the desktop/web parity proof. Reads
 * `packages/domain/src/roster-dps.ts` and
 * `apps/web/src/shared/stores/selectors/advisor-selectors.ts` as text, extracts the object keys
 * each builds its `AdvisorPipelineInput` from (`advisorInputForHero` / `advisorInput`, the one
 * literal each file hands `computeAdvisorPipeline`), and asserts the two sets are exactly equal. Home:
 * `tools/`, so `apps/web` gains zero files for this guard —
 * deliberately dumb text slicing, not a full parse, matching `tools/ci-desktop-paths.test.mjs`
 * and `tools/design-system-gate.test.mjs`.
 *
 * The single documented exception, `treeCritDmgMult`, closed: the field was
 * removed from both surfaces along with the rest of the deleted keystone mechanics, so the two
 * key sets are equal with no pinned exception. This test still fails if the gap
 * **widens** (a new field forwarded by one path only) — demonstrated below.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ROSTER_DPS_PATH = join(root, 'packages/domain/src/roster-dps.ts');
const ADVISOR_SELECTORS_PATH = join(root, 'apps/web/src/shared/stores/selectors/advisor-selectors.ts');

/**
 * Extracts the top-level object keys of the literal a named input-building function returns —
 * balanced-brace slicing from its `return {`, then one `key:` per line inside it. Both source
 * files format that literal as one property per line, which is what makes line-based extraction
 * reliable here (the same "dumb text slicing" convention as this repo's other source-text
 * guards).
 */
function extractPipelineInputKeys(source, functionName) {
  const functionIndex = source.indexOf(`function ${functionName}(`);
  if (functionIndex === -1) {
    throw new Error(`could not find a "function ${functionName}(" definition`);
  }
  const returnIndex = source.indexOf('return {', functionIndex);
  if (returnIndex === -1) {
    throw new Error(`could not find the returned literal of "${functionName}("`);
  }
  const openBraceIndex = source.indexOf('{', returnIndex);

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
    throw new Error(`unbalanced braces reading "${functionName}("'s returned object`);
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

describe('advisor-selectors.ts and roster-dps.ts build source-derived-equal inputs for computeAdvisorPipeline', () => {
  const rosterDpsSource = readFileSync(ROSTER_DPS_PATH, 'utf8');
  const advisorSelectorsSource = readFileSync(ADVISOR_SELECTORS_PATH, 'utf8');

  const rosterDpsKeys = new Set(extractPipelineInputKeys(rosterDpsSource, 'advisorInputForHero'));
  const advisorSelectorsKeys = new Set(extractPipelineInputKeys(advisorSelectorsSource, 'advisorInput'));

  it('both extractions actually found a real, non-trivial key set (sanity — otherwise this test proves nothing)', () => {
    expect(rosterDpsKeys.size).toBeGreaterThan(10);
    expect(advisorSelectorsKeys.size).toBeGreaterThan(10);
  });

  it('the key sets are exactly equal (the treeCritDmgMult exception closed: MP5 removed it from both surfaces)', () => {
    const onlyInRosterDps = [...rosterDpsKeys].filter((key) => !advisorSelectorsKeys.has(key));
    const onlyInAdvisorSelectors = [...advisorSelectorsKeys].filter((key) => !rosterDpsKeys.has(key));

    expect(onlyInRosterDps, `roster-dps.ts passes a field advisor-selectors.ts does not: ${onlyInRosterDps.join(', ')}`).toEqual([]);
    expect(onlyInAdvisorSelectors, `advisor-selectors.ts passes a field roster-dps.ts does not: ${onlyInAdvisorSelectors.join(', ')}`).toEqual([]);
  });

  it('red state A — demonstrated here (a widened gap): a dummy field forwarded by only one path is caught', () => {
    const dummyRosterDpsKeys = new Set([...rosterDpsKeys, 'someNewField']);
    const onlyInRosterDps = [...dummyRosterDpsKeys].filter((key) => !advisorSelectorsKeys.has(key));
    expect(onlyInRosterDps).toEqual(['someNewField']);
    expect(onlyInRosterDps).not.toEqual([]);
  });
});
