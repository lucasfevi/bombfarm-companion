import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { waitForHeavySlot } from './cpu-budget.mjs';
import {
  KIND,
  baselineIntegrityFindings,
  canonicalBaselineText,
  emptyBaseline,
  evaluateAgainstBaseline,
  formatMarkdownSummary,
  formatReport,
  guardBaseFindings,
  measurementFindings,
  normalizeSummary,
  overallOf,
  planUpdate,
} from './domain-coverage-core.mjs';
import { runtimeBearingFiles } from './domain-coverage-runtime.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_DIRECTORY = path.join(REPO_ROOT, 'packages/domain');
const BASELINE_PATH = path.join(PACKAGE_DIRECTORY, 'coverage-baseline.json');
const COVERAGE_DIRECTORY = path.join(REPO_ROOT, 'coverage');
const BLOB_DIRECTORY = path.join(COVERAGE_DIRECTORY, 'domain-blobs');
const MERGED_SUMMARY_PATH = path.join(COVERAGE_DIRECTORY, 'domain', 'coverage-summary.json');
const HEARTBEAT_MS = 60_000;

// The merge replays the errors the solver pass recorded, and that pass runs with unhandled errors ignored; the merge has no tests of its own, so it needs the same flag or it exits 1 after writing a good summary.
const MERGE_COMMAND =
  'pnpm exec vitest run --merge-reports=coverage/domain-blobs --dangerouslyIgnoreUnhandledErrors --coverage --coverage.reportsDirectory=coverage/domain --coverage.reporter=text-summary --coverage.reporter=json-summary';

const MEASUREMENT_COMMANDS = [
  'pnpm exec vitest run --project @bombfarm/domain --coverage --coverage.reporter=json-summary --coverage.reportsDirectory=coverage/domain-main --reporter=blob --outputFile=coverage/domain-blobs/main.json',
  'pnpm exec vitest run --config vitest.solver.config.ts --coverage --coverage.reporter=json-summary --coverage.reportsDirectory=coverage/domain-solver --reporter=blob --outputFile=coverage/domain-blobs/solver.json',
  MERGE_COMMAND,
];
const EXPECTED_BLOBS = ['main.json', 'solver.json'];
const STALE_OUTPUT_DIRECTORIES = ['domain-blobs', 'domain-main', 'domain-solver', 'domain'];

function usage() {
  return [
    'usage: node tools/domain-coverage.mjs [check|update|guard-base] [options]',
    '  check (default)      measure, then fail on any finding against the committed baseline',
    '  update               measure, refuse regressions, then rewrite the baseline',
    '  guard-base --base R  fail when head records a lower number than ref R, without a new waiver',
    'options:',
    '  --summary <path>     read an existing coverage-summary.json instead of measuring',
    '  --baseline <path>    baseline file (default packages/domain/coverage-baseline.json)',
    '  --waive <src/file.ts> --reason "<text>"   (update only, repeatable) record a reviewed decline',
  ].join('\n');
}

function fail(message, code = 1) {
  process.stderr.write(`domain-coverage: ${message}\n`);
  process.exit(code);
}

function parseArguments(argv) {
  const options = { command: 'check', summary: null, baseline: BASELINE_PATH, base: null, waivers: [] };
  const rest = [...argv];
  if (rest.length > 0 && !rest[0].startsWith('--')) options.command = rest.shift();
  if (!['check', 'update', 'guard-base'].includes(options.command)) fail(`unknown command "${options.command}"\n${usage()}`, 2);

  const takeValue = (flag) => {
    const value = rest.shift();
    if (value === undefined || value.startsWith('--')) fail(`${flag} needs a value\n${usage()}`, 2);
    return value;
  };
  while (rest.length > 0) {
    const flag = rest.shift();
    if (flag === '--summary') options.summary = path.resolve(takeValue(flag));
    else if (flag === '--baseline') options.baseline = path.resolve(takeValue(flag));
    else if (flag === '--base') options.base = takeValue(flag);
    else if (flag === '--waive') options.waivers.push({ file: takeValue(flag), reason: null });
    else if (flag === '--reason') {
      const latest = options.waivers.at(-1);
      if (latest === undefined || latest.reason !== null) fail('--reason must follow its --waive', 2);
      latest.reason = takeValue(flag);
    } else fail(`unknown option ${flag}\n${usage()}`, 2);
  }
  const unreasoned = options.waivers.filter((waiver) => waiver.reason === null);
  if (unreasoned.length > 0) fail(`--waive ${unreasoned[0].file} has no --reason`, 2);
  if (options.waivers.length > 0 && options.command !== 'update') fail('--waive is only valid with update', 2);
  if (options.command === 'guard-base' && options.base === null) fail('guard-base needs --base <ref>', 2);
  return options;
}

