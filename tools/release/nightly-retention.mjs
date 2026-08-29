import { nightlyPartsFromTag } from './release-tag.mjs';

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
 * Reads the parsed version rather than matching tag substrings, so a beta tag can never be
 * mistaken for a nightly one — and so tags still carrying the pre-2026-08-29 prefix stay prunable
 * (`versionFromDesktopTag` reads both).
 *
 * @param {string} tag
 * @returns {boolean}
 */
function isNightlyPrereleaseTag(tag) {
  return nightlyPartsFromTag(tag) !== null;
}

/**
 * @param {string | Date} createdAt
 * @returns {number}
 */
function toTimestamp(createdAt) {
  const value = createdAt instanceof Date ? createdAt : new Date(createdAt);
  return value.getTime();
}
