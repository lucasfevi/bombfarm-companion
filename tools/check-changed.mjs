import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dependentsFilters, scopeOfChange } from './check-changed-scope.mjs';
import { cappedWorkers } from './cpu-budget.mjs';
import { npmrcWorkspaceConcurrency } from './workspace-concurrency.mjs';

/**
 * The scoped local check: build the workspace packages, then typecheck, lint and test only what
 * the branch's diff reaches. CI runs the full matrix on a single-tenant runner; this is the run
 * that fits between two commits on a machine several sessions share.
 *
 * Why the scoping is computed here rather than handed to pnpm's `...[ref]` selector: that
 * selector finds the repo root by walking up to a `.git` DIRECTORY, and a worktree's `.git` is a
 * file, so from any worktree nested under the primary checkout it resolves to the primary and
 * matches no package. Measured 2026-09-17 with pnpm 10.12.1: a touched `packages/farm/src/index.ts`
 * selected nothing. `...{<dir>}` takes the directory as given and works everywhere.
 *
 * Vitest's `--changed <sha>` walks the module graph and is blind to a test that reads a file
 * instead of importing it. The `tools` project is all such guards and runs whole, always; the
 * filesystem-reading specs under `apps/web/src/tests` are CI's to catch.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE_GLOB_ROOTS = ['apps', 'packages'];
const DEFAULT_BASE_REFS = ['origin/develop', 'develop'];

function git(args) {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

function refExists(ref) {
  return spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd: REPO_ROOT }).status === 0;
}

function resolveBase(argv) {
  const sinceIndex = argv.indexOf('--since');
  const requested = sinceIndex >= 0 ? argv[sinceIndex + 1] : DEFAULT_BASE_REFS.find(refExists);
  if (!requested) {
    throw new Error(`none of ${DEFAULT_BASE_REFS.join(', ')} exists; pass --since <ref>`);
  }
  return { ref: requested, sha: git(['merge-base', requested, 'HEAD']).trim() };
}

function changedFiles(baseSha) {
  const committedOrModified = git(['diff', '--name-only', baseSha]);
  const untracked = git(['ls-files', '--others', '--exclude-standard']);
  return [...new Set(`${committedOrModified}\n${untracked}`.split('\n').map((line) => line.trim()).filter(Boolean))];
}

function workspacePackageDirs() {
  return WORKSPACE_GLOB_ROOTS.flatMap((root) =>
    readdirSync(path.join(REPO_ROOT, root), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(path.join(REPO_ROOT, root, entry.name, 'package.json')))
      .map((entry) => `${root}/${entry.name}`),
  );
}

function run(command) {
  process.stdout.write(`\n> ${command}\n`);
  const result = spawnSync(command, { cwd: REPO_ROOT, stdio: 'inherit', shell: true });
  if (result.signal) {
    process.kill(process.pid, result.signal);
  }
  if (result.status !== 0) {
    process.stderr.write(`\ncheck-changed: "${command}" exited ${result.status}\n`);
    process.exit(result.status ?? 1);
  }
}

function main() {
  const { ref, sha } = resolveBase(process.argv.slice(2));
  const files = changedFiles(sha);
  const { everything, widened, changedPackageDirs } = scopeOfChange(files, workspacePackageDirs());

  process.stdout.write(`check-changed: ${files.length} file(s) changed since ${ref} (${sha.slice(0, 8)})\n`);
  if (everything) {
    process.stdout.write(`  ${widened.join(', ')} reach every package — typecheck, lint and test run unscoped\n`);
  } else if (changedPackageDirs.length > 0) {
    process.stdout.write(`  packages + dependents: ${changedPackageDirs.join(', ')}\n`);
  } else {
    process.stdout.write('  no workspace package changed — package-level typecheck and lint skipped\n');
  }

  process.env.npm_config_workspace_concurrency = String(
    cappedWorkers(npmrcWorkspaceConcurrency(), 'workspace:check-changed'),
  );

  run('pnpm --filter "./packages/**" build');
  if (everything) {
    run('pnpm -r typecheck');
    run('pnpm -r lint');
  } else if (changedPackageDirs.length > 0) {
    run(`pnpm ${dependentsFilters(changedPackageDirs)} typecheck`);
    run(`pnpm ${dependentsFilters(changedPackageDirs)} lint`);
  }
  run('pnpm lint:tools');
  run(everything ? 'node tools/with-heavy-slot.mjs pnpm exec vitest run' : `pnpm exec vitest run --changed ${sha}`);
  if (!everything) {
    run('pnpm exec vitest run --project tools');
  }

  process.stdout.write(
    '\ncheck-changed: green for what this diff reaches. CI runs the full matrix on push; the\n' +
      'Playwright e2e and Electron smoke suites are separate and still owed when the change\n' +
      'reaches that host (see AGENTS.md, Local checks).\n',
  );
}

main();
