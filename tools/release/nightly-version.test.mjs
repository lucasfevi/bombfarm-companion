import { describe, expect, it } from 'vitest';
import { buildNightlyTag, buildNightlyVersion } from './nightly-version.mjs';

describe('buildNightlyVersion', () => {
  it('builds a nightly version from 0.0.0', () => {
    expect(
      buildNightlyVersion({
        baseVersion: '0.0.0',
        date: new Date('2025-08-05T12:34:56.000Z'),
        commitSha: 'abcdef1234567890',
      }),
    ).toBe('0.0.0-nightly.20250805.abcdef1');
  });

  it('uses the first seven characters of the commit SHA', () => {
    expect(
      buildNightlyVersion({
        baseVersion: '1.4.2',
        date: new Date('2025-01-02T00:00:00.000Z'),
        commitSha: 'abc',
      }),
    ).toBe('1.4.2-nightly.20250102.abc');
  });

  it('formats the UTC date at the day boundary', () => {
    expect(
      buildNightlyVersion({
        baseVersion: '1.0.0',
        date: new Date('2025-12-31T23:59:59.000Z'),
        commitSha: '1234567',
      }),
    ).toBe('1.0.0-nightly.20251231.1234567');
  });

  it('rejects a base version that already has a prerelease suffix', () => {
    expect(() =>
      buildNightlyVersion({
        baseVersion: '1.0.0-beta.1',
        date: new Date('2025-08-05T00:00:00.000Z'),
        commitSha: 'abcdef1',
      }),
    ).toThrow(/already carries a prerelease suffix/);
  });

  it('rejects an invalid base version', () => {
    expect(() =>
      buildNightlyVersion({
        baseVersion: 'not-semver',
        date: new Date('2025-08-05T00:00:00.000Z'),
        commitSha: 'abcdef1',
      }),
    ).toThrow(/not valid semver/);
  });

  it('rejects an empty commit SHA', () => {
    expect(() =>
      buildNightlyVersion({
        baseVersion: '1.0.0',
        date: new Date('2025-08-05T00:00:00.000Z'),
        commitSha: '   ',
      }),
    ).toThrow(/commitSha must contain at least one character/);
  });
});

describe('buildNightlyTag', () => {
  it('prefixes the desktop tag with desktop-v', () => {
    expect(buildNightlyTag('0.0.0-nightly.20250805.abcdef1')).toBe(
      'desktop-v0.0.0-nightly.20250805.abcdef1',
    );
  });
});
