import { describe, expect, it } from 'vitest';
import {
  INITIAL_ZERO_COVERAGE_REASON,
  NEVER_LOADED_REASON,
  KIND,
  METRICS,
  MIN_BASELINE_FILES,
  TOLERANCE_PP,
  baselineIntegrityFindings,
  canonicalBaselineText,
  emptyBaseline,
  evaluateAgainstBaseline,
  formatReport,
  guardBaseFindings,
  leastCovered,
  measurementFindings,
  normalizeSummary,
  overallOf,
  percent,
  planUpdate,
} from './domain-coverage-core.mjs';

const NEVER_RUN = 'src/never-run.ts';
const TYPES_ONLY = 'src/types-only.ts';
const NEVER_LOADED = 'src/never-loaded.ts';

function sourceName(index) {
  return `src/file-${String(index).padStart(3, '0')}.ts`;
}

function recorded(statements, branches = 50, functions = 60, lines = 70) {
  return { statements, branches, functions, lines };
}

function observed(metrics, statementsTotal = 100) {
  return { ...metrics, statementsTotal, statementsCovered: Math.round((metrics.statements * statementsTotal) / 100) };
}

function world({ extraFiles = 5 } = {}) {
  const names = Array.from({ length: MIN_BASELINE_FILES + extraFiles }, (_, index) => sourceName(index));
  const files = Object.fromEntries(names.map((name, index) => [name, recorded(80 + (index % 10), 50, 60, 70)]));
  files[NEVER_RUN] = recorded(0, 0, 0, 0);
  const baseline = {
    files,
    unmeasured: ['src/types-only.ts'],
    zeroCoverageAllowed: { [NEVER_RUN]: 'recorded at baseline; no test exercises it yet' },
    waivers: {},
  };
  const measured = Object.fromEntries(Object.entries(files).map(([name, metrics]) => [name, observed(metrics)]));
  const sourceFiles = [...Object.keys(files), 'src/types-only.ts'].sort();
  const runtimeFiles = sourceFiles.filter((file) => file !== TYPES_ONLY);
  return { baseline, measured, sourceFiles, runtimeFiles };
}

function clone(value) {
  return structuredClone(value);
}

function summaryOfFindings(findings) {
  return findings.map((item) => [item.kind, item.file, String(item.metric)].join(' | ')).sort();
}

function evaluate(scenario) {
  return evaluateAgainstBaseline(scenario);
}

describe('percent and normalizeSummary', () => {
  it('a metric with nothing to cover is 100 percent', () => {
    expect(percent(0, 0)).toBe(100);
  });

  it('rounds to two decimals from the raw counts', () => {
    expect(percent(1, 3)).toBe(33.33);
    expect(percent(2, 3)).toBe(66.67);
    expect(percent(0, 7)).toBe(0);
  });

  const entry = (covered, total) => ({ total, covered, skipped: 0, pct: 0 });
  const summary = (key) => ({
    total: { lines: entry(1, 1), statements: entry(1, 1), functions: entry(1, 1), branches: entry(1, 1) },
    [key]: {
      lines: entry(9, 10),
      statements: entry(0, 4),
      functions: entry(0, 0),
      branches: entry(1, 3),
    },
  });

  it('turns a Windows absolute key into a package-relative path with raw statement counts', () => {
    const files = normalizeSummary(summary('C:\\repo\\packages\\domain\\src\\model\\house.ts'), 'C:/repo/packages/domain');
    expect(files).toEqual({
      'src/model/house.ts': {
        statements: 0,
        branches: 33.33,
        functions: 100,
        lines: 90,
        statementsCovered: 0,
        statementsTotal: 4,
      },
    });
  });

  it('turns a POSIX absolute key into the same relative path', () => {
    const files = normalizeSummary(summary('/home/runner/work/repo/packages/domain/src/a.ts'), '/home/runner/work/repo/packages/domain');
    expect(Object.keys(files)).toEqual(['src/a.ts']);
  });

  it('refuses a key outside the package source and names it', () => {
    expect(() => normalizeSummary(summary('C:\\repo\\packages\\farm\\src\\x.ts'), 'C:/repo/packages/domain')).toThrow(
      /outside C:\/repo\/packages\/domain\/src: C:\\repo\\packages\\farm\\src\\x\.ts/,
    );
  });

  it('reads the overall four metrics from the total key', () => {
    expect(overallOf(summary('C:\\repo\\packages\\domain\\src\\a.ts'))).toEqual({
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    });
  });
});

