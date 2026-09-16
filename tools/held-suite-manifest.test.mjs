import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CAPTURE_REGISTRY, isInRegimeFor, MECHANICS } from '../packages/domain/tests/helpers/capture-regime.ts';
import { HELD_SUITES } from './held-suites.manifest.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const SCAN_ROOTS = ['packages/domain/tests', 'apps/web/src/tests'];

const HOLD_HELPERS = ['holdSuiteUntilInRegime', 'holdTeamPlanSuiteUntilInRegime', 'skipUnlessInRegime'];
const THROWING_HELPER = 'assertInRegime';

const REGIME_HELPER = 'packages/domain/tests/helpers/capture-regime.ts';
const TEAM_PLAN_HELPER = 'packages/domain/tests/helpers/team-plan-fixtures.ts';
const NOT_CONSUMERS = [
  REGIME_HELPER,
  TEAM_PLAN_HELPER,
  'packages/domain/tests/capture-regime.test.ts',
  'packages/domain/tests/capture-regime-expiry.test.ts',
];

const CALL_PATTERN = new RegExp(`\\b(${[...HOLD_HELPERS, THROWING_HELPER].join('|')})\\(`, 'g');
const CAPTURE_ARGS_PATTERN = /^(?:\w+,\s*)?`([\w./-]*)\$\{(\w+)\}`,\s*'(\w+)'\s*\)/;
const WRAPPER_BODY_PATTERN =
  /function holdTeamPlanSuiteUntilInRegime\(\)[^{]*\{\s*for \(const (\w+) of \[([^\]]+)\]\) \{\s*holdSuiteUntilInRegime\(`([\w./-]*)\$\{\1\}`, '(\w+)'\)/;

function toRepoPath(absolute) {
  return relative(root, absolute).split('\\').join('/');
}

function listTestSources(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) listTestSources(full, acc);
    else if (/\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

function importedNames(clause) {
  return clause
    .split(',')
    .map((name) => name.trim().replace(/^type\s+/, '').replace(/\s+as\s+\w+$/, ''))
    .filter(Boolean);
}

function resolveStringConstant(absoluteFile, name, depth = 0) {
  const source = readFileSync(absoluteFile, 'utf8');
  const local = new RegExp(`^(?:export )?const ${name} = '([^']+)';`, 'm').exec(source);
  if (local) return local[1];
  if (depth > 0) return null;
  const importPattern = /import \{([^}]*)\} from '([^']+)';/g;
  for (const [, clause, specifier] of source.matchAll(importPattern)) {
    if (!importedNames(clause).includes(name)) continue;
    const helper = resolve(dirname(absoluteFile), specifier.endsWith('.ts') ? specifier : `${specifier}.ts`);
    return resolveStringConstant(helper, name, depth + 1);
  }
  return null;
}

function expandTeamPlanWrapper() {
  const helperPath = join(root, TEAM_PLAN_HELPER);
  const match = WRAPPER_BODY_PATTERN.exec(readFileSync(helperPath, 'utf8'));
  if (!match) {
    throw new Error(`${TEAM_PLAN_HELPER}: holdTeamPlanSuiteUntilInRegime() no longer has the shape this guard expands`);
  }
  const [, , names, dir, mechanic] = match;
  return names.split(',').map((name) => {
    const file = resolveStringConstant(helperPath, name.trim());
    if (file === null) throw new Error(`${TEAM_PLAN_HELPER}: cannot resolve ${name.trim()}`);
    return { capture: `${dir}${file}`, mechanic };
  });
}

/**
 * One record per capture a call site holds on: `{ suite, helper, capture, mechanic }`. The
 * team-plan wrapper yields two. Throws, naming the call site, on anything it cannot resolve.
 */
