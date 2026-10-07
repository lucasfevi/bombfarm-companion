import { SOLVER_TEST_FILES } from '../vitest.solver-files.mjs';

export const METRICS = ['statements', 'branches', 'functions', 'lines'];

export const TOLERANCE_PP = 0;

export const MIN_BASELINE_FILES = 108;

export const KIND = {
  regression: 'regression',
  unrecordedFile: 'unrecorded-file',
  unallowedZeroCoverage: 'unallowed-zero-coverage',
  staleAllowance: 'stale-allowance',
  invalidAllowance: 'invalid-allowance',
  staleBaselineEntry: 'stale-baseline-entry',
  baselineBelowFloor: 'baseline-below-floor',
  measurementBelowFloor: 'measurement-below-floor',
  sourceNotAccounted: 'source-not-accounted',
  staleUnmeasuredEntry: 'stale-unmeasured-entry',
  listedTwice: 'listed-twice',
  invalidBaseline: 'invalid-baseline',
  staleWaiver: 'stale-waiver',
  invalidWaiver: 'invalid-waiver',
  loweredWithoutWaiver: 'lowered-without-waiver',
  removedWhileOnDisk: 'removed-while-on-disk',
  renamedWithLowerNumbers: 'renamed-with-lower-numbers',
  runtimeInUnmeasured: 'runtime-in-unmeasured',
  allowanceForRuntimeFreeFile: 'allowance-for-runtime-free-file',
};

export const INITIAL_ZERO_COVERAGE_REASON = 'recorded at baseline; no test exercises it yet';

export const NEVER_LOADED_REASON = 'never loaded by a domain test; the coverage report has no entry for it';

function requireRuntimeFiles(runtimeFiles) {
  if (!Array.isArray(runtimeFiles)) {
    throw new Error('runtimeFiles is required: the source files with runtime code, from tools/domain-coverage-runtime.mjs');
  }
  return new Set(runtimeFiles);
}

export function emptyBaseline() {
  return { files: {}, unmeasured: [], zeroCoverageAllowed: {}, waivers: {} };
}

export function percent(covered, total) {
  if (total === 0) return 100;
  return Math.round((covered * 10000) / total) / 100;
}

function hundredths(value) {
  return Math.round(value * 100);
}

function deltaPp(from, to) {
  return (hundredths(to) - hundredths(from)) / 100;
}

function sortedUnique(items) {
  return [...new Set(items)].sort(compareCodeUnits);
}

