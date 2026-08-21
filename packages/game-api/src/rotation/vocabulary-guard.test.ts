import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  VOCABULARY_GUARD_MIN_SCOPE_FILES,
  VOCABULARY_GUARD_SCOPE_DIR,
  VOCABULARY_GUARD_SCOPE_EXTRA_FILES,
  findWireVocabularyViolations,
  isScopeExcluded,
  type ScopedFile,
} from './vocabulary-guard.js';

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
function resolveScopeFiles(root: string = REPO_ROOT): ReadonlyArray<ScopedFile> {
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

describe('vocabulary guard — declared scope, resolved from disk', () => {
  it('non-vacuity: the declared scope resolves to more than one file', () => {
    const files = resolveScopeFiles();
    expect(files.length).toBeGreaterThan(1);
  });

  it('the real declared scope carries zero wire-vocabulary violations', () => {
    const files = resolveScopeFiles();
    const violations = findWireVocabularyViolations(files);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});

describe('resolveScopeFiles — self-defence', () => {
  it('throws, naming the path, when given a root that exists but is not the repo root', () => {
    const notRepoRoot = resolve(REPO_ROOT, 'apps', 'web');
    expect(() => resolveScopeFiles(notRepoRoot)).toThrow(notRepoRoot);
  });
});

describe('findWireVocabularyViolations — synthetic red/green pair', () => {
  it('reports a Portuguese identifier, naming the file, line and identifier', () => {
    const files: ScopedFile[] = [
      {
        path: 'packages/game-api/src/rotation/synthetic.ts',
        source: ['export function readHouse(body: Record<string, unknown>) {', '  return body.casa;', '}'].join('\n'),
      },
    ];

    const violations = findWireVocabularyViolations(files);
    expect(violations).toEqual([
      { path: 'packages/game-api/src/rotation/synthetic.ts', line: 2, identifier: 'casa' },
    ]);
  });

  it('reports nothing for the same source with the Portuguese identifier replaced', () => {
    const files: ScopedFile[] = [
      {
        path: 'packages/game-api/src/rotation/synthetic.ts',
        source: ['export function readHouse(body: Record<string, unknown>) {', '  return body.house;', '}'].join('\n'),
      },
    ];

    const violations = findWireVocabularyViolations(files);
    expect(violations).toEqual([]);
  });
});