describe('the constants a reviewer can read', () => {
  it('the tolerance is zero percentage points', () => {
    expect(TOLERANCE_PP).toBe(0);
  });

  it('the floor is a positive number of files', () => {
    expect(MIN_BASELINE_FILES).toBeGreaterThan(50);
  });
});

describe('a measurement that equals the baseline', () => {
  it('has no findings', () => {
    expect(evaluate(world())).toEqual([]);
  });
});

describe('regression', () => {
  it('names the file, the metric, both numbers and the delta in percentage points', () => {
    const scenario = world();
    scenario.measured[sourceName(3)] = observed({ ...scenario.baseline.files[sourceName(3)], branches: 49.99 });
    const [only, ...rest] = evaluate(scenario);
    expect(rest).toEqual([]);
    expect(only).toMatchObject({
      kind: KIND.regression,
      file: sourceName(3),
      metric: 'branches',
      baseline: 50,
      measured: 49.99,
      deltaPp: -0.01,
    });
    expect(only.message).toContain(sourceName(3));
    expect(only.message).toContain('-0.01');
  });

  it('reports every metric that fell, in every file that fell, and nothing else', () => {
    const scenario = world();
    const first = scenario.baseline.files[sourceName(1)];
    const second = scenario.baseline.files[sourceName(2)];
    scenario.measured[sourceName(1)] = observed({ ...first, statements: first.statements - 5, lines: first.lines - 1 });
    scenario.measured[sourceName(2)] = observed({ ...second, functions: 0 });
    expect(summaryOfFindings(evaluate(scenario))).toEqual([
      `${KIND.regression} | ${sourceName(1)} | lines`,
      `${KIND.regression} | ${sourceName(1)} | statements`,
      `${KIND.regression} | ${sourceName(2)} | functions`,
    ]);
  });

  it('an improvement is not a finding', () => {
    const scenario = world();
    scenario.measured[sourceName(4)] = observed({ statements: 99, branches: 99, functions: 99, lines: 99 });
    expect(evaluate(scenario)).toEqual([]);
  });

  it('a file recorded in the baseline that produced no coverage regressed to nothing, and is named', () => {
    const scenario = world();
    delete scenario.measured[sourceName(7)];
    const findings = evaluate(scenario);
    expect(summaryOfFindings(findings)).toEqual([`${KIND.regression} | ${sourceName(7)} | all`]);
    expect(findings[0].measured).toBeNull();
  });
});

describe('unrecorded file', () => {
  it('a measured file absent from the baseline and the unmeasured list fails', () => {
    const scenario = world();
    scenario.measured['src/brand-new.ts'] = observed(recorded(90));
    scenario.sourceFiles.push('src/brand-new.ts');
    expect(summaryOfFindings(evaluate(scenario))).toEqual([
      `${KIND.sourceNotAccounted} | src/brand-new.ts | null`,
      `${KIND.unrecordedFile} | src/brand-new.ts | null`,
    ]);
  });

  it('passes once the file is recorded in the baseline', () => {
    const scenario = world();
    scenario.measured['src/brand-new.ts'] = observed(recorded(90));
    scenario.sourceFiles.push('src/brand-new.ts');
    scenario.baseline.files['src/brand-new.ts'] = recorded(90);
    expect(evaluate(scenario)).toEqual([]);
  });
});

describe('zero-coverage files', () => {
  function withNewZeroFile(scenario) {
    scenario.measured['src/fresh.ts'] = observed(recorded(0, 0, 0, 0), 12);
    scenario.baseline.files['src/fresh.ts'] = recorded(0, 0, 0, 0);
    scenario.sourceFiles.push('src/fresh.ts');
    return scenario;
  }

  it('a new source file nothing exercises fails the ratchet', () => {
    expect(summaryOfFindings(evaluate(withNewZeroFile(world())))).toEqual([
      `${KIND.unallowedZeroCoverage} | src/fresh.ts | null`,
    ]);
  });

  it('passes with an explicit reason', () => {
    const scenario = withNewZeroFile(world());
    scenario.baseline.zeroCoverageAllowed['src/fresh.ts'] = 'generated table; exercised through its consumer once that lands';
    expect(evaluate(scenario)).toEqual([]);
  });

  it('an allowance with an empty or blank reason is an offence of its own', () => {
    for (const reason of ['', '   ']) {
      const scenario = withNewZeroFile(world());
      scenario.baseline.zeroCoverageAllowed['src/fresh.ts'] = reason;
      expect(summaryOfFindings(evaluate(scenario))).toEqual([`${KIND.invalidAllowance} | src/fresh.ts | null`]);
    }
  });

  it('a measured zero with no baseline entry is named for both the missing record and the missing reason', () => {
    const scenario = world();
    scenario.measured['src/fresh.ts'] = observed(recorded(0, 0, 0, 0), 12);
    scenario.sourceFiles.push('src/fresh.ts');
    expect(summaryOfFindings(evaluate(scenario))).toEqual([
      `${KIND.sourceNotAccounted} | src/fresh.ts | null`,
      `${KIND.unallowedZeroCoverage} | src/fresh.ts | null`,
      `${KIND.unrecordedFile} | src/fresh.ts | null`,
    ]);
  });

  it('a file with no statements at all is not a zero-coverage file', () => {
    const scenario = world();
    scenario.measured['src/empty.ts'] = observed(recorded(100, 100, 100, 100), 0);
    scenario.baseline.files['src/empty.ts'] = recorded(100, 100, 100, 100);
    scenario.sourceFiles.push('src/empty.ts');
    expect(evaluate(scenario)).toEqual([]);
  });
});

