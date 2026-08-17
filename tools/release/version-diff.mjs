import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @typedef {Record<string, string>} VersionMap
 * @typedef {'in-sync' | 'develop-behind' | 'develop-ahead'} ParityState
 */

/**
 * @param {string} rootDir
 * @returns {VersionMap}
 */
export function readWorkspaceVersions(rootDir) {
  const workspaceFile = join(rootDir, 'pnpm-workspace.yaml');
  const workspaceYaml = readFileSync(workspaceFile, 'utf8');
  const globs = [];

  for (const line of workspaceYaml.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^-\s+(.+)$/);
    if (match) {
      globs.push(match[1].trim());
    }
  }

  /** @type {VersionMap} */
  const versions = {};

  for (const pattern of globs) {
    const starIndex = pattern.indexOf('/*');
    if (starIndex === -1) {
      continue;
    }
    const parent = join(rootDir, pattern.slice(0, starIndex));
    for (const child of readdirSync(parent, { withFileTypes: true })) {
      if (!child.isDirectory()) {
        continue;
      }
      const manifestPath = join(parent, child.name, 'package.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (manifest.name && typeof manifest.version === 'string') {
        versions[manifest.name] = manifest.version;
      }
    }
  }

  return versions;
}

/**
 * @param {VersionMap} before
 * @param {VersionMap} after
 * @returns {{ name: string, oldVersion: string | null, newVersion: string | null }[]}
 */
export function diffVersions(before, after) {
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diffs = [];

  for (const name of [...names].sort((a, b) => a.localeCompare(b))) {
    const oldVersion = before[name] ?? null;
    const newVersion = after[name] ?? null;

    if (oldVersion === newVersion) {
      continue;
    }

    diffs.push({ name, oldVersion, newVersion });
  }

  return diffs;
}

/**
 * @param {VersionMap} mainVersions
 * @param {VersionMap} developVersions
 * @returns {ParityState}
 */
export function assessParity(mainVersions, developVersions) {
  const names = new Set([
    ...Object.keys(mainVersions),
    ...Object.keys(developVersions),
  ]);

  let mainAhead = false;
  let developAhead = false;

  for (const name of names) {
    const mainVersion = mainVersions[name];
    const developVersion = developVersions[name];

    if (mainVersion === undefined || developVersion === undefined) {
      if (mainVersion !== undefined) {
        mainAhead = true;
      }
      if (developVersion !== undefined) {
        developAhead = true;
      }
      continue;
    }

    const comparison = compareVersions(mainVersion, developVersion);
    if (comparison > 0) {
      mainAhead = true;
    } else if (comparison < 0) {
      developAhead = true;
    }
  }

  if (mainAhead) {
    return 'develop-behind';
  }
  if (developAhead) {
    return 'develop-ahead';
  }
  return 'in-sync';
}

/**
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);

  if (leftParts === null || rightParts === null) {
    return left.localeCompare(right);
  }

  for (let index = 0; index < 3; index += 1) {
    if (leftParts.core[index] !== rightParts.core[index]) {
      return leftParts.core[index] - rightParts.core[index];
    }
  }

  if (leftParts.prerelease.length === 0 && rightParts.prerelease.length === 0) {
    return 0;
  }
  if (leftParts.prerelease.length === 0) {
    return 1;
  }
  if (rightParts.prerelease.length === 0) {
    return -1;
  }

  const maxLength = Math.max(leftParts.prerelease.length, rightParts.prerelease.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts.prerelease[index];
    const rightPart = rightParts.prerelease[index];

    if (leftPart === undefined) {
      return -1;
    }
    if (rightPart === undefined) {
      return 1;
    }

    const leftNumber = Number(leftPart);
    const rightNumber = Number(rightPart);
    const leftIsNumber = !Number.isNaN(leftNumber) && String(leftNumber) === leftPart;
    const rightIsNumber = !Number.isNaN(rightNumber) && String(rightNumber) === rightPart;

    if (leftIsNumber && rightIsNumber) {
      if (leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }
      continue;
    }

    const partComparison = leftPart.localeCompare(rightPart);
    if (partComparison !== 0) {
      return partComparison;
    }
  }

  return 0;
}

/**
 * @param {string} version
 * @returns {{ core: [number, number, number], prerelease: string[] } | null}
 */
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    return null;
  }

  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ? match[4].split('.') : [],
  };
}
