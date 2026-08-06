/**
 * @param {{ baseVersion: string, date: Date, commitSha: string }} options
 * @returns {string}
 */
export function buildNightlyVersion({ baseVersion, date, commitSha }) {
  const parsed = parseSemver(baseVersion);
  if (parsed === null) {
    throw new Error(`baseVersion "${baseVersion}" is not valid semver`);
  }
  if (parsed.prerelease.length > 0) {
    throw new Error(`baseVersion "${baseVersion}" already carries a prerelease suffix`);
  }

  const sha7 = commitSha.trim().slice(0, 7);
  if (sha7.length === 0) {
    throw new Error('commitSha must contain at least one character');
  }

  const yyyymmdd = formatUtcDate(date);
  const nightlyVersion = `${baseVersion}-nightly.${yyyymmdd}.${sha7}`;

  if (parseSemver(nightlyVersion) === null) {
    throw new Error(`derived nightly version "${nightlyVersion}" is not valid semver`);
  }

  return nightlyVersion;
}

/**
 * @param {string} version
 * @returns {string}
 */
export function buildNightlyTag(version) {
  return `desktop-v${version}`;
}

/**
 * @param {string} version
 * @returns {{ major: number, minor: number, patch: number, prerelease: string[] } | null}
 */
function parseSemver(version) {
  const match = version.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/,
  );
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

/**
 * @param {Date} date
 * @returns {string}
 */
function formatUtcDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}