describe('stale allowance', () => {
  it('an allowance for a file that no longer exists fails and names it', () => {
    const scenario = world();
    scenario.baseline.zeroCoverageAllowed['src/gone.ts'] = 'was never exercised';
    expect(summaryOfFindings(evaluate(scenario))).toEqual([`${KIND.staleAllowance} | src/gone.ts | null`]);
  });

  it('an allowance for a file now above zero fails, so the list can only shrink', () => {
    const scenario = world();
    scenario.measured[NEVER_RUN] = observed(recorded(35, 10, 10, 10));
    expect(summaryOfFindings(evaluate(scenario))).toEqual([`${KIND.staleAllowance} | ${NEVER_RUN} | null`]);
  });

  it('an allowance whose baseline entry was raised above zero fails too', () => {
    const scenario = world();
    scenario.baseline.files[NEVER_RUN] = recorded(10);
    scenario.measured[NEVER_RUN] = observed(recorded(10));
    expect(summaryOfFindings(evaluate(scenario))).toEqual([`${KIND.staleAllowance} | ${NEVER_RUN} | null`]);
  });
});

describe('stale baseline entry', () => {
  it('a baseline file deleted from disk must be removed through the update command', () => {
    const scenario = world();
    scenario.sourceFiles = scenario.sourceFiles.filter((file) => file !== sourceName(9));
    delete scenario.measured[sourceName(9)];
    expect(summaryOfFindings(evaluate(scenario))).toEqual([`${KIND.staleBaselineEntry} | ${sourceName(9)} | null`]);
  });
});

describe('the baseline floor', () => {
  it('a truncated baseline fails instead of passing trivially', () => {
    const scenario = world({ extraFiles: 0 });
    const dropped = Object.keys(scenario.baseline.files).slice(0, 3);
    for (const file of dropped) {
      delete scenario.baseline.files[file];
      delete scenario.measured[file];
      scenario.sourceFiles = scenario.sourceFiles.filter((candidate) => candidate !== file);
    }
    const kinds = new Set(evaluate(scenario).map((item) => item.kind));
    expect(kinds).toEqual(new Set([KIND.baselineBelowFloor, KIND.measurementBelowFloor]));
  });

  it('an empty baseline fails the floor and names every measured file as unrecorded', () => {
    const scenario = world();
    const findings = evaluate({ ...scenario, baseline: emptyBaseline() });
    const unrecorded = findings.filter((item) => item.kind === KIND.unrecordedFile).map((item) => item.file);
    expect(unrecorded.sort()).toEqual(Object.keys(scenario.measured).sort());
    expect(findings.some((item) => item.kind === KIND.baselineBelowFloor)).toBe(true);
  });

  it('exactly at the floor passes', () => {
    const scenario = world({ extraFiles: 0 });
    expect(Object.keys(scenario.baseline.files).length).toBe(MIN_BASELINE_FILES + 1);
    const [dropped] = Object.keys(scenario.baseline.files).filter((file) => file !== NEVER_RUN);
    delete scenario.baseline.files[dropped];
    delete scenario.measured[dropped];
    scenario.sourceFiles = scenario.sourceFiles.filter((file) => file !== dropped);
    expect(Object.keys(scenario.baseline.files).length).toBe(MIN_BASELINE_FILES);
    expect(evaluate(scenario)).toEqual([]);
  });

  it('a measurement of almost nothing fails on its own', () => {
    expect(measurementFindings({}).map((item) => item.kind)).toEqual([KIND.measurementBelowFloor]);
  });
});

