import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORTUGUESE_WIRE_TOKENS } from './lexicon.js';

/**
 * The rotation vocabulary boundary this feature builds — and nothing else. Deliberately does
 * NOT scan `routes.ts`, `assemble.ts`, `fingerprints.ts`, the fixtures, or the rest of the tree:
 * those legitimately carry wire vocabulary today, and a guard that fails on day one against
 * hundreds of pre-existing occurrences gets disabled rather than fixed. `lexicon.ts` itself is
 * excluded — it is the one file allowed to spell the tokens it forbids everywhere else.
 */
export const VOCABULARY_GUARD_SCOPE_DIR = 'packages/game-api/src/rotation';
export const VOCABULARY_GUARD_SCOPE_EXTRA_FILES: readonly string[] = ['packages/contracts/src/rotation-snapshot.ts'];

/** The real count is 3 (`normalize.ts`, `vocabulary-guard.ts`, `rotation-snapshot.ts`) as of this
 *  writing. A resolved count below this is treated as a guard failure — scanning too little —
 *  never as a pass; deliberately widen this alongside any edit that legitimately grows the scope. */
export const VOCABULARY_GUARD_MIN_SCOPE_FILES = 3;

function isScopeExcluded(repoRelativePath: string): boolean {
  return repoRelativePath.endsWith('/lexicon.ts') || repoRelativePath.endsWith('.test.ts');
}

export interface ScopedFile {
  readonly path: string;
  readonly source: string;
}

export interface WireVocabularyViolation {
  readonly path: string;
  readonly line: number;
  readonly identifier: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Built from {@link PORTUGUESE_WIRE_TOKENS} — never a hand-written literal — so this guard's own
 * source cannot trip itself: it names no forbidden token directly, only imports the list.
 */
function forbiddenTokenPattern(): RegExp {
  const alternation = PORTUGUESE_WIRE_TOKENS.map(escapeRegExp).join('|');
  return new RegExp(`\\b(?:${alternation})\\b`, 'g');
}

/** Every wire-vocabulary violation across `files`, naming the file, the 1-based line, and the
 *  matched identifier. */
export function findWireVocabularyViolations(files: ReadonlyArray<ScopedFile>): ReadonlyArray<WireVocabularyViolation> {
  const pattern = forbiddenTokenPattern();
  const violations: WireVocabularyViolation[] = [];

  for (const file of files) {
    const lines = file.source.split('\n');
    lines.forEach((line, index) => {
      for (const match of line.matchAll(pattern)) {
        violations.push({ path: file.path, line: index + 1, identifier: match[0] });
      }
    });
  }

  return violations;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..');
const REPO_ROOT_MARKER = 'pnpm-workspace.yaml';

function assertIsRepoRoot(root: string): void {
  if (!existsSync(join(root, REPO_ROOT_MARKER))) {
    throw new Error(
      `[vocabulary-guard] resolved root "${root}" is not the repo root — it has no ${REPO_ROOT_MARKER}. ` +
        'resolveScopeFiles() must run against the real repo root, or it silently scans nothing.',
    );
  }
}

function toPosixPath(path: string): string {
  return path.split(sep).join('/');
}

function walkFiles(dir: string): readonly string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(entryPath));
    } else if (entry.isFile()) {
      results.push(entryPath);
    }
  }
  return results;
}

/** Resolves the guard's scope against the real tree via a plain recursive filesystem walk — not
 *  `git ls-files`, which prints a warning and exits 0 on a wrong root, and never sees a
 *  gitignored in-scope file at all. Reads every resolved file's source from disk. Throws (rather
 *  than returning an empty or truncated list) if `root` is not this repo's root, or if the scope
 *  resolves to fewer than {@link VOCABULARY_GUARD_MIN_SCOPE_FILES} files. */
export function resolveScopeFiles(root: string = REPO_ROOT): ReadonlyArray<ScopedFile> {
  assertIsRepoRoot(root);

  const scopeDirAbs = resolve(root, VOCABULARY_GUARD_SCOPE_DIR);
  const scopedPaths = walkFiles(scopeDirAbs)
    .map((absPath) => toPosixPath(relative(root, absPath)))
    .filter((repoRelativePath) => !isScopeExcluded(repoRelativePath));

  const paths = [...scopedPaths, ...VOCABULARY_GUARD_SCOPE_EXTRA_FILES];

  if (paths.length < VOCABULARY_GUARD_MIN_SCOPE_FILES) {
    throw new Error(
      `[vocabulary-guard] scope resolved to only ${String(paths.length)} file(s), below the declared minimum of ` +
        `${String(VOCABULARY_GUARD_MIN_SCOPE_FILES)} (VOCABULARY_GUARD_MIN_SCOPE_FILES). This is a guard ` +
        'failure — it is scanning too little — not a pass.',
    );
  }

  return paths.map((path) => ({ path, source: readFileSync(resolve(root, path), 'utf8') }));
}
