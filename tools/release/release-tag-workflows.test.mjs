import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));

const WORKFLOWS = {
  'release-pr.yml': join(root, '.github/workflows/release-pr.yml'),
  'release-prod.yml': join(root, '.github/workflows/release-prod.yml'),
};

/**
 * The publishing side of the updater contract, guarded as workflow *text*.
 *
 * A tag `semver.valid()` rejects is a release `electron-updater` silently skips — the publish
 * succeeds, the release appears on GitHub, and no installed app ever sees it. Nothing in a
 * release run can notice that, so it is asserted here instead.
 *
 * Every predicate below is proved capable of failing: each is checked `true` against the real
 * file and `false` against a mutation of that same text, never a hand-written fixture that could
 * drift from the file it claims to describe.
 */
function stripCommentLines(text) {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

/** A tag interpolated inline from a shell/YAML expression instead of built by the shared helper. */
function buildsTagByHand(text) {
  return /tag\s*=\s*["'][^"'\n]*\$\{/i.test(stripCommentLines(text)) || /desktop-v\$\{/.test(stripCommentLines(text));
}

function usesSharedTagBuilder(text) {
  return /buildDesktopTag/.test(stripCommentLines(text));
}

function stampsVersionIntoBuild(text) {
  return /BFC_VERSION_OVERRIDE:/.test(stripCommentLines(text));
}

describe('no release workflow builds a tag by hand', () => {
  for (const [name, path] of Object.entries(WORKFLOWS)) {
    const text = readFileSync(path, 'utf8');

    it(`${name} reaches the shared tag builder`, () => {
      expect(usesSharedTagBuilder(text)).toBe(true);
    });

    it(`${name} interpolates no tag of its own`, () => {
      expect(buildsTagByHand(text)).toBe(false);
    });

    it(`${name}: the by-hand predicate is capable of failing`, () => {
      expect(buildsTagByHand(`${text}\n          tag="desktop-v\${VERSION}"\n`)).toBe(true);
    });

    it(`${name}: the shared-builder predicate is capable of failing`, () => {
      const withoutBuilder = text.replaceAll('buildDesktopTag', 'x');
      expect(usesSharedTagBuilder(withoutBuilder)).toBe(false);
    });
  }
});

describe('every published desktop build carries a version distinct from its neighbours', () => {
  // A build packaged without BFC_VERSION_OVERRIDE ships the bare package.json version, so every
  // build of one release is byte-identical in version and nothing ever compares as newer. Prod is
  // exempt: its version genuinely is the package.json one, bumped by changesets per release.
  for (const name of ['release-pr.yml']) {
    const text = readFileSync(WORKFLOWS[name], 'utf8');

    it(`${name} stamps the packaged version`, () => {
      expect(stampsVersionIntoBuild(text)).toBe(true);
    });

    it(`${name}: the stamp predicate is capable of failing`, () => {
      expect(stampsVersionIntoBuild(text.replaceAll('BFC_VERSION_OVERRIDE:', 'SOMETHING_ELSE:'))).toBe(false);
    });
  }

  it('release-pr.yml resolves the version before packaging, or the stamp reaches nothing', () => {
    const text = stripCommentLines(readFileSync(WORKFLOWS['release-pr.yml'], 'utf8'));
    const resolveAt = text.indexOf('name: Resolve beta version');
    const packageAt = text.indexOf('name: Package beta installer');
    expect(resolveAt).toBeGreaterThan(-1);
    expect(packageAt).toBeGreaterThan(-1);
    expect(resolveAt).toBeLessThan(packageAt);
  });
});