describe('unmeasured list integrity', () => {
  it('a source file in neither the baseline nor the unmeasured list is named', () => {
    const scenario = world();
    scenario.sourceFiles.push('src/new-types.ts');
    expect(summaryOfFindings(evaluate(scenario))).toEqual([`${KIND.sourceNotAccounted} | src/new-types.ts | null`]);
  });

  it('an unmeasured file that the measurement now reports must be moved', () => {
    const scenario = world();
    scenario.measured['src/types-only.ts'] = observed(recorded(50));
    expect(summaryOfFindings(evaluate(scenario))).toEqual([`${KIND.unmeasuredNowMeasured} | src/types-only.ts | null`]);
  });

  it('an unmeasured entry for a deleted file is stale', () => {
    const scenario = world();
    scenario.baseline.unmeasured.push('src/deleted-types.ts');
    expect(summaryOfFindings(evaluate(scenario))).toEqual([`${KIND.staleUnmeasuredEntry} | src/deleted-types.ts | null`]);
  });

  it('a file listed both as recorded and as unmeasured is named', () => {
    const scenario = world();
    scenario.baseline.unmeasured.push(sourceName(2));
    expect(summaryOfFindings(evaluate(scenario))).toEqual([
      `${KIND.listedTwice} | ${sourceName(2)} | null`,
      `${KIND.runtimeInUnmeasured} | ${sourceName(2)} | null`,
      `${KIND.unmeasuredNowMeasured} | ${sourceName(2)} | null`,
    ]);
  });
});

describe('unmeasured means no runtime code', () => {
  it('a file with runtime code in the unmeasured list fails, by name', () => {
    const scenario = world();
    scenario.baseline.unmeasured.push(NEVER_LOADED);
    scenario.sourceFiles.push(NEVER_LOADED);
    scenario.runtimeFiles.push(NEVER_LOADED);
    expect(summaryOfFindings(evaluate(scenario))).toEqual([`${KIND.runtimeInUnmeasured} | ${NEVER_LOADED} | null`]);
  });

  it('a type-only file in the unmeasured list passes', () => {
    const scenario = world();
    expect(scenario.baseline.unmeasured).toEqual([TYPES_ONLY]);
    expect(evaluate(scenario)).toEqual([]);
  });

  it('a file in both the unmeasured list and the allowances is named', () => {
    const scenario = world();
    scenario.baseline.zeroCoverageAllowed[TYPES_ONLY] = 'never loaded by a domain test';
    const kinds = summaryOfFindings(evaluate(scenario));
    expect(kinds).toContain(`${KIND.listedTwice} | ${TYPES_ONLY} | null`);
  });
});

describe('never-loaded files', () => {
  function withNeverLoadedFile(scenario) {
    scenario.sourceFiles.push(NEVER_LOADED);
    scenario.runtimeFiles.push(NEVER_LOADED);
    return scenario;
  }

  it('a file with runtime code that the report has no entry for fails without an allowance', () => {
    expect(summaryOfFindings(evaluate(withNeverLoadedFile(world())))).toEqual([`${KIND.sourceNotAccounted} | ${NEVER_LOADED} | null`]);
  });

  it('passes with a reasoned allowance and no baseline row', () => {
    const scenario = withNeverLoadedFile(world());
    scenario.baseline.zeroCoverageAllowed[NEVER_LOADED] = 'never loaded by a domain test; the coverage report has no entry for it';
    expect(evaluate(scenario)).toEqual([]);
  });

  it('an allowance with a blank reason still fails', () => {
    const scenario = withNeverLoadedFile(world());
    scenario.baseline.zeroCoverageAllowed[NEVER_LOADED] = ' ';
    expect(summaryOfFindings(evaluate(scenario))).toEqual([`${KIND.invalidAllowance} | ${NEVER_LOADED} | null`]);
  });

  it('an allowance for a runtime-free file with no row belongs in the unmeasured list instead', () => {
    const scenario = world();
    scenario.sourceFiles.push('src/more-types.ts');
    scenario.baseline.zeroCoverageAllowed['src/more-types.ts'] = 'never loaded';
    expect(summaryOfFindings(evaluate(scenario))).toEqual([`${KIND.allowanceForRuntimeFreeFile} | src/more-types.ts | null`]);
  });

  it('is stale once the measurement reports the file above zero', () => {
    const scenario = withNeverLoadedFile(world());
    scenario.baseline.zeroCoverageAllowed[NEVER_LOADED] = 'never loaded by a domain test';
    scenario.measured[NEVER_LOADED] = observed(recorded(30, 20, 20, 20));
    expect(summaryOfFindings(evaluate(scenario))).toEqual([
      `${KIND.staleAllowance} | ${NEVER_LOADED} | null`,
      `${KIND.unrecordedFile} | ${NEVER_LOADED} | null`,
    ]);
  });

  it('is stale once the file is deleted', () => {
    const scenario = world();
    scenario.baseline.zeroCoverageAllowed[NEVER_LOADED] = 'never loaded by a domain test';
    expect(summaryOfFindings(evaluate(scenario))).toEqual([`${KIND.staleAllowance} | ${NEVER_LOADED} | null`]);
  });

  it('update keeps the allowance while the file stays unreported, and bootstrap records it with the factual reason', () => {
    const scenario = withNeverLoadedFile(world());
    scenario.baseline.zeroCoverageAllowed[NEVER_LOADED] = 'kept as written';
    expect(planUpdate(scenario).next.zeroCoverageAllowed[NEVER_LOADED]).toBe('kept as written');

    const fresh = withNeverLoadedFile(world());
    const plan = planUpdate({ ...fresh, baseline: emptyBaseline(), bootstrap: true });
    expect(plan.next.zeroCoverageAllowed[NEVER_LOADED]).toBe(NEVER_LOADED_REASON);
    expect(plan.next.unmeasured).toEqual([TYPES_ONLY]);
    expect(plan.refusals).toEqual([]);
  });

  it('update leaves a new never-loaded file pending review rather than allowing it', () => {
    const plan = planUpdate(withNeverLoadedFile(world()));
    expect(summaryOfFindings(plan.pendingReview)).toEqual([`${KIND.sourceNotAccounted} | ${NEVER_LOADED} | null`]);
  });

  it('update drops the allowance once the file is reported above zero', () => {
    const scenario = withNeverLoadedFile(world());
    scenario.baseline.zeroCoverageAllowed[NEVER_LOADED] = 'never loaded by a domain test';
    scenario.measured[NEVER_LOADED] = observed(recorded(30, 20, 20, 20));
    const plan = planUpdate(scenario);
    expect(plan.refusals).toEqual([]);
    expect(plan.next.zeroCoverageAllowed[NEVER_LOADED]).toBeUndefined();
    expect(plan.next.files[NEVER_LOADED]).toEqual(recorded(30, 20, 20, 20));
  });
});