function compareCodeUnits(a, b) {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

function finding(kind, file, message, extra = {}) {
  return { kind, file, metric: null, baseline: null, measured: null, deltaPp: null, message, ...extra };
}

function metricsOf(entry) {
  return Object.fromEntries(METRICS.map((metric) => [metric, entry[metric]]));
}

function formatPp(value) {
  return `${value > 0 ? '+' : ''}${value}`;
}

export function normalizeSummary(summary, packageDirectory) {
  const packagePrefix = `${toForwardSlashes(packageDirectory).replace(/\/+$/, '')}/`.toLowerCase();
  const files = {};
  const outsideSource = [];
  for (const [key, entry] of Object.entries(summary)) {
    if (key === 'total') continue;
    const forward = toForwardSlashes(key);
    const relative = forward.toLowerCase().startsWith(packagePrefix)
      ? forward.slice(packagePrefix.length)
      : forward;
    if (!relative.startsWith('src/')) {
      outsideSource.push(key);
      continue;
    }
    files[relative] = {
      ...Object.fromEntries(METRICS.map((metric) => [metric, percent(entry[metric].covered, entry[metric].total)])),
      statementsCovered: entry.statements.covered,
      statementsTotal: entry.statements.total,
    };
  }
  if (outsideSource.length > 0) {
    throw new Error(
      `the coverage summary names files outside ${packageDirectory}/src: ${outsideSource.sort(compareCodeUnits).join(', ')}`,
    );
  }
  return files;
}

function toForwardSlashes(value) {
  return value.replaceAll('\\', '/');
}

export function overallOf(summary) {
  const total = summary.total;
  return Object.fromEntries(METRICS.map((metric) => [metric, percent(total[metric].covered, total[metric].total)]));
}

export function canonicalBaselineText(baseline) {
  const lines = ['{'];
  const sections = [
    ['files', sortedEntries(baseline.files).map(([file, entry]) => `    ${JSON.stringify(file)}: ${metricsLine(entry)}`), '{', '}'],
    ['unmeasured', sortedUnique(baseline.unmeasured).map((file) => `    ${JSON.stringify(file)}`), '[', ']'],
    [
      'zeroCoverageAllowed',
      sortedEntries(baseline.zeroCoverageAllowed).map(([file, reason]) => `    ${JSON.stringify(file)}: ${JSON.stringify(reason)}`),
      '{',
      '}',
    ],
    [
      'waivers',
      sortedEntries(baseline.waivers).map(([file, waiver]) => `    ${JSON.stringify(file)}: ${waiverLine(waiver)}`),
      '{',
      '}',
    ],
  ];
  sections.forEach(([name, entries, open, close], index) => {
    const separator = index === sections.length - 1 ? '' : ',';
    if (entries.length === 0) {
      lines.push(`  ${JSON.stringify(name)}: ${open}${close}${separator}`);
      return;
    }
    lines.push(`  ${JSON.stringify(name)}: ${open}`);
    entries.forEach((entry, entryIndex) => lines.push(entryIndex === entries.length - 1 ? entry : `${entry},`));
    lines.push(`  ${close}${separator}`);
  });
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

function sortedEntries(record) {
  return Object.entries(record).sort(([a], [b]) => compareCodeUnits(a, b));
}

function metricsLine(entry) {
  const parts = METRICS.map((metric) => `${JSON.stringify(metric)}: ${JSON.stringify(entry[metric])}`);
  return `{ ${parts.join(', ')} }`;
}

function waiverLine(waiver) {
  const parts = [
    `"reason": ${JSON.stringify(waiver.reason)}`,
    ...METRICS.map((metric) => `${JSON.stringify(metric)}: ${JSON.stringify(waiver[metric])}`),
  ];
  return `{ ${parts.join(', ')} }`;
}

function isPlainRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPercentage(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

function nonEmptyText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function shapeFindings(baseline) {
  if (!isPlainRecord(baseline)) {
    return [finding(KIND.invalidBaseline, null, 'the baseline is not a JSON object')];
  }
  const findings = [];
  const section = (name, ok) => {
    if (!ok(baseline[name])) {
      findings.push(finding(KIND.invalidBaseline, null, `baseline.${name} is missing or has the wrong type`));
      return false;
    }
    return true;
  };
  const filesOk = section('files', isPlainRecord);
  const unmeasuredOk = section('unmeasured', (value) => Array.isArray(value) && value.every((item) => typeof item === 'string'));
  const allowedOk = section('zeroCoverageAllowed', isPlainRecord);
  const waiversOk = section('waivers', isPlainRecord);

  if (filesOk) {
    for (const [file, entry] of Object.entries(baseline.files)) {
      for (const metric of METRICS) {
        if (!isPlainRecord(entry) || !isPercentage(entry[metric])) {
          findings.push(
            finding(KIND.invalidBaseline, file, `${file}: ${metric} is not a number between 0 and 100`, { metric }),
          );
        }
      }
    }
  }
  if (unmeasuredOk) {
    const duplicates = baseline.unmeasured.filter((file, index) => baseline.unmeasured.indexOf(file) !== index);
    for (const file of sortedUnique(duplicates)) {
      findings.push(finding(KIND.invalidBaseline, file, `${file} is listed more than once in unmeasured`));
    }
  }
  if (allowedOk) {
    for (const [file, reason] of Object.entries(baseline.zeroCoverageAllowed)) {
      if (!nonEmptyText(reason)) {
        findings.push(finding(KIND.invalidAllowance, file, `${file}: the zero-coverage allowance has no reason`));
      }
    }
  }
  if (waiversOk) {
    for (const [file, waiver] of Object.entries(baseline.waivers)) {
      if (!isPlainRecord(waiver) || !nonEmptyText(waiver.reason)) {
        findings.push(finding(KIND.invalidWaiver, file, `${file}: the waiver has no reason`));
        continue;
      }
      for (const metric of METRICS) {
        if (!isPercentage(waiver[metric])) {
          findings.push(
            finding(KIND.invalidWaiver, file, `${file}: the waiver's ${metric} is not a number between 0 and 100`, { metric }),
          );
        }
      }
    }
  }
  return findings;
}

export function baselineIntegrityFindings({ baseline, sourceFiles, runtimeFiles }) {
  const runtime = requireRuntimeFiles(runtimeFiles);
  const shape = shapeFindings(baseline);
  if (shape.some((item) => item.kind === KIND.invalidBaseline && item.file === null)) return shape;

  const onDisk = new Set(sourceFiles);
  const recorded = Object.keys(baseline.files);
  const unmeasured = new Set(baseline.unmeasured);
  const allowed = baseline.zeroCoverageAllowed;
  const findings = [...shape];

  if (recorded.length < MIN_BASELINE_FILES) {
    findings.push(
      finding(
        KIND.baselineBelowFloor,
        null,
        `the baseline records ${recorded.length} files, below the floor of ${MIN_BASELINE_FILES} — a truncated baseline must fail, not pass`,
      ),
    );
  }
  for (const file of sortedUnique(recorded.filter((candidate) => !onDisk.has(candidate)))) {
    findings.push(
      finding(KIND.staleBaselineEntry, file, `${file} is in the baseline but no longer exists on disk — run the update command to remove it`),
    );
  }
  for (const file of sortedUnique(baseline.unmeasured.filter((candidate) => !onDisk.has(candidate)))) {
    findings.push(
      finding(KIND.staleUnmeasuredEntry, file, `${file} is in the unmeasured list but no longer exists on disk — run the update command to remove it`),
    );
  }
  for (const file of sortedUnique(recorded.filter((candidate) => unmeasured.has(candidate)))) {
    findings.push(finding(KIND.listedTwice, file, `${file} is both in the baseline and in the unmeasured list`));
  }
  for (const file of sortedUnique(baseline.unmeasured.filter((candidate) => candidate in allowed))) {
    findings.push(finding(KIND.listedTwice, file, `${file} is both in the unmeasured list and in zeroCoverageAllowed`));
  }
  for (const file of sortedUnique(baseline.unmeasured.filter((candidate) => onDisk.has(candidate) && runtime.has(candidate)))) {
    findings.push(
      finding(
        KIND.runtimeInUnmeasured,
        file,
        `${file} is in the unmeasured list but has runtime code; a file no test loads belongs in zeroCoverageAllowed with a reason`,
      ),
    );
  }
  const accounted = (candidate) => candidate in baseline.files || unmeasured.has(candidate) || candidate in allowed;
  for (const file of sortedUnique(sourceFiles.filter((candidate) => !accounted(candidate)))) {
    findings.push(
      finding(
        KIND.sourceNotAccounted,
        file,
        `${file} exists under src but is in none of the baseline, the unmeasured list and zeroCoverageAllowed — run the update command`,
      ),
    );
  }
  for (const file of sortedUnique(recorded.filter((candidate) => baseline.files[candidate].statements === 0 && !(candidate in allowed)))) {
    findings.push(
      finding(
        KIND.unallowedZeroCoverage,
        file,
        `${file} has 0% statement coverage and no zeroCoverageAllowed entry; a source file nothing exercises needs an explicit reviewed reason`,
        { baseline: 0 },
      ),
    );
  }
  for (const file of Object.keys(allowed).sort(compareCodeUnits)) {
    if (!onDisk.has(file)) {
      findings.push(finding(KIND.staleAllowance, file, `${file} has a zeroCoverageAllowed entry but no longer exists on disk — remove the entry`));
    } else if (file in baseline.files && baseline.files[file].statements !== 0) {
      findings.push(
        finding(
          KIND.staleAllowance,
          file,
          `${file} has a zeroCoverageAllowed entry but the baseline records ${baseline.files[file].statements}% statements — remove the entry`,
          { baseline: baseline.files[file].statements },
        ),
      );
    } else if (!(file in baseline.files) && !runtime.has(file)) {
      findings.push(
        finding(
          KIND.allowanceForRuntimeFreeFile,
          file,
          `${file} has a zeroCoverageAllowed entry but no coverage row and no runtime code; a runtime-free file belongs in the unmeasured list`,
        ),
      );
    }
  }
  for (const file of Object.keys(baseline.waivers).sort(compareCodeUnits)) {
    if (!onDisk.has(file)) {
      findings.push(finding(KIND.staleWaiver, file, `${file} has a waiver but no longer exists on disk — remove the waiver`));
    }
  }
  return findings;
}

export function measurementFindings(measured) {
  const count = Object.keys(measured).length;
  if (count >= MIN_BASELINE_FILES) return [];
  return [
    finding(
      KIND.measurementBelowFloor,
      null,
      `the measurement covers ${count} files, below the floor of ${MIN_BASELINE_FILES} — a run that measured almost nothing must fail, not compare against an empty set`,
    ),
  ];
}

function regressionsAgainst(baseline, measured, sourceFiles) {
  const onDisk = new Set(sourceFiles);
  const findings = [];
  for (const file of Object.keys(baseline.files).sort(compareCodeUnits)) {
    if (!onDisk.has(file)) continue;
    const now = measured[file];
    if (now === undefined) {
      findings.push(
        finding(
          KIND.regression,
          file,
          `${file} is in the baseline but produced no coverage in this measurement — it has regressed to nothing`,
          { metric: 'all', baseline: metricsOf(baseline.files[file]), measured: null },
        ),
      );
      continue;
    }
    for (const metric of METRICS) {
      const recorded = baseline.files[file][metric];
      if (hundredths(now[metric]) < hundredths(recorded) - hundredths(TOLERANCE_PP)) {
        const delta = deltaPp(recorded, now[metric]);
        findings.push(
          finding(
            KIND.regression,
            file,
            `${file}: ${metric} fell from ${recorded}% to ${now[metric]}% (${formatPp(delta)} pp)`,
            { metric, baseline: recorded, measured: now[metric], deltaPp: delta },
          ),
        );
      }
    }
  }
  return findings;
}

export function evaluateAgainstBaseline({ baseline, measured, sourceFiles, runtimeFiles }) {
  const integrity = baselineIntegrityFindings({ baseline, sourceFiles, runtimeFiles });
  if (integrity.some((item) => item.kind === KIND.invalidBaseline && item.file === null)) return integrity;

  const findings = [...integrity, ...measurementFindings(measured)];
  findings.push(...regressionsAgainst(baseline, measured, sourceFiles));

  const unmeasured = new Set(baseline.unmeasured);
  const allowed = baseline.zeroCoverageAllowed;

  for (const file of Object.keys(measured).sort(compareCodeUnits)) {
    const entry = measured[file];
    if (!(file in baseline.files) && !unmeasured.has(file) && !(file in allowed && entry.statementsCovered === 0)) {
      findings.push(
        finding(KIND.unrecordedFile, file, `${file} is measured but has no baseline row — run the update command`, {
          measured: metricsOf(entry),
        }),
      );
    }
    if (entry.statementsTotal > 0 && entry.statementsCovered === 0 && !(file in allowed) && !(file in baseline.files && baseline.files[file].statements === 0)) {
      findings.push(
        finding(
          KIND.unallowedZeroCoverage,
          file,
          `${file} has 0 of ${entry.statementsTotal} statements covered and no zeroCoverageAllowed entry; a source file nothing exercises needs an explicit reviewed reason`,
          { measured: 0 },
        ),
      );
    }
  }
  for (const file of Object.keys(allowed).sort(compareCodeUnits)) {
    const entry = measured[file];
    const recordedStatements = baseline.files[file]?.statements;
    if (entry !== undefined && entry.statementsCovered > 0 && (recordedStatements === undefined || recordedStatements === 0)) {
      findings.push(
        finding(
          KIND.staleAllowance,
          file,
          `${file} has a zeroCoverageAllowed entry but is now at ${entry.statements}% statements — remove the entry`,
          { measured: entry.statements },
        ),
      );
    }
  }
  return dedupe(findings);
}

function dedupe(findings) {
  const seen = new Set();
  return findings.filter((item) => {
    const key = JSON.stringify([item.kind, item.file, item.metric, item.message]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function planUpdate({ baseline, measured, sourceFiles, runtimeFiles, waivers = [], bootstrap = false }) {
  const runtime = requireRuntimeFiles(runtimeFiles);
  const refusals = [...measurementFindings(measured)];
  const onDisk = new Set(sourceFiles);
  const waiverByFile = new Map(waivers.map((waiver) => [waiver.file, waiver.reason]));

  for (const [file, reason] of waiverByFile) {
    if (!nonEmptyText(reason)) {
      refusals.push(finding(KIND.invalidWaiver, file, `${file}: a waiver needs a non-empty reason`));
    }
  }

  const regressions = regressionsAgainst(baseline, measured, sourceFiles);
  const regressedFiles = new Set(regressions.map((item) => item.file));
  const vanished = new Set(regressions.filter((item) => item.measured === null).map((item) => item.file));

  for (const file of waiverByFile.keys()) {
    if (!regressedFiles.has(file)) {
      refusals.push(finding(KIND.invalidWaiver, file, `${file}: nothing to waive — it has not regressed against the baseline`));
    } else if (vanished.has(file)) {
      refusals.push(finding(KIND.invalidWaiver, file, `${file}: cannot be waived — it produced no coverage at all`));
    }
  }
  refusals.push(...regressions.filter((item) => !waiverByFile.has(item.file) || vanished.has(item.file)));

  const files = {};
  for (const file of Object.keys(measured).sort(compareCodeUnits)) {
    const now = measured[file];
    const recorded = baseline.files[file];
    const platformDependent =
      recorded === undefined &&
      !bootstrap &&
      (baseline.unmeasured.includes(file) || (file in baseline.zeroCoverageAllowed && now.statementsCovered === 0));
    if (platformDependent) continue;
    if (recorded === undefined || waiverByFile.has(file)) {
      files[file] = metricsOf(now);
    } else {
      files[file] = Object.fromEntries(METRICS.map((metric) => [metric, Math.max(recorded[metric], now[metric])]));
    }
  }

  const neverLoaded = sourceFiles.filter((file) => !(file in measured) && runtime.has(file));
  const unmeasured = bootstrap
    ? sortedUnique(sourceFiles.filter((file) => !(file in measured) && !runtime.has(file)))
    : sortedUnique(baseline.unmeasured.filter((file) => onDisk.has(file)));

  const zeroCoverageAllowed = {};
  for (const [file, reason] of Object.entries(baseline.zeroCoverageAllowed)) {
    const now = measured[file];
    const stillZero =
      now === undefined ? runtime.has(file) : now.statementsCovered === 0 && (now.statementsTotal > 0 || runtime.has(file));
    if (onDisk.has(file) && stillZero) zeroCoverageAllowed[file] = reason;
  }
  if (bootstrap) {
    for (const [file, now] of Object.entries(measured)) {
      if (now.statementsTotal > 0 && now.statementsCovered === 0) zeroCoverageAllowed[file] = INITIAL_ZERO_COVERAGE_REASON;
    }
    for (const file of neverLoaded) zeroCoverageAllowed[file] = NEVER_LOADED_REASON;
  }

  const nextWaivers = {};
  for (const [file, waiver] of Object.entries(baseline.waivers)) {
    if (onDisk.has(file)) nextWaivers[file] = waiver;
  }
  for (const [file, reason] of waiverByFile) {
    if (file in measured && !vanished.has(file)) nextWaivers[file] = { reason, ...metricsOf(measured[file]) };
  }

  const next = { files, unmeasured, zeroCoverageAllowed, waivers: nextWaivers };
  const afterwards = baselineIntegrityFindings({ baseline: next, sourceFiles, runtimeFiles });
  const needsReview = (item) => item.kind === KIND.unallowedZeroCoverage || item.kind === KIND.sourceNotAccounted;
  const pendingReview = afterwards.filter(needsReview);
  refusals.push(...afterwards.filter((item) => !needsReview(item)));

  return {
    refusals: dedupe(refusals),
    pendingReview,
    next,
    changed: canonicalBaselineText(next) !== canonicalBaselineText(baseline),
  };
}

export function guardBaseFindings({ base, head, sourceFiles }) {
  if (base === null) return [];
  const onDisk = new Set(sourceFiles);
  const findings = [];
  for (const file of Object.keys(base.files).sort(compareCodeUnits)) {
    const before = base.files[file];
    const after = head.files[file];
    if (after === undefined) {
      if (onDisk.has(file)) {
        findings.push(
          finding(KIND.removedWhileOnDisk, file, `${file} is recorded in the base baseline and still exists on disk, but head's baseline dropped it`),
        );
      }
      continue;
    }
    const waivedAtHead = file in (head.waivers ?? {}) && !(file in (base.waivers ?? {}));
    if (waivedAtHead) continue;
    for (const metric of METRICS) {
      if (hundredths(after[metric]) < hundredths(before[metric])) {
        const delta = deltaPp(before[metric], after[metric]);
        findings.push(
          finding(
            KIND.loweredWithoutWaiver,
            file,
            `${file}: recorded ${metric} was lowered from ${before[metric]}% to ${after[metric]}% (${formatPp(delta)} pp) with no new waiver`,
            { metric, baseline: before[metric], measured: after[metric], deltaPp: delta },
          ),
        );
      }
    }
  }
  findings.push(...renameFindings({ base, head, onDisk }));
  return findings;
}

function basenameOf(file) {
  return file.slice(file.lastIndexOf('/') + 1);
}

export function renameReview({ base, head }) {
  const rows = (names, source) => names.sort(compareCodeUnits).map((file) => ({ file, ...metricsOf(source[file]) }));
  return {
    removed: rows(Object.keys(base.files).filter((file) => !(file in head.files)), base.files),
    added: rows(Object.keys(head.files).filter((file) => !(file in base.files)), head.files),
  };
}

function renameFindings({ base, head, onDisk }) {
  const { removed, added } = renameReview({ base, head });
  const findings = [];
  for (const gone of removed.filter((row) => !onDisk.has(row.file))) {
    for (const now of added.filter((row) => basenameOf(row.file) === basenameOf(gone.file))) {
      if (now.file in (head.waivers ?? {})) continue;
      for (const metric of METRICS) {
        if (hundredths(now[metric]) < hundredths(gone[metric])) {
          const delta = deltaPp(gone[metric], now[metric]);
          findings.push(
            finding(
              KIND.renamedWithLowerNumbers,
              now.file,
              `${now.file} looks like ${gone.file} moved: ${metric} is ${now[metric]}% where ${gone.file} recorded ${gone[metric]}% (${formatPp(delta)} pp) and there is no waiver for it`,
              { metric, baseline: gone[metric], measured: now[metric], deltaPp: delta },
            ),
          );
        }
      }
    }
  }
  return findings;
}

function metricsText(row) {
  return METRICS.map((metric) => `${metric} ${row[metric]}%`).join(', ');
}

export function formatRenameReview(review) {
  const lines = [];
  const section = (heading, rows) => {
    lines.push(`${heading}: ${rows.length === 0 ? 'none' : rows.length}`);
    for (const row of rows) lines.push(`  ${row.file}  ${metricsText(row)}`);
  };
  section('baseline files removed since the base', review.removed);
  section('baseline files added since the base', review.added);
  return `${lines.join('\n')}\n`;
}

export function formatRenameReviewMarkdown(review) {
  const lines = ['### Baseline files removed and added', ''];
  if (review.removed.length === 0 && review.added.length === 0) return `${lines.join('\n')}None.\n`;
  lines.push('| change | file | statements | branches | functions | lines |', '| --- | --- | ---: | ---: | ---: | ---: |');
  for (const [label, rows] of [
    ['removed', review.removed],
    ['added', review.added],
  ]) {
    for (const row of rows) lines.push(`| ${label} | \`${row.file}\` | ${METRICS.map((metric) => `${row[metric]}%`).join(' | ')} |`);
  }
  return `${lines.join('\n')}\n`;
}

const COVERAGE_IGNORE_HINT = /(?:\/\*|\/\/)\s*(?:v8|istanbul|c8)\s+ignore\b/i;

export function coverageIgnoreHints(file, text) {
  return text.split('\n').flatMap((line, index) => (COVERAGE_IGNORE_HINT.test(line) ? [`${file}:${index + 1}`] : []));
}

export function filesTheRatchetCannotSee(files) {
  return files.filter((file) => !file.endsWith('.ts') && !file.endsWith('.json')).sort(compareCodeUnits);
}

export function leastCovered(measured, count = 10) {
  return Object.entries(measured)
    .map(([file, entry]) => ({ file, ...metricsOf(entry) }))
    .sort((a, b) => a.statements - b.statements || compareCodeUnits(a.file, b.file))
    .slice(0, count);
}

function overallLine(overall) {
  return METRICS.map((metric) => `${metric} ${overall[metric]}%`).join(', ');
}

export function formatReport({ overall, measured, findings }) {
  const lines = [`domain coverage: ${overallLine(overall)} (${Object.keys(measured).length} files)`, '', 'least covered files (statements):'];
  for (const row of leastCovered(measured)) {
    lines.push(`  ${String(row.statements).padStart(6)}%  ${row.file}`);
  }
  lines.push('');
  if (findings.length === 0) {
    lines.push('ratchet: no findings');
  } else {
    lines.push(`ratchet: ${findings.length} finding(s)`);
    for (const item of findings) lines.push(`  [${item.kind}] ${item.message}`);
  }
  return `${lines.join('\n')}\n`;
}

export function formatMarkdownSummary({ title, overall, measured, findings }) {
  const lines = [`## ${title}`, ''];
  if (overall !== null) {
    lines.push('| statements | branches | functions | lines |', '| ---: | ---: | ---: | ---: |');
    lines.push(`| ${METRICS.map((metric) => `${overall[metric]}%`).join(' | ')} |`, '');
  }
  if (measured !== null) {
    lines.push('Least covered files (statements):', '');
    for (const row of leastCovered(measured)) lines.push(`- \`${row.file}\` ${row.statements}%`);
    lines.push('');
  }
  if (findings.length === 0) {
    lines.push('No findings.');
  } else {
    lines.push(`${findings.length} finding(s):`, '');
    for (const item of findings) lines.push(`- \`${item.kind}\` ${item.message}`);
  }
  return `${lines.join('\n')}\n`;
}

export const INSTRUMENTATION_SENSITIVE_TEST_FILES = Object.freeze([
  'packages/domain/tests/clear-time.test.ts',
  'packages/domain/tests/farm-optimize-perf.test.ts',
  'packages/domain/tests/forge-forecast.test.ts',
  'packages/domain/tests/points-reopt.test.ts',
  'packages/domain/tests/team-plan-solver.test.ts',
]);

export const TEST_RUN_KIND = {
  resultsMissing: 'test-results-missing',
  resultsUnparseable: 'test-results-unparseable',
  failedSuite: 'failed-suite',
  failedTest: 'failed-test-not-tolerated',
  unexplainedExit: 'exit-not-explained-by-results',
};

function relativeToRoot(name, root) {
  const forward = toForwardSlashes(name);
  const prefix = `${toForwardSlashes(root).replace(/\/+$/, '')}/`;
  return forward.toLowerCase().startsWith(prefix.toLowerCase()) ? forward.slice(prefix.length) : forward;
}

const STACK_MARKER = /STACK_TRACE_ERROR|^at\s/;

function reasonOf(failureMessages) {
  for (const message of failureMessages ?? []) {
    const line = String(message ?? '')
      .split('\n')
      .map((candidate) => candidate.trim())
      .find((candidate) => candidate !== '' && !STACK_MARKER.test(candidate));
    if (line !== undefined) return line;
  }
  return '';
}

const VITEST_TIMEOUT_MARKER = 'Error: STACK_TRACE_ERROR';
const MIN_TIMEOUT_DURATION_MS = 60_000;

function isBareTimeoutMarker(failureMessages) {
  return (
    Array.isArray(failureMessages) &&
    failureMessages.length > 0 &&
    failureMessages.every((message) => String(message).split('\n')[0].trim() === VITEST_TIMEOUT_MARKER)
  );
}

function isInstrumentationTimeout(test) {
  return isBareTimeoutMarker(test.failureMessages) && Number(test.duration) >= MIN_TIMEOUT_DURATION_MS;
}

function secondsOf(durationMs) {
  return Math.round(Number(durationMs) / 1000);
}

export const WAIVER = { wallClock: 'wall-clock assertion', timeout: 'instrumentation timeout' };

function solverTestPaths() {
  return SOLVER_TEST_FILES.map((file) => `packages/domain/${file}`);
}

export function judgeTestRun({
  resultsText,
  root,
  exitCode,
  allowlist = INSTRUMENTATION_SENSITIVE_TEST_FILES,
  solverFiles = solverTestPaths(),
}) {
  const refuse = (kind, message, extra = {}) => ({
    accepted: false,
    tolerated: [],
    offenders: [{ kind, file: null, name: null, message, ...extra }],
  });
  if (resultsText === null || resultsText === undefined) {
    return refuse(TEST_RUN_KIND.resultsMissing, 'the vitest JSON results were not written, so the failure cannot be classified');
  }
  let results;
  try {
    results = JSON.parse(resultsText);
  } catch (error) {
    return refuse(TEST_RUN_KIND.resultsUnparseable, `the vitest JSON results do not parse: ${error.message}`);
  }
  if (!isPlainRecord(results) || !Array.isArray(results.testResults)) {
    return refuse(TEST_RUN_KIND.resultsUnparseable, 'the vitest JSON results have no testResults list');
  }

  const allowed = new Set(allowlist);
  const solverSet = new Set(solverFiles);
  const tolerated = [];
  const offenders = [];
  for (const suite of results.testResults) {
    const file = relativeToRoot(String(suite.name ?? ''), root);
    const failedTests = (suite.assertionResults ?? []).filter((test) => test.status === 'failed');
    if (suite.status === 'failed' && failedTests.length === 0) {
      offenders.push({
        kind: TEST_RUN_KIND.failedSuite,
        file,
        name: null,
        message: `${file}: the suite failed before or outside its tests (${reasonOf([suite.message]) || 'no message'})`,
      });
    }
    for (const test of failedTests) {
      const name = test.fullName ?? test.title ?? '(unnamed test)';
      const bareMarker = isBareTimeoutMarker(test.failureMessages);
      const entry = {
        file,
        name,
        message: !bareMarker
          ? reasonOf(test.failureMessages)
          : Number(test.duration) >= MIN_TIMEOUT_DURATION_MS
            ? `timed out after ${secondsOf(test.duration)} s (explicit per-test timeout; instrumented body ran long)`
            : `only vitest's timeout marker, after ${Math.round(Number(test.duration))} ms: too short to be an instrumentation timeout`,
      };
      const timedOut = isInstrumentationTimeout(test);
      if (allowed.has(file)) {
        tolerated.push({ kind: 'tolerated', waiver: WAIVER.wallClock, ...entry });
      } else if (solverSet.has(file) && timedOut) {
        tolerated.push({ kind: 'tolerated', waiver: WAIVER.timeout, ...entry });
      } else {
        offenders.push({
          kind: TEST_RUN_KIND.failedTest,
          ...entry,
          message: `${file} > ${name}: ${entry.message}`,
        });
      }
    }
  }
  if (offenders.length === 0 && tolerated.length === 0 && exitCode !== 0) {
    offenders.push({
      kind: TEST_RUN_KIND.unexplainedExit,
      file: null,
      name: null,
      message: `vitest exited ${exitCode} but its results list no failed test or suite`,
    });
  }
  return { accepted: offenders.length === 0, tolerated, offenders };
}

export function formatToleratedFailures(tolerated) {
  const lines = [`tolerated failures in instrumentation-sensitive tests (${tolerated.length}); the regular jobs still gate them:`];
  for (const item of tolerated) lines.push(`  [${item.waiver}] ${item.file} > ${item.name}: ${item.message}`);
  return `${lines.join('\n')}\n`;
}

export function formatToleratedFailuresMarkdown(tolerated) {
  const lines = ['### Tolerated failures (instrumentation-sensitive tests)', ''];
  for (const item of tolerated) lines.push(`- ${item.waiver}: \`${item.file}\` > ${item.name}: ${item.message}`);
  return `${lines.join('\n')}\n`;
}

export function allowlistOffenders(files, readText) {
  return files.flatMap((file) => {
    const text = readText(file);
    if (text === null) return [`${file}: does not exist`];
    if (!text.includes('performance.now(')) return [`${file}: does not time anything (no performance.now call), so it has no business in the instrumentation-sensitive list`];
    return [];
  });
}
