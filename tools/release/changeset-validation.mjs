/**
 * Validates changeset files before versioning.
 *
 * The changesets CLI already rejects unknown package names with a named file
 * (design F4). This module adds bump-kind and empty-summary checks the CLI
 * does not guarantee.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VALID_BUMP_KINDS = new Set(['major', 'minor', 'patch']);

/**
 * @typedef {'unknown-package' | 'invalid-bump' | 'empty-summary' | 'malformed-frontmatter'} ValidationKind
 */

/**
 * @typedef {{ file: string, kind: ValidationKind, detail: string }} ValidationProblem
 */

/**
 * @param {{ files: string[], workspacePackageNames: string[] }} options
 * @returns {ValidationProblem[]}
 */
export function validateChangesets({ files, workspacePackageNames }) {
  const knownPackages = new Set(workspacePackageNames);
  const problems = [];

  for (const file of files) {
    const fileLabel = basename(file);
    const content = readFileSync(file, 'utf8');
    const parsed = parseChangesetFrontmatter(content);

    if (!parsed.ok) {
      problems.push({
        file: fileLabel,
        kind: 'malformed-frontmatter',
        detail: parsed.detail,
      });
      continue;
    }

    if (parsed.entries.length === 0) {
      problems.push({
        file: fileLabel,
        kind: 'malformed-frontmatter',
        detail: 'frontmatter contains no package entries',
      });
      continue;
    }

    for (const entry of parsed.entries) {
      if (!knownPackages.has(entry.packageName)) {
        problems.push({
          file: fileLabel,
          kind: 'unknown-package',
          detail: `package "${entry.packageName}" is not in the workspace`,
        });
      }

      if (!VALID_BUMP_KINDS.has(entry.bump)) {
        problems.push({
          file: fileLabel,
          kind: 'invalid-bump',
          detail: `invalid bump kind "${entry.bump}" for "${entry.packageName}"`,
        });
      }
    }

    if (parsed.summary.trim().length === 0) {
      problems.push({
        file: fileLabel,
        kind: 'empty-summary',
        detail: 'changeset summary is empty',
      });
    }
  }

  return problems;
}

/**
 * @param {string} content
 * @returns {{ ok: true, entries: { packageName: string, bump: string }[], summary: string } | { ok: false, detail: string }}
 */
export function parseChangesetFrontmatter(content) {
  if (!content.startsWith('---')) {
    return { ok: false, detail: 'missing opening frontmatter delimiter' };
  }

  const closingIndex = content.indexOf('\n---', 3);
  if (closingIndex === -1) {
    return { ok: false, detail: 'missing closing frontmatter delimiter' };
  }

  const frontmatter = content.slice(3, closingIndex).trim();
  const summary = content.slice(closingIndex + 4).trimStart();

  const entries = [];
  for (const line of frontmatter.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const match = trimmed.match(/^"([^"]+)":\s*(.*)$/);
    if (!match) {
      return { ok: false, detail: `unparseable frontmatter line: ${trimmed}` };
    }

    entries.push({
      packageName: match[1],
      bump: match[2].trim(),
    });
  }

  return { ok: true, entries, summary };
}

/**
 * @param {string} rootDir
 * @returns {string[]}
 */
export function readWorkspacePackageNames(rootDir) {
  const workspaceFile = join(rootDir, 'pnpm-workspace.yaml');
  const workspaceYaml = readFileSync(workspaceFile, 'utf8');
  const globs = [];

  for (const line of workspaceYaml.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^-\s+(.+)$/);
    if (match) {
      globs.push(match[1].trim());
    }
  }

  const names = [];
  for (const pattern of globs) {
    const starIndex = pattern.indexOf('/*');
    if (starIndex === -1) {
      continue;
    }
    const parent = join(rootDir, pattern.slice(0, starIndex));
    for (const child of readdirSync(parent, { withFileTypes: true })) {
      if (!child.isDirectory()) {
        continue;
      }
      const manifestPath = join(parent, child.name, 'package.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (manifest.name) {
        names.push(manifest.name);
      }
    }
  }

  return names.sort();
}

/**
 * @param {string[]} [argv]
 * @returns {number}
 */
export function runCli(argv = process.argv.slice(2)) {
  const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
  const changesetDir = join(root, '.changeset');
  const workspacePackageNames = readWorkspacePackageNames(root);

  const requestedFiles = argv.length > 0
    ? argv.map((path) => resolve(root, path))
    : readdirSync(changesetDir)
        .filter((name) => name.endsWith('.md') && name !== 'README.md')
        .map((name) => join(changesetDir, name));

  const problems = validateChangesets({
    files: requestedFiles,
    workspacePackageNames,
  });

  if (problems.length === 0) {
    return 0;
  }

  for (const problem of problems) {
    process.stderr.write(`${problem.file}: ${problem.kind} — ${problem.detail}\n`);
  }

  return 1;
}

const entryPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === entryPath) {
  process.exit(runCli());
}