describe('baseline shape', () => {
  it('rejects a non-object, a missing section and an out-of-range number', () => {
    const scenario = world();
    expect(baselineIntegrityFindings({ baseline: null, sourceFiles: scenario.sourceFiles, runtimeFiles: scenario.runtimeFiles }).map((item) => item.kind)).toEqual([
      KIND.invalidBaseline,
    ]);

    const missing = clone(scenario.baseline);
    delete missing.waivers;
    expect(baselineIntegrityFindings({ baseline: missing, sourceFiles: scenario.sourceFiles, runtimeFiles: scenario.runtimeFiles }).map((item) => item.message)).toEqual([
      'baseline.waivers is missing or has the wrong type',
    ]);

    const outOfRange = clone(scenario.baseline);
    outOfRange.files[sourceName(0)].lines = 100.5;
    outOfRange.files[sourceName(1)].branches = -1;
    expect(summaryOfFindings(baselineIntegrityFindings({ baseline: outOfRange, sourceFiles: scenario.sourceFiles, runtimeFiles: scenario.runtimeFiles }))).toEqual([
      `${KIND.invalidBaseline} | ${sourceName(0)} | lines`,
      `${KIND.invalidBaseline} | ${sourceName(1)} | branches`,
    ]);
  });

  it('a waiver needs a reason, four numbers, and a file that still exists', () => {
    const scenario = world();
    const waivers = {
      [sourceName(0)]: { reason: '', ...recorded(10) },
      [sourceName(1)]: { reason: 'ok', statements: 10, branches: 10, functions: 10, lines: 'x' },
      'src/gone.ts': { reason: 'deleted later', ...recorded(10) },
    };
    expect(
      summaryOfFindings(baselineIntegrityFindings({ baseline: { ...scenario.baseline, waivers }, sourceFiles: scenario.sourceFiles, runtimeFiles: scenario.runtimeFiles })),
    ).toEqual([
      `${KIND.invalidWaiver} | ${sourceName(0)} | null`,
      `${KIND.invalidWaiver} | ${sourceName(1)} | lines`,
      `${KIND.staleWaiver} | src/gone.ts | null`,
    ]);
  });
});

