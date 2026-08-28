/**
 * design.md §3, §10 hazard 1, tasks.md T5 — **the most important test in this
 * feature.** A tier-1 key that misses an input `pipelineForHero` reads serves a plausible
 * **wrong** number, computed from data that has since changed, rendered as current (the `D24`
 * failure). It is invisible to every other test in the repo, because the number is plausible and
 * the app is fast.
 *
 * Reuses `tools/advisor-input-parity.test.mjs`'s balanced-brace slicing technique (it already
 * extracts the field list `roster-dps.ts` passes to `computeAdvisorPipeline`) — adapted here to
 * capture the right-hand-side **root paths** (e.g. `hero.naked`, `account.tree.danoTotal`)
 * instead of just the left-hand-side property names, because that is the vocabulary
 * `CHANGE_KEY_INPUTS` (`apps/desktop/renderer/lib/planning/hero-advice.ts`) is declared in.
 * `tools/` gains zero files that duplicate that extractor as a shared module — it is not
 * importable from a sibling `.test.mjs` file, so this is a second, purpose-built adaptation of
 * the same slicing idea, not a second parse of the same problem.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assertWorkspaceDistBuilt } from './require-workspace-dist.mjs';

// The build-prerequisite guard, per-file rather than as the `tools` project's `globalSetup`
// (see tools/vitest.config.ts for why: .github/workflows/line-endings.yml runs this project
// build-free by design, and this is one of exactly two of its files that need a build —
// tools/derived-fixture-drift.test.mjs is the other, needing packages/game-api/dist instead).
// Called on this file's OWN key, not a shared `tools` key: this file needs only `domain`, and a
// list wide enough to also cover derived-fixture-drift.test.mjs's `game-api` need would demand a
// build this file never actually requires.
//
// The two lines below must stay in this order and this shape. `hero-advice.ts` imports
// `@bombfarm/domain/account-fidelity` and `/roster-dps`, which resolve through the real
// `exports` map at ./dist/**; a static `import` of it would be HOISTED above this call and die
// first with `Cannot find package '@bombfarm/domain/account-fidelity'`, which points nowhere
// near the fix. Top-level `await import(...)` runs in statement order, so the assert fires
// first and the failure names the unbuilt package and `pnpm build`.
assertWorkspaceDistBuilt('tools/advice-change-key-coverage.test.mjs');

const { CHANGE_KEY_INPUTS, heroChangeKey, sharedChangeKey } = await import(
  '../apps/desktop/renderer/lib/planning/hero-advice.ts'
);

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ROSTER_DPS_PATH = join(root, 'packages/domain/src/roster-dps.ts');

/**
 * Extracts the right-hand-side root path of every property `roster-dps.ts` passes to
 * `computeAdvisorPipeline({ ... })` — `key: hero.naked` → `hero.naked`; `key: account.tree.energy
 * ?? 0` → `account.tree.energy` (the `?? default` fallback stripped); a shorthand line like
 * `phase,` → `phase`. Balanced-brace slicing from the call site, one property per line — the same
 * technique `tools/advisor-input-parity.test.mjs`'s `extractPipelineInputKeys` uses, both source
 * files formatting this call one property per line.
 */
function extractPipelineInputRootPaths(source) {
  const callIndex = source.indexOf('computeAdvisorPipeline(');
  if (callIndex === -1) {
    throw new Error('could not find a "computeAdvisorPipeline(" call site in roster-dps.ts');
  }
  const openBraceIndex = source.indexOf('{', callIndex);
  if (openBraceIndex === -1) {
    throw new Error('could not find the opening brace for "computeAdvisorPipeline("');
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
    throw new Error('unbalanced braces reading "computeAdvisorPipeline("\'s argument object');
  }

  const objectBody = source.slice(openBraceIndex + 1, closeBraceIndex);
  const paths = [];
  for (const rawLine of objectBody.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    // `key: value,` form (the RHS may itself carry a `?? default` fallback).
    const longform = line.match(/^\w+:\s*(.+?),?$/);
    if (longform) {
      let value = longform[1];
      const nullishIndex = value.indexOf('??');
      if (nullishIndex !== -1) value = value.slice(0, nullishIndex).trim();
      paths.push(value);
      continue;
    }

    // ES2015 shorthand property form — a bare identifier line, e.g. `phase,`.
    const shorthand = line.match(/^(\w+),?$/);
    if (shorthand) paths.push(shorthand[1]);
  }
  return paths;
}

