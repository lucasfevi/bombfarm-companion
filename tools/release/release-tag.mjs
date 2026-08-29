import semver from 'semver';

/**
 * The one place a desktop release tag is built or read.
 *
 * **The tag is an interface, not a label.** `electron-updater`'s GitHub provider reads the
 * releases Atom feed, pulls each entry's tag out of its `/tag/<tag>` href, and discards every
 * entry whose tag `semver.valid()` rejects. `semver.valid()` tolerates exactly one prefix — a
 * bare `v` — so `v1.2.3-beta.4` parses and anything else (`desktop-v1.2.3-beta.4`) does not.
 * A tag the updater cannot parse is a release the app cannot find, with no error on the
 * publishing side to say so.
 *
 * That is why this module exists rather than three workflows each interpolating their own
 * string: the format is load-bearing, and `release-tag-workflows.test.mjs` asserts no workflow
 * builds one by hand.
 */
const TAG_PREFIX = 'v';

/**
 * The prefix desktop tags used before 2026-08-29. Still *readable*, so retention and lookups keep
 * working over releases published under it; never written.
 */
const LEGACY_TAG_PREFIX = 'desktop-v';

/**
 * @param {string} version
 * @returns {string}
 */
export function buildDesktopTag(version) {
  if (semver.valid(version) === null) {
    throw new Error(`version "${version}" is not valid semver, so its tag would be unreadable to the updater`);
  }
  if (version.startsWith(TAG_PREFIX)) {
    throw new Error(`version "${version}" already carries a "${TAG_PREFIX}" prefix`);
  }
  return `${TAG_PREFIX}${version}`;
}

/**
 * @param {string} tag
 * @returns {string | null} the semver version, or `null` when the tag is not a desktop release tag
 */
export function versionFromDesktopTag(tag) {
  for (const prefix of [TAG_PREFIX, LEGACY_TAG_PREFIX]) {
    if (!tag.startsWith(prefix)) {
      continue;
    }
    const candidate = tag.slice(prefix.length);
    const parsed = semver.valid(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

/**
 * Whether `electron-updater` would keep this tag when walking the releases feed. The check is
 * delegated to the same library the updater uses rather than restated as a regex, so the guard
 * cannot drift away from the behaviour it is protecting.
 *
 * @param {string} tag
 * @returns {boolean}
 */
export function isUpdaterReadableTag(tag) {
  return semver.valid(tag) !== null;
}

/**
 * @param {string} tag
 * @returns {string | null} the first prerelease identifier (`beta`, `nightly`), or `null` for a stable tag
 */
export function channelFromDesktopTag(tag) {
  const version = versionFromDesktopTag(tag);
  if (version === null) {
    return null;
  }
  const prerelease = semver.prerelease(version);
  return prerelease === null ? null : String(prerelease[0]);
}

/**
 * The `<yyyymmdd>.<sha7>` a nightly version carries, or `null` for anything that is not one.
 *
 * Deliberately stricter than "the channel is nightly": it requires the full shape
 * `buildNightlyVersion` produces, so a hand-cut `v1.0.0-nightly` is not mistaken for a build this
 * rail made and is never pruned by retention.
 *
 * @param {string} tag
 * @returns {{ date: string, sha7: string } | null}
 */
export function nightlyPartsFromTag(tag) {
  const version = versionFromDesktopTag(tag);
  if (version === null) {
    return null;
  }
  const prerelease = semver.prerelease(version);
  if (prerelease === null || prerelease.length < 3) {
    return null;
  }
  const [channel, date, sha7] = prerelease.map(String);
  if (channel !== 'nightly') {
    return null;
  }
  return { date, sha7 };
}

/**
 * A beta build's version, distinct per run.
 *
 * Beta installers used to carry the bare `package.json` version, so every beta of one release
 * shipped as the same version: nothing ever compared as newer, and `electron-updater` read a
 * stable version as "this user is not on a prerelease channel" and looked only at GitHub's
 * `releases/latest` — which excludes prereleases, i.e. every desktop release there has ever been.
 * Stamping the run number fixes both halves at once.
 *
 * @param {{ baseVersion: string, runNumber: number | string }} options
 * @returns {string}
 */
export function buildBetaVersion({ baseVersion, runNumber }) {
  if (semver.valid(baseVersion) === null) {
    throw new Error(`baseVersion "${baseVersion}" is not valid semver`);
  }
  if (semver.prerelease(baseVersion) !== null) {
    throw new Error(`baseVersion "${baseVersion}" already carries a prerelease suffix`);
  }

  const run = String(runNumber).trim();
  if (!/^\d+$/.test(run)) {
    throw new Error(`runNumber "${runNumber}" must be a positive integer`);
  }

  const betaVersion = `${baseVersion}-beta.${run}`;
  if (semver.valid(betaVersion) === null) {
    throw new Error(`derived beta version "${betaVersion}" is not valid semver`);
  }
  return betaVersion;
}

export { TAG_PREFIX, LEGACY_TAG_PREFIX };