describe('canonicalBaselineText', () => {
  it('writes one line per file with the metrics in a fixed order', () => {
    const text = canonicalBaselineText({
      files: { 'src/b.ts': { lines: 1, functions: 2, branches: 3, statements: 4 }, 'src/a.ts': recorded(91.2, 80, 100, 90.5) },
      unmeasured: ['src/z.ts', 'src/y.ts'],
      zeroCoverageAllowed: {},
      waivers: {},
    });
    expect(text).toBe(
      [
        '{',
        '  "files": {',
        '    "src/a.ts": { "statements": 91.2, "branches": 80, "functions": 100, "lines": 90.5 },',
        '    "src/b.ts": { "statements": 4, "branches": 3, "functions": 2, "lines": 1 }',
        '  },',
        '  "unmeasured": [',
        '    "src/y.ts",',
        '    "src/z.ts"',
        '  ],',
        '  "zeroCoverageAllowed": {},',
        '  "waivers": {}',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('gives one line to each file, allowance and waiver, so a diff names what moved', () => {
    const { baseline } = world();
    baseline.waivers[sourceName(5)] = { reason: 'declined on purpose', ...recorded(10, 11, 12, 13) };
    const lines = canonicalBaselineText(baseline).split('\n');
    const withKey = (file) => lines.filter((line) => line.includes(`"${file}"`));
    for (const file of [...Object.keys(baseline.files), ...Object.keys(baseline.zeroCoverageAllowed)]) {
      expect(withKey(file).length, file).toBeGreaterThanOrEqual(1);
    }
    expect(withKey(sourceName(5))).toHaveLength(2);
    expect(withKey(sourceName(5)).every((line) => line.trimEnd().endsWith('}') || line.trimEnd().endsWith('},'))).toBe(true);
  });

  it('is valid JSON that round-trips to the same text, whatever the key order it was given', () => {
    const { baseline } = world();
    baseline.waivers[sourceName(5)] = { reason: 'declined on purpose', ...recorded(10, 11, 12, 13) };
    const text = canonicalBaselineText(baseline);
    expect(canonicalBaselineText(JSON.parse(text))).toBe(text);

    const shuffled = {
      waivers: baseline.waivers,
      zeroCoverageAllowed: baseline.zeroCoverageAllowed,
      unmeasured: [...baseline.unmeasured].reverse(),
      files: Object.fromEntries(Object.entries(baseline.files).reverse()),
    };
    expect(canonicalBaselineText(shuffled)).toBe(text);
    expect(text.endsWith('}\n')).toBe(true);
  });
});

describe('planUpdate', () => {
  it('refuses a regression, names file and metric, and leaves the baseline alone', () => {
    const scenario = world();
    scenario.measured[sourceName(2)] = observed({ ...scenario.baseline.files[sourceName(2)], lines: 10 });
    const plan = planUpdate(scenario);
    expect(summaryOfFindings(plan.refusals)).toEqual([`${KIND.regression} | ${sourceName(2)} | lines`]);
    expect(plan.refusals[0]).toMatchObject({ baseline: 70, measured: 10, deltaPp: -60 });
  });

  it('refuses a file that vanished from the measurement while still on disk', () => {
    const scenario = world();
    delete scenario.measured[sourceName(2)];
    expect(summaryOfFindings(planUpdate(scenario).refusals)).toEqual([`${KIND.regression} | ${sourceName(2)} | all`]);
  });

  it('refuses a measurement that is below the floor even if nothing else is wrong', () => {
    const scenario = world();
    const plan = planUpdate({ ...scenario, measured: { [sourceName(0)]: scenario.measured[sourceName(0)] } });
    expect(plan.refusals.some((item) => item.kind === KIND.measurementBelowFloor)).toBe(true);
  });

  it('says nothing changed when the measurement equals the baseline', () => {
    const scenario = world();
    const plan = planUpdate(scenario);
    expect(plan.refusals).toEqual([]);
    expect(plan.changed).toBe(false);
  });

  it('records improvements, new files and removed files, and prunes the unmeasured list', () => {
    const scenario = world();
    scenario.measured[sourceName(1)] = observed(recorded(99, 99, 99, 99));
    scenario.measured['src/added.ts'] = observed(recorded(75, 60, 50, 40));
    scenario.sourceFiles.push('src/added.ts');
    scenario.sourceFiles = scenario.sourceFiles.filter((file) => file !== sourceName(8) && file !== 'src/types-only.ts');
    delete scenario.measured[sourceName(8)];

    const plan = planUpdate(scenario);
    expect(plan.refusals).toEqual([]);
    expect(plan.changed).toBe(true);
    expect(plan.next.files[sourceName(1)]).toEqual(recorded(99, 99, 99, 99));
    expect(plan.next.files['src/added.ts']).toEqual(recorded(75, 60, 50, 40));
    expect(sourceName(8) in plan.next.files).toBe(false);
    expect(plan.next.unmeasured).toEqual([]);
  });

  it('never adds a file to the unmeasured list by itself: that is a reviewed hand edit', () => {
    const scenario = world();
    scenario.sourceFiles.push('src/loaded-by-nothing.ts');
    scenario.runtimeFiles.push('src/loaded-by-nothing.ts');
    const plan = planUpdate(scenario);
    expect(plan.refusals).toEqual([]);
    expect(plan.next.unmeasured).toEqual(['src/types-only.ts']);
    expect(summaryOfFindings(plan.pendingReview)).toEqual([`${KIND.sourceNotAccounted} | src/loaded-by-nothing.ts | null`]);
  });

  it('drops an unmeasured entry once the measurement reports the file', () => {
    const scenario = world();
    scenario.measured['src/types-only.ts'] = observed(recorded(70));
    const plan = planUpdate(scenario);
    expect(plan.refusals).toEqual([]);
    expect(plan.next.unmeasured).toEqual([]);
    expect(plan.next.files['src/types-only.ts']).toEqual(recorded(70));
  });

  it('never records a number lower than the existing one for a file it did not waive', () => {
    const scenario = world();
    const plan = planUpdate(scenario);
    for (const [file, metrics] of Object.entries(plan.next.files)) {
      for (const metric of METRICS) {
        expect(metrics[metric], `${file} ${metric}`).toBeGreaterThanOrEqual(scenario.baseline.files[file][metric]);
      }
    }
  });

  it('drops an allowance once the file has coverage', () => {
    const scenario = world();
    scenario.measured[NEVER_RUN] = observed(recorded(40, 40, 40, 40));
    const plan = planUpdate(scenario);
    expect(plan.refusals).toEqual([]);
    expect(plan.next.zeroCoverageAllowed).toEqual({});
  });

  it('a new zero-coverage file is recorded but left pending review rather than silently allowed', () => {
    const scenario = world();
    scenario.measured['src/fresh.ts'] = observed(recorded(0, 0, 0, 0), 9);
    scenario.sourceFiles.push('src/fresh.ts');
    const plan = planUpdate(scenario);
    expect(plan.refusals).toEqual([]);
    expect(plan.next.files['src/fresh.ts']).toEqual(recorded(0, 0, 0, 0));
    expect(plan.next.zeroCoverageAllowed['src/fresh.ts']).toBeUndefined();
    expect(plan.pendingReview.map((item) => item.file)).toEqual(['src/fresh.ts']);
  });

  it('bootstrapping from nothing allows the current zero-coverage files with the factual initial reason', () => {
    const scenario = world();
    const plan = planUpdate({ ...scenario, baseline: emptyBaseline(), bootstrap: true });
    expect(plan.refusals).toEqual([]);
    expect(plan.next.zeroCoverageAllowed).toEqual({ [NEVER_RUN]: INITIAL_ZERO_COVERAGE_REASON });
    expect(plan.next.unmeasured).toEqual(['src/types-only.ts']);
    expect(plan.pendingReview).toEqual([]);
  });

  describe('--waive', () => {
    function regressed() {
      const scenario = world();
      scenario.measured[sourceName(2)] = observed({ ...scenario.baseline.files[sourceName(2)], statements: 60, lines: 65 });
      return scenario;
    }

    it('lowers that file to the measured numbers and records the waiver with them', () => {
      const plan = planUpdate({ ...regressed(), waivers: [{ file: sourceName(2), reason: 'dead branch removed with its tests' }] });
      expect(plan.refusals).toEqual([]);
      expect(plan.next.files[sourceName(2)]).toMatchObject({ statements: 60, lines: 65 });
      expect(plan.next.waivers[sourceName(2)]).toEqual({
        reason: 'dead branch removed with its tests',
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 65,
      });
    });

    it('does not excuse a different file that also regressed', () => {
      const scenario = regressed();
      scenario.measured[sourceName(3)] = observed({ ...scenario.baseline.files[sourceName(3)], branches: 1 });
      const plan = planUpdate({ ...scenario, waivers: [{ file: sourceName(2), reason: 'dead branch removed' }] });
      expect(summaryOfFindings(plan.refusals)).toEqual([`${KIND.regression} | ${sourceName(3)} | branches`]);
    });

    it('needs a non-empty reason', () => {
      for (const reason of ['', '  ', null]) {
        const plan = planUpdate({ ...regressed(), waivers: [{ file: sourceName(2), reason }] });
        expect(summaryOfFindings(plan.refusals)).toContain(`${KIND.invalidWaiver} | ${sourceName(2)} | null`);
      }
    });

    it('is refused for a file that has not regressed', () => {
      const plan = planUpdate({ ...world(), waivers: [{ file: sourceName(2), reason: 'just because' }] });
      expect(summaryOfFindings(plan.refusals)).toEqual([`${KIND.invalidWaiver} | ${sourceName(2)} | null`]);
    });

    it('cannot excuse a file that produced no coverage at all', () => {
      const scenario = world();
      delete scenario.measured[sourceName(2)];
      const plan = planUpdate({ ...scenario, waivers: [{ file: sourceName(2), reason: 'gone quiet' }] });
      expect(summaryOfFindings(plan.refusals)).toEqual([
        `${KIND.invalidWaiver} | ${sourceName(2)} | null`,
        `${KIND.regression} | ${sourceName(2)} | all`,
      ]);
    });
  });
});

describe('guardBaseFindings', () => {
  function pair() {
    const { baseline } = world();
    const { sourceFiles, runtimeFiles } = world();
    return { base: clone(baseline), head: clone(baseline), sourceFiles, runtimeFiles };
  }

  it('passes when head equals base', () => {
    expect(guardBaseFindings(pair())).toEqual([]);
  });

  it('passes when head only improves or adds files', () => {
    const scenario = pair();
    scenario.head.files[sourceName(1)].lines = 100;
    scenario.head.files['src/added.ts'] = recorded(10);
    expect(guardBaseFindings(scenario)).toEqual([]);
  });

  it('a hand-edit that lowers one number is named with file, metric, from and to', () => {
    const scenario = pair();
    scenario.head.files[sourceName(1)].branches = 12.5;
    const [only, ...rest] = guardBaseFindings(scenario);
    expect(rest).toEqual([]);
    expect(only).toMatchObject({
      kind: KIND.loweredWithoutWaiver,
      file: sourceName(1),
      metric: 'branches',
      baseline: 50,
      measured: 12.5,
      deltaPp: -37.5,
    });
  });

  it('a waiver that head adds and base does not have allows exactly that file to be lowered', () => {
    const scenario = pair();
    scenario.head.files[sourceName(1)].branches = 12.5;
    scenario.head.files[sourceName(2)].branches = 1;
    scenario.head.waivers[sourceName(1)] = { reason: 'declined on purpose', ...scenario.head.files[sourceName(1)] };
    expect(summaryOfFindings(guardBaseFindings(scenario))).toEqual([`${KIND.loweredWithoutWaiver} | ${sourceName(2)} | branches`]);
  });

  it('a waiver that base already had cannot be reused to lower the file again', () => {
    const scenario = pair();
    const waiver = { reason: 'declined once, earlier', ...recorded(80, 40, 60, 70) };
    scenario.base.waivers[sourceName(1)] = waiver;
    scenario.head.waivers[sourceName(1)] = waiver;
    scenario.head.files[sourceName(1)].branches = 5;
    expect(summaryOfFindings(guardBaseFindings(scenario))).toEqual([`${KIND.loweredWithoutWaiver} | ${sourceName(1)} | branches`]);
  });

  it('a file dropped from head while it still exists on disk is named', () => {
    const scenario = pair();
    delete scenario.head.files[sourceName(4)];
    expect(summaryOfFindings(guardBaseFindings(scenario))).toEqual([`${KIND.removedWhileOnDisk} | ${sourceName(4)} | null`]);
  });

  it('a file dropped from head because it was deleted from disk is allowed', () => {
    const scenario = pair();
    delete scenario.head.files[sourceName(4)];
    scenario.sourceFiles = scenario.sourceFiles.filter((file) => file !== sourceName(4));
    expect(guardBaseFindings(scenario)).toEqual([]);
  });

  it('a base with no baseline file passes: this change introduces it', () => {
    const scenario = pair();
    expect(guardBaseFindings({ ...scenario, base: null })).toEqual([]);
  });
});

describe('report formatting', () => {
  it('lists the ten least covered files, lowest first, and every finding by name', () => {
    const { measured } = world();
    const lowest = leastCovered(measured);
    expect(lowest).toHaveLength(10);
    expect(lowest[0].file).toBe(NEVER_RUN);
    expect(lowest.map((row) => row.statements)).toEqual([...lowest.map((row) => row.statements)].sort((a, b) => a - b));

    const scenario = world();
    scenario.measured[sourceName(3)] = observed({ ...scenario.baseline.files[sourceName(3)], lines: 1 });
    const findings = evaluate(scenario);
    const text = formatReport({ overall: overallOf({ total: Object.fromEntries(METRICS.map((metric) => [metric, { covered: 1, total: 2 }])) }), measured, findings });
    expect(text).toContain('statements 50%');
    expect(text).toContain(`[regression] ${sourceName(3)}: lines fell from 70% to 1%`);
  });
});