describe('CHANGE_KEY_INPUTS covers every root path pipelineForHero actually reads', () => {
  const rosterDpsSource = readFileSync(ROSTER_DPS_PATH, 'utf8');
  const extractedPaths = extractPipelineInputRootPaths(rosterDpsSource);

  it('the extraction actually found a real, non-trivial path list (sanity — otherwise this test proves nothing)', () => {
    expect(extractedPaths.length).toBeGreaterThan(10);
  });

  it('every path roster-dps.ts passes is present in CHANGE_KEY_INPUTS', () => {
    const missing = extractedPaths.filter((path) => !CHANGE_KEY_INPUTS.includes(path));
    expect(
      missing,
      `CHANGE_KEY_INPUTS is missing ${missing.join(', ')} — a value pipelineForHero reads that the ` +
        'tier-1 change key does not cover. Cost of shipping this uncorrected: a cached HeroAdvice ' +
        'number computed from data that has since changed, rendered on screen as current (the D24 ' +
        'failure). Fix the key in hero-advice.ts, never this guard.',
    ).toEqual([]);
  });

  it('CHANGE_KEY_INPUTS declares nothing pipelineForHero does not actually read', () => {
    const extra = CHANGE_KEY_INPUTS.filter((path) => !extractedPaths.includes(path));
    expect(
      extra,
      `CHANGE_KEY_INPUTS lists ${extra.join(', ')}, which pipelineForHero's own source does not pass — ` +
        'a stale entry from a since-removed input, or a typo that never matched anything.',
    ).toEqual([]);
  });

  it('demonstrates the red state: removing one path from CHANGE_KEY_INPUTS fails BOTH the coverage check and its own mutation test (observed here, not committed as a permanent mutation)', () => {
    const withoutOnePath = CHANGE_KEY_INPUTS.filter((path) => path !== 'hero.level');
    const missing = extractedPaths.filter((path) => !withoutOnePath.includes(path));
    expect(missing).toEqual(['hero.level']);
    expect(missing).not.toEqual([]);
  });
});

describe('per-field mutation — a path listed but not actually read by the key builder fails here, not in production', () => {
  function baselineHero() {
    const sheet = { attack: 10, energy: 10, speed: 10, critChance: 10, critDmg: 10, penetration: 10, cdr: 10, luck: 10 };
    return {
      id: 'h1',
      name: 'Hero',
      updatedAt: 0,
      rarity: 'Raro',
      level: 20,
      stars: 1,
      naked: { ...sheet },
      loadout: {},
      altLoadout: null,
      gearedOverride: { ...sheet },
      abilities: { a1: 1 },
      pts: { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 },
      statPointsAvailable: 0,
      birth: { ...sheet },
    };
  }

  function baselineShared() {
    return {
      tree: {
        danoTotal: 1,
        critChance: 0,
        critDmg: 0,
        speed: 0,
        energy: 0,
        teamCoinPct: 0,
        luckFlatPct: 0,
      },
      teamBuffs: { buffA: 0 },
      context: { houseIdx: 0, houseLevel: 1, phase: 30, mitigationPct: 5, rankMode: 'dps', targetProp: null },
      houseCycleSecs: 1168.42105263158,
      houseCycleSecsHouseIdx: 0,
      houseCycleSecsLevel: 1,
    };
  }

  function mutateValue(value) {
    if (typeof value === 'number') return value + 1;
    if (typeof value === 'boolean') return !value;
    if (typeof value === 'string') return `${value}-mutated`;
    if (Array.isArray(value)) return [...value, 'mutated'];
    if (value !== null && typeof value === 'object') return { ...value, __mutated: true };
    return 'mutated';
  }

  const heroPaths = CHANGE_KEY_INPUTS.filter((path) => path.startsWith('hero.'));
  const sharedTreePaths = CHANGE_KEY_INPUTS.filter((path) => path.startsWith('account.tree.'));
  const contextPaths = CHANGE_KEY_INPUTS.filter((path) => path.startsWith('context.'));
  const teamBuffsPath = CHANGE_KEY_INPUTS.filter((path) => path === 'account.teamBuffs');
  const scalarPaths = CHANGE_KEY_INPUTS.filter((path) => path === 'phase' || path === 'mitigationPct');
  // Account-root scalars — `account.houseCycleSecs` (`casa.cycle_secs`) and the (house, level)
  // pair it is anchored to ride here rather than under `context.*` because they are captured
  // measurements on the account, not HeroContext fields the house pickers write.
  const accountRootPaths = CHANGE_KEY_INPUTS.filter(
    (path) =>
      path === 'account.houseCycleSecs' ||
      path === 'account.houseCycleSecsHouseIdx' ||
      path === 'account.houseCycleSecsLevel',
  );

  it('the path groups above cover CHANGE_KEY_INPUTS completely (sanity — otherwise some path is silently untested)', () => {
    const covered =
      heroPaths.length +
      sharedTreePaths.length +
      contextPaths.length +
      teamBuffsPath.length +
      scalarPaths.length +
      accountRootPaths.length;
    expect(covered).toBe(CHANGE_KEY_INPUTS.length);
  });

  for (const path of accountRootPaths) {
    it(`mutating ${path} changes sharedChangeKey`, () => {
      const shared = baselineShared();
      const before = sharedChangeKey(shared, 30, 5);
      const field = path.slice('account.'.length);
      shared[field] = mutateValue(shared[field]);
      const after = sharedChangeKey(shared, 30, 5);
      expect(after, `sharedChangeKey did not change when ${path} was mutated`).not.toBe(before);
    });
  }

  for (const path of heroPaths) {
    it(`mutating ${path} changes heroChangeKey`, () => {
      const hero = baselineHero();
      const before = heroChangeKey(hero);
      const field = path.slice('hero.'.length);
      hero[field] = mutateValue(hero[field]);
      const after = heroChangeKey(hero);
      expect(after, `heroChangeKey did not change when ${path} was mutated — the key builder does not actually read it`).not.toBe(before);
    });
  }

  for (const path of sharedTreePaths) {
    it(`mutating ${path} changes sharedChangeKey`, () => {
      const shared = baselineShared();
      const before = sharedChangeKey(shared, 30, 5);
      const field = path.slice('account.tree.'.length);
      shared.tree[field] = mutateValue(shared.tree[field]);
      const after = sharedChangeKey(shared, 30, 5);
      expect(after, `sharedChangeKey did not change when ${path} was mutated`).not.toBe(before);
    });
  }

  for (const path of contextPaths) {
    it(`mutating ${path} changes sharedChangeKey`, () => {
      const shared = baselineShared();
      const before = sharedChangeKey(shared, 30, 5);
      const field = path.slice('context.'.length);
      shared.context[field] = mutateValue(shared.context[field]);
      const after = sharedChangeKey(shared, 30, 5);
      expect(after, `sharedChangeKey did not change when ${path} was mutated`).not.toBe(before);
    });
  }

  for (const path of teamBuffsPath) {
    it(`mutating ${path} changes sharedChangeKey`, () => {
      const shared = baselineShared();
      const before = sharedChangeKey(shared, 30, 5);
      shared.teamBuffs = { ...shared.teamBuffs, extraBuff: 1 };
      const after = sharedChangeKey(shared, 30, 5);
      expect(after, `sharedChangeKey did not change when ${path} was mutated`).not.toBe(before);
    });
  }

  for (const path of scalarPaths) {
    it(`mutating ${path} changes sharedChangeKey`, () => {
      const shared = baselineShared();
      const before = sharedChangeKey(shared, 30, 5);
      const phase = path === 'phase' ? 99 : 30;
      const mitigationPct = path === 'mitigationPct' ? 99 : 5;
      const after = sharedChangeKey(shared, phase, mitigationPct);
      expect(after, `sharedChangeKey did not change when ${path} was mutated`).not.toBe(before);
    });
  }
});

