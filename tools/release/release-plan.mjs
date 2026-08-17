export const WEB_PACKAGE = '@bombfarm/web';
export const DESKTOP_PACKAGE = '@bombfarm/desktop';

const REQUIRED_WORKFLOWS = ['ci-web.yml', 'ci-desktop.yml', 'e2e-web.yml'];

/**
 * @typedef {'major' | 'minor' | 'patch' | 'none'} BumpType
 */

/**
 * @typedef {{
 *   name: string,
 *   type: BumpType,
 *   oldVersion: string,
 *   newVersion: string,
 *   changesets: string[],
 * }} ChangesetRelease
 */

/**
 * @typedef {{
 *   releases: ChangesetRelease[],
 *   hasWeb: boolean,
 *   hasDesktop: boolean,
 *   libraries: string[],
 * }} ReleaseSet
 */

/**
 * @typedef {{
 *   desktopInstaller: { build: boolean, reason: string },
 *   webProduction: { deploy: boolean, reason: string },
 * }} ArtifactPlan
 */

/**
 * @param {unknown} releasePlanJson
 * @returns {ReleaseSet}
 */
export function readReleaseSet(releasePlanJson) {
  const plan = typeof releasePlanJson === 'string'
    ? JSON.parse(releasePlanJson)
    : releasePlanJson;

  const releases = (plan.releases ?? [])
    .filter((release) => release.type !== 'none')
    .map((release) => ({
      ...release,
      changesets: [...(release.changesets ?? [])].sort(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const hasWeb = releases.some((release) => release.name === WEB_PACKAGE);
  const hasDesktop = releases.some((release) => release.name === DESKTOP_PACKAGE);
  const libraries = releases
    .filter((release) => release.name !== WEB_PACKAGE && release.name !== DESKTOP_PACKAGE)
    .map((release) => release.name);

  return {
    releases,
    hasWeb,
    hasDesktop,
    libraries,
  };
}

/**
 * @param {ReleaseSet} set
 * @returns {boolean}
 */
export function isEmptyReleaseSet(set) {
  return set.releases.length === 0;
}

/**
 * @param {ReleaseSet} set
 * @returns {ArtifactPlan}
 */
export function resolveArtifactPlan(set) {
  if (set.hasDesktop) {
    return {
      desktopInstaller: {
        build: true,
        reason: '@bombfarm/desktop is in the release set',
      },
      webProduction: set.hasWeb
        ? {
            deploy: true,
            reason: '@bombfarm/web is in the release set',
          }
        : {
            deploy: false,
            reason: '@bombfarm/web is not in the release set — Vercel deploys from main only when web changes ship',
          },
    };
  }

  return {
    desktopInstaller: {
      build: false,
      reason: '@bombfarm/desktop is not in the release set — no desktop changes in this release',
    },
    webProduction: set.hasWeb
      ? {
          deploy: true,
          reason: '@bombfarm/web is in the release set',
        }
      : {
          deploy: false,
          reason: '@bombfarm/web is not in the release set — library-only release with no app deploy',
        },
  };
}

/**
 * @param {ReleaseSet} set
 * @returns {string[]}
 */
export function selectRequiredWorkflows(set) {
  if (isEmptyReleaseSet(set)) {
    return [];
  }

  return [...REQUIRED_WORKFLOWS];
}

const BUMP_RANK = {
  major: 3,
  minor: 2,
  patch: 1,
  none: 0,
};

/**
 * @param {'major' | 'minor' | 'patch' | 'none'} left
 * @param {'major' | 'minor' | 'patch' | 'none'} right
 * @returns {'major' | 'minor' | 'patch' | 'none'}
 */
export function maxBumpType(left, right) {
  return BUMP_RANK[left] >= BUMP_RANK[right] ? left : right;
}
