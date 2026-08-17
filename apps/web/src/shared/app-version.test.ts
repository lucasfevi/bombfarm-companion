import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getAppVersionLabel, resolveVersionLabel } from './app-version';

const webPackage = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8'),
) as { version: string };

describe('resolveVersionLabel', () => {
  it('returns v<semver> for production', () => {
    expect(
      resolveVersionLabel({
        version: '1.2.3',
        isProduction: true,
        commitSha: 'abcdef1234567',
      }),
    ).toBe('v1.2.3');
  });

  it('returns v<semver>-dev.<sha7> for preview', () => {
    expect(
      resolveVersionLabel({
        version: '0.0.0',
        isProduction: false,
        commitSha: 'abcdef1234567',
      }),
    ).toBe('v0.0.0-dev.abcdef1');
  });

  it('falls back to -dev.local when no SHA is available', () => {
    expect(
      resolveVersionLabel({
        version: '0.0.0',
        isProduction: false,
      }),
    ).toBe('v0.0.0-dev.local');
  });

  it('honours override before production or preview rules', () => {
    expect(
      resolveVersionLabel({
        version: '1.0.0',
        isProduction: true,
        commitSha: 'abcdef1',
        override: 'v0.0.0-e2e',
      }),
    ).toBe('v0.0.0-e2e');
  });

  it('preserves long semver strings in the label', () => {
    expect(
      resolveVersionLabel({
        version: '0.10.0',
        isProduction: false,
        commitSha: 'abcdef1',
      }),
    ).toBe('v0.10.0-dev.abcdef1');
  });

  it('tracks package.json version bumps without other edits (REL-25)', () => {
    const label = resolveVersionLabel({
      version: webPackage.version,
      isProduction: true,
    });
    expect(label).toBe(`v${webPackage.version}`);
    expect(label).toMatch(/^v\d+\.\d+\.\d+/);
  });
});

describe('getAppVersionLabel', () => {
  it('reads inlined NEXT_PUBLIC_* env at build time', () => {
    const env = process.env;
    process.env = {
      ...env,
      NEXT_PUBLIC_APP_VERSION: '0.1.0',
      NEXT_PUBLIC_APP_IS_PRODUCTION: 'false',
      NEXT_PUBLIC_APP_COMMIT_SHA: 'deadbeef',
      NEXT_PUBLIC_APP_VERSION_LABEL_OVERRIDE: '',
    };
    try {
      expect(getAppVersionLabel()).toBe('v0.1.0-dev.deadbee');
    } finally {
      process.env = env;
    }
  });

  it('honours NEXT_PUBLIC_APP_VERSION_LABEL_OVERRIDE', () => {
    const env = process.env;
    process.env = {
      ...env,
      NEXT_PUBLIC_APP_VERSION: '0.0.0',
      NEXT_PUBLIC_APP_IS_PRODUCTION: 'true',
      NEXT_PUBLIC_APP_VERSION_LABEL_OVERRIDE: 'v0.0.0-e2e',
    };
    try {
      expect(getAppVersionLabel()).toBe('v0.0.0-e2e');
    } finally {
      process.env = env;
    }
  });
});