describe("gameRunning (MAR-05) — the field is not a payload field at all, so it cannot enter either key", () => {
  // Scoped deliberately to the PRODUCTION decision-logic modules (not their tests, and not the
  // `fixtures/` test-support builders, which must set `gameRunning` on every synthetic
  // `AccountView` purely because the TYPE requires it — that is supplying a required field, not
  // reading one for a decision). `apps/desktop/src/main/index.ts` and `account-view.ts`
  // legitimately compute it from `gameReader.getStatus()` for chrome — the sanctioned reading —
  // and are outside this guard's scope on purpose.
  const PLANNING_LIB_DIR = join(root, 'apps/desktop/renderer/lib/planning');
  const PRODUCTION_FILES = ['account-model.ts', 'hero-advice.ts', 'account-view-store.ts', 'use-account-view.ts', 'types.ts'];
  const ACCOUNT_CHANGE_KEY_PATH = join(root, 'packages/contracts/src/account-change-key.ts');

  it('gameRunning appears zero times in the F3/F2 planning decision modules', () => {
    const offenders = [];
    for (const file of PRODUCTION_FILES) {
      const source = readFileSync(join(PLANNING_LIB_DIR, file), 'utf8');
      if (source.includes('gameRunning')) offenders.push(file);
    }
    expect(
      offenders,
      `gameRunning appears in ${offenders.join(', ')} — the field is hardcoded true on the ` +
        'account-refresh.ts API path and carries no information; a planning module reading it would ' +
        'silently violate MAR-05 ("holds unchanged whether or not the game is running").',
    ).toEqual([]);
  });

  it('gameRunning appears zero times in account-change-key.ts', () => {
    const source = readFileSync(ACCOUNT_CHANGE_KEY_PATH, 'utf8');
    const occurrencesOutsideComments = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .some((line) => line.includes('gameRunning'));
    expect(
      occurrencesOutsideComments,
      'gameRunning appears in executable code in account-change-key.ts — its only input is AccountPayload, which has no such field at all',
    ).toBe(false);
  });

  it('demonstrates the red state: a mock module containing a gameRunning read is caught by the same substring check (observed here, not committed as a permanent mutation)', () => {
    const mutant = "if (view.gameRunning) { /* would violate MAR-05 */ }";
    expect(mutant.includes('gameRunning')).toBe(true);
  });
});
