import semver from 'semver';
import { describe, expect, it } from 'vitest';
import {
  LEGACY_TAG_PREFIX,
  buildBetaVersion,
  buildDesktopTag,
  channelFromDesktopTag,
  isUpdaterReadableTag,
  nightlyPartsFromTag,
  versionFromDesktopTag,
} from './release-tag.mjs';

describe('the property every desktop tag exists to satisfy', () => {
  // electron-updater's GitHub provider pulls each tag out of its /tag/<tag> href and skips every
  // entry `semver.valid()` rejects. A tag it cannot parse is a release the app cannot find, and
  // nothing on the publishing side reports it. These two cases are the whole reason for the
  // 2026-08-29 prefix change.
  it('accepts a bare v prefix', () => {
    expect(semver.valid('v0.5.1-beta.150')).toBe('0.5.1-beta.150');
    expect(isUpdaterReadableTag(buildDesktopTag('0.5.1-beta.150'))).toBe(true);
  });

  it('rejects the prefix this rail used before, which is why it changed', () => {
    expect(semver.valid(`${LEGACY_TAG_PREFIX}0.5.1-beta.150`)).toBeNull();
    expect(isUpdaterReadableTag(`${LEGACY_TAG_PREFIX}0.5.1-beta.150`)).toBe(false);
  });
});

describe('buildDesktopTag', () => {
  it.each(['0.5.1', '0.5.1-beta.150', '1.0.0-nightly.20260829.abcdef1'])('tags %s', (version) => {
    expect(buildDesktopTag(version)).toBe(`v${version}`);
    expect(isUpdaterReadableTag(buildDesktopTag(version))).toBe(true);
  });

  it('refuses a non-semver version rather than emitting an unreadable tag', () => {
    expect(() => buildDesktopTag('0.5')).toThrow(/not valid semver/);
    expect(() => buildDesktopTag('desktop-v0.5.1')).toThrow(/not valid semver/);
  });

  it('refuses a version that already carries the prefix, so no tag is ever doubled', () => {
    expect(() => buildDesktopTag('v0.5.1')).toThrow(/already carries/);
  });
});

describe('versionFromDesktopTag', () => {
  it('reads a current tag', () => {
    expect(versionFromDesktopTag('v0.5.1-beta.150')).toBe('0.5.1-beta.150');
  });

  it('still reads tags published under the old prefix, so retention keeps working over them', () => {
    expect(versionFromDesktopTag('desktop-v0.5.1-beta.149')).toBe('0.5.1-beta.149');
  });

  it('returns null for anything that is not a desktop release tag', () => {
    expect(versionFromDesktopTag('market-prices')).toBeNull();
    expect(versionFromDesktopTag('v')).toBeNull();
    expect(versionFromDesktopTag('vNext')).toBeNull();
  });
});

describe('channelFromDesktopTag', () => {
  it.each([
    ['v0.5.1', null],
    ['v0.5.1-beta.150', 'beta'],
    ['v0.5.1-nightly.20260829.abcdef1', 'nightly'],
    ['desktop-v0.5.1-beta.149', 'beta'],
    ['market-prices', null],
  ])('reads %s as %s', (tag, channel) => {
    expect(channelFromDesktopTag(tag)).toBe(channel);
  });
});

describe('nightlyPartsFromTag', () => {
  it('reads the date and sha off a nightly this rail produced', () => {
    expect(nightlyPartsFromTag('v1.2.3-nightly.20260829.abcdef1')).toEqual({
      date: '20260829',
      sha7: 'abcdef1',
    });
  });

  it('is strict about the shape, so a hand-cut nightly tag is never pruned as one of ours', () => {
    expect(nightlyPartsFromTag('v1.0.0-nightly')).toBeNull();
    expect(nightlyPartsFromTag('v1.0.0-nightly.20260829')).toBeNull();
  });

  it('never reads a beta as a nightly', () => {
    expect(nightlyPartsFromTag('v0.5.1-beta.150')).toBeNull();
  });
});

describe('buildBetaVersion', () => {
  it('stamps the run number so consecutive betas of one release differ', () => {
    expect(buildBetaVersion({ baseVersion: '0.5.1', runNumber: 150 })).toBe('0.5.1-beta.150');
    expect(buildBetaVersion({ baseVersion: '0.5.1', runNumber: '151' })).toBe('0.5.1-beta.151');
  });

  // The defect this replaced: every beta shipped as the bare package.json version, so no two
  // ever compared as newer and the app could not tell them apart.
  it('orders consecutive runs as increasing versions', () => {
    const earlier = buildBetaVersion({ baseVersion: '0.5.1', runNumber: 150 });
    const later = buildBetaVersion({ baseVersion: '0.5.1', runNumber: 151 });
    expect(semver.gt(later, earlier)).toBe(true);
  });

  // The second half of the same defect: a stable currentVersion makes electron-updater set
  // allowPrerelease=false, which sends it to GitHub's releases/latest — an endpoint that
  // excludes prereleases, i.e. every desktop release this repo has.
  it('produces a prerelease version, which is what puts the app on the prerelease path', () => {
    expect(semver.prerelease(buildBetaVersion({ baseVersion: '0.5.1', runNumber: 150 }))).toEqual(['beta', 150]);
    expect(semver.prerelease('0.5.1')).toBeNull();
  });

  it('refuses a base version that is already a prerelease', () => {
    expect(() => buildBetaVersion({ baseVersion: '0.5.1-beta.1', runNumber: 2 })).toThrow(
      /already carries a prerelease/,
    );
  });

  it('refuses a run number that is not a positive integer', () => {
    expect(() => buildBetaVersion({ baseVersion: '0.5.1', runNumber: 'abc' })).toThrow(/positive integer/);
    expect(() => buildBetaVersion({ baseVersion: '0.5.1', runNumber: '' })).toThrow(/positive integer/);
  });

  it('refuses a non-semver base version', () => {
    expect(() => buildBetaVersion({ baseVersion: '0.5', runNumber: 1 })).toThrow(/not valid semver/);
  });
});
