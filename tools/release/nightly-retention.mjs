const NIGHTLY_TAG_PREFIX = 'desktop-v';
const NIGHTLY_MARKER = '-nightly.';

/**
 * @typedef {{ tag: string, createdAt: string | Date }} ReleaseRecord
 */

/**
 * @param {ReleaseRecord[]} releases
 * @param {number} [keep]
 * @returns {string[]}
 */
export function selectNightlyReleasesToPrune(releases, keep = 7) {
  const nightlyReleases = releases
    .filter((release) => isNightlyPrereleaseTag(release.tag))
    .sort((left, right) => {
      const rightTime = toTimestamp(right.createdAt);
      const leftTime = toTimestamp(left.createdAt);
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return right.tag.localeCompare(left.tag);
    });

  if (nightlyReleases.length <= keep) {
    return [];
  }

  return nightlyReleases.slice(keep).map((release) => release.tag);
}

/**
 * @param {string} tag
 * @returns {boolean}
 */
function isNightlyPrereleaseTag(tag) {
  if (!tag.startsWith(NIGHTLY_TAG_PREFIX)) {
    return false;
  }

  const version = tag.slice(NIGHTLY_TAG_PREFIX.length);
  if (!version.includes(NIGHTLY_MARKER)) {
    return false;
  }

  if (version.includes('-beta.')) {
    return false;
  }

  const prereleaseIndex = version.indexOf('-');
  if (prereleaseIndex === -1) {
    return false;
  }

  const prerelease = version.slice(prereleaseIndex + 1);
  return prerelease.startsWith('nightly.');
}

/**
 * @param {string | Date} createdAt
 * @returns {number}
 */
function toTimestamp(createdAt) {
  const value = createdAt instanceof Date ? createdAt : new Date(createdAt);
  return value.getTime();
}
