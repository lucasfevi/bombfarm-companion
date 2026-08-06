import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assessParity,
  diffVersions,
  readWorkspaceVersions,
} from './version-diff.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

describe('readWorkspaceVersions', () => {
  it('reads every workspace package version from the repo root', () => {
    const versions = readWorkspaceVersions(repoRoot);
    expect(versions['@bombfarm/web']).toBe('0.0.0');
    expect(versions['@bombfarm/desktop']).toBe('0.0.0');
    expect(versions['@bombfarm/ui']).toBe('0.0.0');
    expect(Object.keys(versions).length).toBeGreaterThanOrEqual(7);
  });

  it('reads versions from a synthetic workspace tree', () => {
    const root = mkdtempSync(join(tmpdir(), 'bfc-versions-'));
    writeFileSync(
      join(root, 'pnpm-workspace.yaml'),
      'packages:\n  - apps/*\n',
    );
    mkdirSync(join(root, 'apps', 'web'), { recursive: true });
    writeFileSync(
      join(root, 'apps', 'web', 'package.json'),
      JSON.stringify({ name: '@bombfarm/web', version: '1.2.3' }),
    );

    expect(readWorkspaceVersions(root)).toEqual({
      '@bombfarm/web': '1.2.3',
    });
  });
});

describe('diffVersions', () => {
  it('returns an empty list when maps are identical', () => {
    expect(diffVersions({ a: '1.0.0' }, { a: '1.0.0' })).toEqual([]);
  });

  it('reports changed versions in stable sorted order', () => {
    const before = {
      '@bombfarm/web': '0.1.0',
      '@bombfarm/desktop': '0.1.0',
      '@bombfarm/ui': '0.1.0',
    };
    const after = {
      '@bombfarm/desktop': '0.1.1',
      '@bombfarm/web': '0.2.0',
      '@bombfarm/ui': '0.1.0',
    };

    expect(diffVersions(before, after)).toEqual([
      {
        name: '@bombfarm/desktop',
        oldVersion: '0.1.0',
        newVersion: '0.1.1',
      },
      {
        name: '@bombfarm/web',
        oldVersion: '0.1.0',
        newVersion: '0.2.0',
      },
    ]);
  });

  it('reports added and removed packages without normalising versions', () => {
    expect(
      diffVersions(
        { '@bombfarm/ui': '0.1.0' },
        { '@bombfarm/web': '0.2.0' },
      ),
    ).toEqual([
      {
        name: '@bombfarm/ui',
        oldVersion: '0.1.0',
        newVersion: null,
      },
      {
        name: '@bombfarm/web',
        oldVersion: null,
        newVersion: '0.2.0',
      },
    ]);
  });

  it('reports non-monotonic version changes as-is', () => {
    expect(
      diffVersions(
        { '@bombfarm/web': '0.2.0' },
        { '@bombfarm/web': '0.1.0' },
      ),
    ).toEqual([
      {
        name: '@bombfarm/web',
        oldVersion: '0.2.0',
        newVersion: '0.1.0',
      },
    ]);
  });
});

describe('assessParity', () => {
  const base = {
    '@bombfarm/web': '0.1.0',
    '@bombfarm/desktop': '0.1.0',
    '@bombfarm/ui': '0.1.0',
  };

  it('returns in-sync when every package matches', () => {
    expect(assessParity(base, { ...base })).toBe('in-sync');
  });

  it('returns develop-behind when main is ahead on one package', () => {
    expect(
      assessParity(
        { '@bombfarm/web': '0.2.0' },
        { '@bombfarm/web': '0.1.0' },
      ),
    ).toBe('develop-behind');
  });

  it('returns develop-ahead when develop is ahead and main is not', () => {
    expect(
      assessParity(
        { '@bombfarm/web': '0.1.0' },
        { '@bombfarm/web': '0.2.0' },
      ),
    ).toBe('develop-ahead');
  });

  it('returns develop-behind for mixed ahead/behind package states', () => {
    expect(
      assessParity(
        {
          '@bombfarm/web': '0.2.0',
          '@bombfarm/desktop': '0.1.0',
        },
        {
          '@bombfarm/web': '0.1.0',
          '@bombfarm/desktop': '0.2.0',
        },
      ),
    ).toBe('develop-behind');
  });

  it('treats a package present only on main as develop-behind', () => {
    expect(
      assessParity(
        { '@bombfarm/web': '0.1.0' },
        {},
      ),
    ).toBe('develop-behind');
  });

  it('treats a package present only on develop as develop-ahead', () => {
    expect(
      assessParity(
        {},
        { '@bombfarm/web': '0.1.0' },
      ),
    ).toBe('develop-ahead');
  });
});
