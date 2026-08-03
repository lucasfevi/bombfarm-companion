#!/usr/bin/env node
/**
 * Open the merged Playwright report from a failed CI run.
 *
 * The same report is published to GitHub Pages and linked from the PR comment —
 * this script is the offline path (and the only one that includes traces, which
 * are stripped from the public Pages copy).
 *
 * Default: download the single `e2e-report` artifact and open it locally.
 *
 * Usage:
 *   node e2e/scripts/show-ci-report.mjs
 *   node e2e/scripts/show-ci-report.mjs --pr 12
 *   node e2e/scripts/show-ci-report.mjs --url-only
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve(process.cwd(), 'tmp-e2e-report');
const WORKFLOW_FILE = 'e2e-web.yml';
const ROOT = process.cwd();
const PLAYWRIGHT_CLI = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');

const REPORT_ARTIFACT = 'e2e-report';
const LEGACY_ARTIFACTS = ['playwright-report-visual', 'playwright-report-visual-merged'];
const ARTIFACT_PREFIX = 'playwright-report';
const PAGES_ROOT = 'https://lucasfevi.github.io/bombfarm-companion';

function usage(exitCode = 0) {
  const text = `Usage: node e2e/scripts/show-ci-report.mjs [--pr <n>] [--run <id>] [--url-only] [--help]

Resolves the latest failed Playwright e2e CI run for the current branch's PR
(or --pr / --run), downloads the merged report artifact, and opens it locally.

--url-only  Print the online report URL and stop (no download).

To review without downloading anything, open the published report URL printed
below — it holds every shard (smoke + visual) in one comparator.`;
  console[exitCode ? 'error' : 'log'](text);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = { pr: null, run: null, urlOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') usage(0);
    if (a === '--url-only' || a === '--artifacts-only') {
      out.urlOnly = true;
      continue;
    }
    if (a === '--pr') {
      out.pr = argv[++i];
      if (!out.pr) usage(1);
      continue;
    }
    if (a === '--run') {
      out.run = argv[++i];
      if (!out.run) usage(1);
      continue;
    }
    console.error(`Unknown argument: ${a}`);
    usage(1);
  }
  return out;
}

function gh(args, { allowFail = false } = {}) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    if (allowFail) return null;
    const stderr = err.stderr?.toString?.() || err.message;
    console.error(stderr);
    process.exit(1);
  }
}

function ghJson(args) {
  const raw = gh(args);
  return raw ? JSON.parse(raw) : null;
}

function resolvePrNumber(explicit) {
  if (explicit) {
    const n = Number(explicit);
    if (!Number.isInteger(n) || n < 1) {
      console.error(`Invalid --pr value: ${explicit}`);
      process.exit(1);
    }
    return n;
  }
  const viewed = gh(['pr', 'view', '--json', 'number'], { allowFail: true });
  if (!viewed) {
    console.error(
      'No PR for the current branch. Pass --pr <n>, or check out the PR branch / run gh pr checkout <n>.',
    );
    process.exit(1);
  }
  return JSON.parse(viewed).number;
}

function resolveBranch(prNumber) {
  const pr = ghJson(['pr', 'view', String(prNumber), '--json', 'headRefName,url']);
  return { branch: pr.headRefName, url: pr.url };
}

function listFailedRuns(branch) {
  const runs = ghJson([
    'run',
    'list',
    '--workflow',
    WORKFLOW_FILE,
    '--branch',
    branch,
    '--status',
    'completed',
    '--limit',
    '30',
    '--json',
    'databaseId,conclusion,url,createdAt,displayTitle',
  ]);
  return (runs || []).filter((r) => r.conclusion === 'failure');
}

function listRunArtifacts(runId) {
  const nameWithOwner = gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
  const list = ghJson(['api', `repos/${nameWithOwner}/actions/runs/${runId}/artifacts`]);
  return (list?.artifacts || []).filter((a) => !a.expired);
}

function pickReportArtifact(artifacts) {
  const merged = artifacts.find((a) => a.name === REPORT_ARTIFACT);
  if (merged) return merged;
  for (const legacy of LEGACY_ARTIFACTS) {
    const hit = artifacts.find((a) => a.name === legacy);
    if (hit) return hit;
  }
  const hits = artifacts
    .filter((a) => a.name === ARTIFACT_PREFIX || a.name.startsWith(`${ARTIFACT_PREFIX}-`))
    .sort((a, b) => a.name.localeCompare(b.name));
  return hits[0] ?? null;
}

function resolveRunId({ run, pr }) {
  if (run) {
    const id = String(run);
    if (!/^\d+$/.test(id)) {
      console.error(`Invalid --run value: ${run}`);
      process.exit(1);
    }
    const runMeta = ghJson(['run', 'view', id, '--json', 'url,conclusion']);
    return {
      runId: id,
      prNumber: pr ? Number(pr) : null,
      branch: null,
      prUrl: null,
      runUrl: runMeta?.url ?? null,
    };
  }

  const prNumber = resolvePrNumber(pr);
  const { branch, url } = resolveBranch(prNumber);
  const failed = listFailedRuns(branch);
  if (failed.length === 0) {
    console.error(
      `No failed "${WORKFLOW_FILE}" runs found for PR #${prNumber} (branch ${branch}).\n` +
        'Reports are only produced when a smoke shard or the visual job fails.',
    );
    process.exit(1);
  }

  return { runId: String(failed[0].databaseId), prNumber, branch, prUrl: url, runUrl: failed[0].url };
}

function clearOutDir() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function downloadArtifact(runId, artifactName) {
  gh(['run', 'download', runId, '-n', artifactName, '-D', OUT_DIR]);
}

function findReportPath(root) {
  // Legacy runs uploaded a zipped report; `playwright show-report` opens either.
  for (const legacy of LEGACY_ARTIFACTS) {
    const zipPath = path.join(root, `${legacy}.zip`);
    if (fs.existsSync(zipPath)) return zipPath;
  }

  const direct = path.join(root, 'playwright-report');
  if (fs.existsSync(path.join(direct, 'index.html'))) return direct;
  if (fs.existsSync(path.join(root, 'index.html'))) return root;

  if (!fs.existsSync(root)) return null;
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const candidate = path.join(root, ent.name);
    if (fs.existsSync(path.join(candidate, 'index.html'))) return candidate;
  }
  return null;
}

function openLocalReport(reportPath) {
  const result = spawnSync(process.execPath, [PLAYWRIGHT_CLI, 'show-report', reportPath], {
    stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const resolved = resolveRunId(args);

  console.log(
    [
      resolved.prNumber ? `PR #${resolved.prNumber}` : null,
      resolved.branch ? `branch ${resolved.branch}` : null,
      `run ${resolved.runId}`,
    ]
      .filter(Boolean)
      .join(' · '),
  );
  if (resolved.prUrl) console.log(resolved.prUrl);
  if (resolved.runUrl) console.log(resolved.runUrl);
  console.log(`\nOnline report (no download): ${PAGES_ROOT}/reports/${resolved.runId}/`);
  console.log('Published for ~20 runs; traces are stripped there — download for those.\n');

  if (args.urlOnly) {
    process.exit(0);
  }

  const artifacts = listRunArtifacts(resolved.runId);
  const artifact = pickReportArtifact(artifacts);
  if (!artifact) {
    console.error(`Run ${resolved.runId} has no downloadable visual report artifact.`);
    process.exit(1);
  }

  console.log(`Clearing ${path.relative(ROOT, OUT_DIR) || OUT_DIR}/ …`);
  clearOutDir();

  console.log(`Downloading artifact "${artifact.name}" …`);
  downloadArtifact(resolved.runId, artifact.name);

  const reportPath = findReportPath(OUT_DIR);
  if (!reportPath) {
    console.error(`Downloaded artifact, but no Playwright report found under ${OUT_DIR}`);
    process.exit(1);
  }

  console.log(`Opening ${path.relative(ROOT, reportPath)} …`);
  openLocalReport(reportPath);
}

main();
