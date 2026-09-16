import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  ANTIVIRUS_NOTICE,
  GITHUB_RELEASE_BODY_LIMIT,
  TRUNCATION_NOTICE,
  buildAggregatedReleaseNotes,
  fitGitHubReleaseBody,
} from './aggregated-release-notes.mjs';

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

function createFixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'bfc-notes-'));
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'bfc-notes-fixture', private: true }, null, 2),
  );
  writeFileSync(
    join(root, 'pnpm-workspace.yaml'),
    'packages:\n  - "apps/*"\n  - "packages/*"\n',
  );
  return root;
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

  it('prepends the antivirus notice when @bombfarm/desktop is in the released set', async () => {
    const root = createFixtureRoot();
    writePackage(
      root,
      'apps/desktop',
      '@bombfarm/desktop',
      '1.2.0',
      '# @bombfarm/desktop\n\n## 1.2.0\n\n### Minor Changes\n\n- Desktop fix\n',
    );
    writePackage(
      root,
      'apps/web',
      '@bombfarm/web',
      '0.1.0',
      '# @bombfarm/web\n\n## 0.1.0\n\n### Patch Changes\n\n- Web fix\n',
    );

    const notes = await buildAggregatedReleaseNotes(
      [
        { name: '@bombfarm/desktop', oldVersion: '1.1.0', newVersion: '1.2.0' },
        { name: '@bombfarm/web', oldVersion: '0.0.0', newVersion: '0.1.0' },
      ],
      root,
    );

    expect(notes.startsWith(ANTIVIRUS_NOTICE)).toBe(true);
    expect(notes).toContain('## @bombfarm/desktop');
    expect(notes).toContain('## @bombfarm/web');
  });

  it('produces byte-identical output to today when @bombfarm/desktop is not in the released set', async () => {
    const root = createFixtureRoot();
    writePackage(
      root,
      'apps/desktop',
      '@bombfarm/desktop',
      '1.1.0',
      '# @bombfarm/desktop\n\n## 1.1.0\n\n### Minor Changes\n\n- Desktop fix\n',
    );
    writePackage(
      root,
      'apps/web',
      '@bombfarm/web',
      '0.1.0',
      '# @bombfarm/web\n\n## 0.1.0\n\n### Patch Changes\n\n- Web fix\n',
    );

    const notes = await buildAggregatedReleaseNotes(
      [
        { name: '@bombfarm/desktop', oldVersion: '1.1.0', newVersion: '1.1.0' },
        { name: '@bombfarm/web', oldVersion: '0.0.0', newVersion: '0.1.0' },
      ],
      root,
    );

    expect(notes).not.toContain(ANTIVIRUS_NOTICE);
    expect(notes).toBe('## @bombfarm/web\n\n### Patch Changes\n\n- Web fix');
  });

  it('lists a changeset copied into several packages once, under the first package, and counts it in the others', async () => {
    const root = createFixtureRoot();
    const shared =
      '- abc1234: Model three more combat abilities.\n\n  **Breach** reads as flat penetration.\n';
    writePackage(
      root,
      'apps/desktop',
      '@bombfarm/desktop',
      '1.2.0',
      `# @bombfarm/desktop\n\n## 1.2.0\n\n### Minor Changes\n\n${shared}\n- def5678: Desktop only\n`,
    );
    writePackage(
      root,
      'packages/domain',
      '@bombfarm/domain',
      '2.0.0',
      `# @bombfarm/domain\n\n## 2.0.0\n\n### Minor Changes\n\n${shared}\n- 9876543: Domain only\n`,
    );
    writePackage(
      root,
      'apps/web',
      '@bombfarm/web',
      '0.1.0',
      `# @bombfarm/web\n\n## 0.1.0\n\n### Patch Changes\n\n${shared}\n- Updated dependencies [abc1234]\n  - @bombfarm/domain@2.0.0\n`,
    );

    const notes = await buildAggregatedReleaseNotes(
      [
        { name: '@bombfarm/desktop', oldVersion: '1.1.0', newVersion: '1.2.0' },
        { name: '@bombfarm/domain', oldVersion: '1.0.0', newVersion: '2.0.0' },
        { name: '@bombfarm/web', oldVersion: '0.0.0', newVersion: '0.1.0' },
      ],
      root,
    );

    expect(notes.match(/Model three more combat abilities/g)).toHaveLength(1);
    expect(notes.indexOf('Model three more combat abilities')).toBeGreaterThan(
      notes.indexOf('## @bombfarm/desktop'),
    );
    expect(notes.indexOf('Model three more combat abilities')).toBeLessThan(
      notes.indexOf('## @bombfarm/domain'),
    );
    expect(notes).toContain('- def5678: Desktop only');
    expect(notes).toContain('- 9876543: Domain only');
    expect(notes).toContain(
      '## @bombfarm/domain\n\n### Minor Changes\n\n- 9876543: Domain only\n\n_Also carries 1 change listed under an earlier package._',
    );
    expect(notes).toContain(
      '## @bombfarm/web\n\n### Patch Changes\n\n- Updated dependencies [abc1234]\n  - @bombfarm/domain@2.0.0\n\n_Also carries 1 change listed under an earlier package._',
    );
  });

  it('drops a bump heading whose every entry was already listed, and says so when a whole section was', async () => {
    const root = createFixtureRoot();
    writePackage(
      root,
      'apps/desktop',
      '@bombfarm/desktop',
      '1.2.0',
      '# @bombfarm/desktop\n\n## 1.2.0\n\n### Minor Changes\n\n- abc1234: Shared minor\n\n### Patch Changes\n\n- def5678: Shared patch\n',
    );
    writePackage(
      root,
      'packages/hero',
      '@bombfarm/hero',
      '0.2.0',
      '# @bombfarm/hero\n\n## 0.2.0\n\n### Minor Changes\n\n- abc1234: Shared minor\n\n### Patch Changes\n\n- def5678: Shared patch\n- 1111111: Hero only\n',
    );
    writePackage(
      root,
      'packages/ui',
      '@bombfarm/ui',
      '0.3.0',
      '# @bombfarm/ui\n\n## 0.3.0\n\n### Minor Changes\n\n- abc1234: Shared minor\n',
    );

    const notes = await buildAggregatedReleaseNotes(
      [
        { name: '@bombfarm/desktop', oldVersion: '1.1.0', newVersion: '1.2.0' },
        { name: '@bombfarm/hero', oldVersion: '0.1.0', newVersion: '0.2.0' },
        { name: '@bombfarm/ui', oldVersion: '0.2.0', newVersion: '0.3.0' },
      ],
      root,
    );

    expect(notes).toContain(
      '## @bombfarm/hero\n\n### Patch Changes\n\n- 1111111: Hero only\n\n_Also carries 2 changes listed under an earlier package._',
    );
    expect(notes).toContain(
      '## @bombfarm/ui\n\n_Also carries 1 change listed under an earlier package._',
    );
    expect(notes.match(/### Minor Changes/g)).toHaveLength(1);
  });

  it('keeps the entry once when the same prose carries a different commit hash', async () => {
    const root = createFixtureRoot();
    writePackage(
      root,
      'apps/desktop',
      '@bombfarm/desktop',
      '1.2.0',
      '# @bombfarm/desktop\n\n## 1.2.0\n\n### Minor Changes\n\n- abc1234: Same words\n',
    );
    writePackage(
      root,
      'apps/web',
      '@bombfarm/web',
      '0.1.0',
      '# @bombfarm/web\n\n## 0.1.0\n\n### Minor Changes\n\n- fed9876: Same   words\n',
    );

    const notes = await buildAggregatedReleaseNotes(
      [
        { name: '@bombfarm/desktop', oldVersion: '1.1.0', newVersion: '1.2.0' },
        { name: '@bombfarm/web', oldVersion: '0.0.0', newVersion: '0.1.0' },
      ],
      root,
    );

    expect(notes.match(/Same\s+words/g)).toHaveLength(1);
  });

  it('never lets the body exceed the GitHub release limit', async () => {
    const root = createFixtureRoot();
    const entries = Array.from(
      { length: 400 },
      (_, index) => `- ${String(index).padStart(7, '0')}: ${'entry '.repeat(100)}${index}`,
    );
    writePackage(
      root,
      'apps/desktop',
      '@bombfarm/desktop',
      '1.2.0',
      `# @bombfarm/desktop\n\n## 1.2.0\n\n### Minor Changes\n\n${entries.join('\n')}\n`,
    );

    const notes = await buildAggregatedReleaseNotes(
      [{ name: '@bombfarm/desktop', oldVersion: '1.1.0', newVersion: '1.2.0' }],
      root,
    );

    expect(notes.length).toBeLessThanOrEqual(GITHUB_RELEASE_BODY_LIMIT);
    expect(notes.endsWith(TRUNCATION_NOTICE)).toBe(true);
    expect(notes.startsWith(ANTIVIRUS_NOTICE)).toBe(true);
  });
});

describe('fitGitHubReleaseBody', () => {
  it('returns a body within the limit unchanged', () => {
    const notes = '## @bombfarm/web\n\n- abc1234: Small';
    expect(fitGitHubReleaseBody(notes, 100)).toBe(notes);
  });

  it('cuts at an entry boundary and appends the truncation notice', () => {
    const first = `- 0000001: ${'first '.repeat(40).trim()}`;
    const second = `- 0000002: ${'second '.repeat(40).trim()}`;
    const third = `- 0000003: ${'third '.repeat(40).trim()}`;
    const notes = ['## @bombfarm/web', '', first, second, third].join('\n');
    const limit = notes.length - 1;

    const fitted = fitGitHubReleaseBody(notes, limit);

    expect(fitted.length).toBeLessThanOrEqual(limit);
    expect(fitted).toBe(`## @bombfarm/web\n\n${first}\n${second}\n\n${TRUNCATION_NOTICE}`);
  });
});