function sourceFilesOnDisk() {
  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        found.push(path.relative(PACKAGE_DIRECTORY, full).replaceAll('\\', '/'));
      }
    }
  };
  walk(path.join(PACKAGE_DIRECTORY, 'src'));
  return found.sort();
}

function sourceTree() {
  const sourceFiles = sourceFilesOnDisk();
  return { sourceFiles, runtimeFiles: runtimeBearingFiles(PACKAGE_DIRECTORY, sourceFiles) };
}

function readBaseline(baselinePath) {
  if (!existsSync(baselinePath)) return null;
  try {
    return JSON.parse(readFileSync(baselinePath, 'utf8'));
  } catch (error) {
    return fail(`${baselinePath} is not valid JSON: ${error.message}`);
  }
}

function runStreaming(command) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    process.stdout.write(`\n> ${command}\n`);
    const heartbeat = setInterval(() => {
      process.stdout.write(`domain-coverage: still running (${Math.round((Date.now() - startedAt) / 1000)} s): ${command.slice(0, 80)}\n`);
    }, HEARTBEAT_MS);
    const child = spawn(command, { cwd: REPO_ROOT, stdio: 'inherit', shell: true });
    child.on('error', (error) => {
      clearInterval(heartbeat);
      process.stderr.write(`${error.message}\n`);
      resolve(1);
    });
    child.on('exit', (code, signal) => {
      clearInterval(heartbeat);
      resolve(signal ? 1 : (code ?? 1));
    });
  });
}

async function measure() {
  waitForHeavySlot('domain-coverage');
  for (const directory of STALE_OUTPUT_DIRECTORIES) {
    rmSync(path.join(COVERAGE_DIRECTORY, directory), { recursive: true, force: true });
  }
  for (const command of MEASUREMENT_COMMANDS) {
    const code = await runStreaming(command);
    if (code !== 0) fail(`"${command.slice(0, 60)}…" exited ${code}; a coverage measurement needs both passes green`);
  }
  const missingBlobs = EXPECTED_BLOBS.filter((blob) => !existsSync(path.join(BLOB_DIRECTORY, blob)));
  if (missingBlobs.length > 0) fail(`the measurement left no ${missingBlobs.join(', ')} under coverage/domain-blobs`);
  return MERGED_SUMMARY_PATH;
}

function loadSummary(summaryPath) {
  if (!existsSync(summaryPath)) fail(`${summaryPath} does not exist`);
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
  let measured;
  try {
    measured = normalizeSummary(summary, PACKAGE_DIRECTORY);
  } catch (error) {
    return fail(error.message);
  }
  const unusable = measurementFindings(measured);
  if (unusable.length > 0) fail(unusable.map((item) => item.message).join('\n'));
  return { measured, overall: overallOf(summary) };
}

function appendStepSummary(markdown) {
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (target) appendFileSync(target, markdown);
}

function printFindings(findings) {
  for (const item of findings) process.stderr.write(`  [${item.kind}] ${item.message}\n`);
}

async function check(options) {
  const baseline = readBaseline(options.baseline);
  if (baseline === null) fail(`${options.baseline} does not exist — run \`pnpm coverage:domain:update\` to record it`);
  const summaryPath = options.summary ?? (await measure());
  const { measured, overall } = loadSummary(summaryPath);
  const findings = evaluateAgainstBaseline({ baseline, measured, ...sourceTree() });

  process.stdout.write(formatReport({ overall, measured, findings }));
  appendStepSummary(formatMarkdownSummary({ title: 'Domain coverage ratchet', overall, measured, findings }));
  if (findings.length > 0) {
    process.stderr.write(`\ndomain-coverage: ${findings.length} finding(s); fix the code, or record a reviewed change with \`pnpm coverage:domain:update\`.\n`);
    process.exit(1);
  }
}

