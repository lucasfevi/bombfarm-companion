import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findWireVocabularyViolations, resolveScopeFiles, type ScopedFile } from './vocabulary-guard.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

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
