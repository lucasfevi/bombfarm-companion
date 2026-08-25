import { PORTUGUESE_WIRE_TOKENS } from '../wire-glossary.js';

/**
 * The wire-vocabulary boundaries this feature and the live-frame decoder build — and nothing
 * else. Deliberately does NOT scan `routes.ts`, `assemble.ts`, `fingerprints.ts`, the rest of the
 * fixtures, or the rest of the tree: those legitimately carry wire vocabulary today, and a guard
 * that fails on day one against hundreds of pre-existing occurrences gets disabled rather than
 * fixed. Every `lexicon.ts` is excluded — each is the one file allowed to spell the tokens it
 * forbids everywhere else.
 */
export const VOCABULARY_GUARD_SCOPE_DIRS: readonly string[] = [
  'packages/game-api/src/rotation',
  'packages/game-api/src/live-frame',
];
export const VOCABULARY_GUARD_SCOPE_EXTRA_FILES: readonly string[] = [
  'packages/contracts/src/rotation-snapshot.ts',
  'packages/contracts/src/live-source.ts',
  'apps/desktop/src/main/live-source/tls-stream.ts',
  'apps/desktop/src/main/live-source/fixtures/generate-replay-stream.ts',
];

/** The real count is 6 (`normalize.ts`, `vocabulary-guard.ts`, `rotation-snapshot.ts`,
 *  `live-source.ts`, `tls-stream.ts`, `generate-replay-stream.ts`) as of this writing —
 *  `packages/game-api/src/live-frame/` contributes nothing from its own directory walk today,
 *  since it holds only the excluded `lexicon.ts`. A resolved count below this is treated as a
 *  guard failure — scanning too little — never as a pass; deliberately widen this alongside any
 *  edit that legitimately grows the scope. */
export const VOCABULARY_GUARD_MIN_SCOPE_FILES = 6;

/** Whether `repoRelativePath` is out of the guard's scope even though it lives under one of
 *  {@link VOCABULARY_GUARD_SCOPE_DIRS} — exported so `resolveScopeFiles()` (a filesystem walk that
 *  cannot live in this dependency-free module, see the file-level split) can apply the same rule
 *  it declares here. */
export function isScopeExcluded(repoRelativePath: string): boolean {
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
