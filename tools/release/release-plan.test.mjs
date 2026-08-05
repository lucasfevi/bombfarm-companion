import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DESKTOP_PACKAGE,
  WEB_PACKAGE,
  isEmptyReleaseSet,
  maxBumpType,
  readReleaseSet,
  resolveArtifactPlan,
  selectRequiredWorkflows,
} from './release-plan.mjs';

const fixturesDir = join(fileURLToPath(new URL('.', import.meta.url)), '__fixtures__');
const loadFixture = (name) =>
  JSON.parse(readFileSync(join(fixturesDir, name), 'utf8'));

describe('readReleaseSet', () => {
  it('returns an empty set for an empty release plan', () => {
    const set = readReleaseSet(loadFixture('release-plan-empty.json'));
    expect(set.releases).toEqual([]);
    expect(set.hasWeb).toBe(false);
    expect(set.hasDesktop).toBe(false);
    expect(set.libraries).toEqual([]);
  });

  it('reads a web-only release set', () => {
    const set = readReleaseSet(loadFixture('release-plan-web-only.json'));
    expect(set.hasWeb).toBe(true);
    expect(set.hasDesktop).toBe(false);
    expect(set.libraries).toEqual([]);
    expect(set.releases).toEqual([
      {
        name: WEB_PACKAGE,
        type: 'patch',
        oldVersion: '0.0.0',
        newVersion: '0.0.1',
        changesets: ['web-only-change'],
      },
    ]);
  });

  it('reads a desktop-only release set', () => {
    const set = readReleaseSet(loadFixture('release-plan-desktop-only.json'));
    expect(set.hasWeb).toBe(false);
    expect(set.hasDesktop).toBe(true);
    expect(set.releases[0].name).toBe(DESKTOP_PACKAGE);
  });

  it('reads a both-apps release set when ui bumps both dependents', () => {
    const set = readReleaseSet(loadFixture('release-plan-both-apps.json'));
    expect(set.hasWeb).toBe(true);
    expect(set.hasDesktop).toBe(true);
    expect(set.libraries).toEqual(['@bombfarm/ui']);
    expect(set.releases.map((release) => release.name)).toEqual([
      DESKTOP_PACKAGE,
      '@bombfarm/ui',
      WEB_PACKAGE,
    ]);
  });

  it('reads a library-only release set', () => {
    const set = readReleaseSet(loadFixture('release-plan-libs-only.json'));
    expect(set.hasWeb).toBe(false);
    expect(set.hasDesktop).toBe(false);
    expect(set.libraries).toEqual(['@bombfarm/contracts']);
    expect(set.releases).toHaveLength(1);
  });

  it('excludes releases with type none from the set', () => {
    const set = readReleaseSet(loadFixture('release-plan-libs-only.json'));
    expect(set.releases.some((release) => release.name === DESKTOP_PACKAGE)).toBe(false);
  });

  it('preserves both changeset ids and the higher bump type', () => {
    const set = readReleaseSet(loadFixture('release-plan-dual-changeset.json'));
    expect(set.releases).toEqual([
      {
        name: '@bombfarm/ui',
        type: 'minor',
        oldVersion: '0.1.0',
        newVersion: '0.2.0',
        changesets: ['ui-minor', 'ui-patch'],
      },
    ]);
  });

  it('sorts releases by package name', () => {
    const set = readReleaseSet(loadFixture('release-plan-both-apps.json'));
    const names = set.releases.map((release) => release.name);
    expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)));
  });
});

describe('isEmptyReleaseSet', () => {
  it('returns true for an empty set', () => {
    expect(isEmptyReleaseSet(readReleaseSet(loadFixture('release-plan-empty.json')))).toBe(true);
  });

  it('returns false when any package is releasing', () => {
    expect(isEmptyReleaseSet(readReleaseSet(loadFixture('release-plan-web-only.json')))).toBe(false);
  });
});

describe('resolveArtifactPlan', () => {
  it('builds the desktop installer when desktop is in the set', () => {
    const plan = resolveArtifactPlan(readReleaseSet(loadFixture('release-plan-desktop-only.json')));
    expect(plan.desktopInstaller).toEqual({
      build: true,
      reason: '@bombfarm/desktop is in the release set',
    });
  });

  it('skips the desktop installer with a reason when desktop is absent', () => {
    const plan = resolveArtifactPlan(readReleaseSet(loadFixture('release-plan-web-only.json')));
    expect(plan.desktopInstaller.build).toBe(false);
    expect(plan.desktopInstaller.reason).toContain('not in the release set');
  });

  it('marks web deploy when web is in the set', () => {
    const plan = resolveArtifactPlan(readReleaseSet(loadFixture('release-plan-web-only.json')));
    expect(plan.webProduction.deploy).toBe(true);
    expect(plan.webProduction.reason).toContain('@bombfarm/web');
  });

  it('skips web deploy with a reason for a library-only set', () => {
    const plan = resolveArtifactPlan(readReleaseSet(loadFixture('release-plan-libs-only.json')));
    expect(plan.webProduction.deploy).toBe(false);
    expect(plan.webProduction.reason).toContain('library-only');
  });
});

describe('selectRequiredWorkflows', () => {
  it('returns no workflows for an empty release set', () => {
    expect(selectRequiredWorkflows(readReleaseSet(loadFixture('release-plan-empty.json')))).toEqual([]);
  });

  it('returns all three workflows for a web-only release set', () => {
    expect(selectRequiredWorkflows(readReleaseSet(loadFixture('release-plan-web-only.json')))).toEqual([
      'ci-web.yml',
      'ci-desktop.yml',
      'e2e-web.yml',
    ]);
  });

  it('returns all three workflows for a desktop-only release set', () => {
    expect(selectRequiredWorkflows(readReleaseSet(loadFixture('release-plan-desktop-only.json')))).toEqual([
      'ci-web.yml',
      'ci-desktop.yml',
      'e2e-web.yml',
    ]);
  });
});

describe('maxBumpType', () => {
  it('prefers the higher bump kind', () => {
    expect(maxBumpType('patch', 'minor')).toBe('minor');
    expect(maxBumpType('major', 'minor')).toBe('major');
  });
});