function scanHoldCallSites() {
  const holds = [];
  const throwingCallSites = [];
  const unresolvable = [];
  const wrapperExpansion = expandTeamPlanWrapper();
  for (const scanRoot of SCAN_ROOTS) {
    for (const absolute of listTestSources(join(root, scanRoot))) {
      const suite = toRepoPath(absolute);
      if (NOT_CONSUMERS.includes(suite)) continue;
      const source = readFileSync(absolute, 'utf8');
      for (const match of source.matchAll(CALL_PATTERN)) {
        const helper = match[1];
        const line = source.slice(0, match.index).split('\n').length;
        const where = `${suite}:${line}`;
        if (helper === THROWING_HELPER) {
          throwingCallSites.push(where);
          continue;
        }
        const rest = source.slice(match.index + match[0].length);
        if (helper === 'holdTeamPlanSuiteUntilInRegime') {
          if (!rest.startsWith(')')) {
            unresolvable.push(`${where}: ${helper}( takes no arguments`);
            continue;
          }
          for (const { capture, mechanic } of wrapperExpansion) holds.push({ suite, helper, capture, mechanic, where });
          continue;
        }
        const args = CAPTURE_ARGS_PATTERN.exec(rest);
        if (!args) {
          unresolvable.push(`${where}: ${helper}( arguments are not \`<dir>/\${CONST}\`, '<mechanic>'`);
          continue;
        }
        const [, dir, constant, mechanic] = args;
        const file = resolveStringConstant(absolute, constant);
        if (file === null) {
          unresolvable.push(`${where}: ${constant} is neither a string const in this file nor imported from a helper that defines one`);
          continue;
        }
        holds.push({ suite, helper, capture: `${dir}${file}`, mechanic, where });
      }
    }
  }
  return { holds, throwingCallSites, unresolvable };
}

function capturesOf(entry) {
  return [entry.capture].flat().sort();
}

function admissibleFor(mechanic) {
  return Object.keys(CAPTURE_REGISTRY).filter((path) => isInRegimeFor(path, mechanic)).sort();
}

function unique(values) {
  return [...new Set(values)].sort();
}