async function update(options) {
  const existing = readBaseline(options.baseline);
  const bootstrap = existing === null;
  const baseline = existing ?? emptyBaseline();
  const summaryPath = options.summary ?? (await measure());
  const { measured } = loadSummary(summaryPath);

  const plan = planUpdate({ baseline, measured, ...sourceTree(), waivers: options.waivers, bootstrap });
  if (plan.refusals.length > 0) {
    process.stderr.write(`domain-coverage: update refused — ${plan.refusals.length} problem(s), nothing written:\n`);
    printFindings(plan.refusals);
    process.exit(1);
  }
  const alreadyCanonical = existsSync(options.baseline) && readFileSync(options.baseline, 'utf8') === canonicalBaselineText(plan.next);
  if (!plan.changed && alreadyCanonical) {
    process.stdout.write('domain-coverage: the baseline already matches the measurement — nothing written.\n');
    printPendingReview(plan.pendingReview);
    return;
  }
  mkdirSync(path.dirname(options.baseline), { recursive: true });
  writeFileSync(options.baseline, canonicalBaselineText(plan.next));
  process.stdout.write(`domain-coverage: wrote ${options.baseline} (${Object.keys(plan.next.files).length} files). Review the diff: it is the review surface.\n`);
  printPendingReview(plan.pendingReview);
}

function printPendingReview(pending) {
  if (pending.length === 0) return;
  process.stdout.write('`update` does not decide these for you; `check` fails until a reviewed hand edit or a test settles each:\n');
  for (const item of pending) process.stdout.write(`  [${item.kind}] ${item.file}\n`);
}

function gitText(args) {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function guardBase(options) {
  const head = readBaseline(options.baseline);
  if (head === null) fail(`${options.baseline} does not exist`);
  if (gitText(['rev-parse', '--verify', '--quiet', `${options.base}^{commit}`]).status !== 0) {
    fail(`the base ref "${options.base}" does not resolve — fetch it first; a guard that cannot see the base must fail, not pass`);
  }
  const relativePath = path.relative(REPO_ROOT, options.baseline).replaceAll('\\', '/');
  const spec = `${options.base}:${relativePath}`;
  if (gitText(['cat-file', '-e', spec]).status !== 0) {
    process.stdout.write(`domain-coverage guard-base: ${relativePath} does not exist at ${options.base}; this change introduces it, nothing to compare.\n`);
    return;
  }
  const shown = gitText(['show', spec]);
  if (shown.status !== 0) fail(`git show ${spec} failed: ${shown.stderr.trim()}`);
  const { sourceFiles, runtimeFiles } = sourceTree();
  const malformed = baselineIntegrityFindings({ baseline: head, sourceFiles, runtimeFiles }).filter((item) => item.kind === KIND.invalidBaseline);
  if (malformed.length > 0) {
    process.stderr.write('domain-coverage guard-base: the head baseline is malformed:\n');
    printFindings(malformed);
    process.exit(1);
  }
  const findings = guardBaseFindings({ base: JSON.parse(shown.stdout), head, sourceFiles });

  appendStepSummary(formatMarkdownSummary({ title: `Domain coverage baseline vs ${options.base}`, overall: null, measured: null, findings }));
  if (findings.length === 0) {
    process.stdout.write(`domain-coverage guard-base: no recorded number is lower than at ${options.base}.\n`);
    return;
  }
  process.stderr.write(`domain-coverage guard-base: ${findings.length} recorded number(s) lower than at ${options.base}:\n`);
  printFindings(findings);
  process.stderr.write(`A lowered number needs a new \`waivers\` entry for that file (\`pnpm coverage:domain:update --waive <file> --reason "<why>"\`).\n`);
  process.exit(1);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.command === 'guard-base') guardBase(options);
  else if (options.command === 'update') await update(options);
  else await check(options);
}

main().catch((error) => fail(error.stack ?? String(error)));
