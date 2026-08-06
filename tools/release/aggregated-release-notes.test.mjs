import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { buildAggregatedReleaseNotes } from './aggregated-release-notes.mjs';

function writePackage(root, relativeDir, name, version, changelog) {
  const dir = join(root, relativeDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name, version, private: true }, null, 2),
  );
  if (changelog !== undefined) {
    writeFileSync(join(dir, 'CHANGELOG.md'), changelog);
  }
}

describe('buildAggregatedReleaseNotes', () => {
  it('aggregates changelog sections for every released package', async () => {
    const root = mkdtempSync(join(tmpdir(), 'bfc-notes-'));
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'bfc-notes-fixture', private: true }, null, 2),
    );
    writeFileSync(
      join(root, 'pnpm-workspace.yaml'),
      'packages:\n  - "apps/*"\n  - "packages/*"\n',
    );
    writePackage(
      root,
      'apps/web',
      '@bombfarm/web',
      '0.1.0',
      '# @bombfarm/web\n\n## 0.1.0\n\n### Patch Changes\n\n- Web fix\n',
    );
    writePackage(
      root,
      'packages/contracts',
      '@bombfarm/contracts',
      '0.2.0',
      '# @bombfarm/contracts\n\n## 0.2.0\n\n### Minor Changes\n\n- Contract bump\n',
    );

    const notes = await buildAggregatedReleaseNotes(
      [
        { name: '@bombfarm/web', oldVersion: '0.0.0', newVersion: '0.1.0' },
        { name: '@bombfarm/contracts', oldVersion: '0.1.0', newVersion: '0.2.0' },
      ],
      root,
    );

    expect(notes).toContain('## @bombfarm/web');
    expect(notes).toContain('- Web fix');
    expect(notes).toContain('## @bombfarm/contracts');
    expect(notes).toContain('- Contract bump');
  });
});