describe('held-suite manifest — every runtime regime hold is a recorded decision', () => {
  const { holds, throwingCallSites, unresolvable } = scanHoldCallSites();

  it('every hold call site resolves to a capture and a mechanic', () => {
    expect(unresolvable, 'call sites this guard could not resolve').toEqual([]);
  });

  it('non-vacuity: the scan finds the known helpers on a committed floor of files', () => {
    const callSites = unique(holds.map((hold) => hold.where));
    const files = unique(holds.map((hold) => hold.suite));
    expect(callSites.length, `hold call sites: ${callSites.join(', ')}`).toBeGreaterThanOrEqual(20);
    expect(files.length, `files with a hold: ${files.join(', ')}`).toBeGreaterThanOrEqual(20);
    expect(unique(holds.map((hold) => hold.helper))).toEqual([...HOLD_HELPERS].sort());
    expect(throwingCallSites.length, 'assertInRegime call sites').toBeGreaterThanOrEqual(1);
  });

  it('every resolved capture is a registry key and every resolved mechanic is a known one', () => {
    const unknownCaptures = holds.filter((hold) => !Object.hasOwn(CAPTURE_REGISTRY, hold.capture)).map((hold) => `${hold.where} -> ${hold.capture}`);
    expect(unknownCaptures, 'a capture the resolver produced that CAPTURE_REGISTRY does not know').toEqual([]);
    const unknownMechanics = holds.filter((hold) => !Object.hasOwn(MECHANICS, hold.mechanic)).map((hold) => `${hold.where} -> ${hold.mechanic}`);
    expect(unknownMechanics, 'a mechanic the resolver produced that MECHANICS does not know').toEqual([]);
  });

  const heldCallSites = holds.filter((hold) => !isInRegimeFor(hold.capture, hold.mechanic));
  const heldSuites = unique(heldCallSites.map((hold) => hold.suite));
  const manifestedSuites = HELD_SUITES.map((entry) => entry.suite);

  it('the manifest is well-formed: unique suites, known mechanics, a re-arm sentence, a rejected map', () => {
    expect(unique(manifestedSuites).length, `duplicate suite entries: ${manifestedSuites.join(', ')}`).toBe(manifestedSuites.length);
    for (const entry of HELD_SUITES) {
      expect(Object.hasOwn(MECHANICS, entry.mechanic), `${entry.suite}: mechanic ${entry.mechanic}`).toBe(true);
      expect(typeof entry.rearmedBy === 'string' && entry.rearmedBy.trim().length > 0, `${entry.suite}: rearmedBy`).toBe(true);
      expect(entry.rejected !== null && typeof entry.rejected === 'object', `${entry.suite}: rejected`).toBe(true);
      for (const capture of capturesOf(entry)) {
        expect(Object.hasOwn(CAPTURE_REGISTRY, capture), `${entry.suite}: capture ${capture} is not a registry key`).toBe(true);
      }
    }
  });

  it('the suites actually held equal the manifested ones, in both directions', () => {
    const heldButNotManifested = heldSuites.filter((suite) => !manifestedSuites.includes(suite));
    const manifestedButNoLongerHeld = manifestedSuites.filter((suite) => !heldSuites.includes(suite));
    expect(heldButNotManifested, 'held but not manifested: add an entry with a rejected reason per admissible capture').toEqual([]);
    expect(
      manifestedButNoLongerHeld,
      'manifested but no longer held: the suite runs again, delete its entry',
    ).toEqual([]);
  });

  it("each manifest entry's capture and mechanic are what the scan resolved for that suite", () => {
    const stale = [];
    for (const entry of HELD_SUITES) {
      const resolved = heldCallSites.filter((hold) => hold.suite === entry.suite);
      if (resolved.length === 0) continue;
      const scannedCaptures = unique(resolved.map((hold) => hold.capture));
      const scannedMechanics = unique(resolved.map((hold) => hold.mechanic));
      if (JSON.stringify(scannedCaptures) !== JSON.stringify(capturesOf(entry))) {
        stale.push(`${entry.suite}: manifest capture ${JSON.stringify(entry.capture)}, scan resolved ${JSON.stringify(scannedCaptures)}`);
      }
      if (JSON.stringify(scannedMechanics) !== JSON.stringify([entry.mechanic])) {
        stale.push(`${entry.suite}: manifest mechanic ${entry.mechanic}, scan resolved ${scannedMechanics.join(', ')}`);
      }
    }
    expect(stale, 'a manifest entry describes a capture or mechanic the suite no longer reads').toEqual([]);
  });

  it('every admissible capture for a held suite is the one it reads or is rejected with a reason', () => {
    const unreviewed = [];
    for (const entry of HELD_SUITES) {
      const reads = capturesOf(entry);
      for (const capture of admissibleFor(entry.mechanic)) {
        if (reads.includes(capture)) continue;
        const reason = entry.rejected[capture];
        if (typeof reason === 'string' && reason.trim().length > 0) continue;
        unreviewed.push(`${entry.suite} could be re-pointed at ${capture} (admissible for ${entry.mechanic}) and rejected[] does not say why not`);
      }
    }
    expect(unreviewed, 'an admissible capture nobody has decided against').toEqual([]);
  });

  it('every rejected key names a capture that is admissible for that mechanic', () => {
    const phantom = [];
    for (const entry of HELD_SUITES) {
      const admissible = admissibleFor(entry.mechanic);
      for (const capture of Object.keys(entry.rejected)) {
        if (!admissible.includes(capture)) phantom.push(`${entry.suite}: rejected[${capture}] is not admissible for ${entry.mechanic}`);
      }
    }
    expect(phantom, 'a rejected key that is a typo, or a capture that left the registry or its regime').toEqual([]);
  });

  it('prints the held count so it is visible in every run', () => {
    console.log(`${heldSuites.length} suites held out of regime: ${heldSuites.join(', ')}`);
    expect(Number.isInteger(heldSuites.length)).toBe(true);
  });
});
