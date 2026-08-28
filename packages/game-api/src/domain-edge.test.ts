import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FUSE_FLOOR } from '@bombfarm/domain/model';
import { required } from './test-fixtures.js';

const repoRoot = resolve(__dirname, '../../..');
const gameApiRoot = resolve(__dirname, '..');

describe('packages/game-api <-> @bombfarm/domain edge', () => {
  it('@bombfarm/domain is a declared workspace dependency, not a phantom hoist', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(gameApiRoot, 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };

    expect(
      manifest.dependencies?.['@bombfarm/domain'],
      'packages/game-api/package.json must declare "@bombfarm/domain": "workspace:*" under ' +
        'dependencies — without it the import resolves only because pnpm hoists every ' +
        'workspace package into the repo-root node_modules/@bombfarm/ (a phantom dependency).',
    ).toBe('workspace:*');
  });

  it('a value import from a domain subpath resolves at runtime (not just a type)', () => {
    // Published expectation, read never edited: packages/domain/tests/model.test.ts's
    // FUSE_FLOOR contract. This is a runtime value, not a type-only import — proving Vitest's
    // server.deps.inline actually loads domain's dist rather than merely type-checking it.
    expect(FUSE_FLOOR).toBe(0.4);
  });

  it('.github/workflows/ci-desktop.yml builds @bombfarm/domain before or alongside @bombfarm/game-api in one pnpm -r --filter invocation', () => {
    const workflowText = readFileSync(
      resolve(repoRoot, '.github/workflows/ci-desktop.yml'),
      'utf8',
    );

    const buildLineMatch = workflowText.match(
      /run:\s*pnpm -r ((?:--filter \S+ )+)build\s*$/m,
    );
    expect(
      buildLineMatch,
      'expected one `pnpm -r --filter ... build` line in ci-desktop.yml',
    ).not.toBeNull();

    const filters = required(buildLineMatch?.[1], 'expected a captured --filter group');
    expect(filters).toContain('--filter @bombfarm/domain');
    expect(filters).toContain('--filter @bombfarm/game-api');
    // pnpm -r topologically orders the build regardless of --filter flag order, so "before or
    // alongside" is satisfied by both filters appearing in the same recursive invocation —
    // asserted here rather than by textual order, which pnpm does not honour.
  });
});
