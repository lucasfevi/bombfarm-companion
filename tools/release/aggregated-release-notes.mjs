import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPackages } from '@manypkg/get-packages';
import { extractChangelogSection } from './changelog-section.mjs';

/**
 * @typedef {{ name: string, oldVersion: string | null, newVersion: string | null }} VersionDiff
 */

const DESKTOP_PACKAGE_NAME = '@bombfarm/desktop';

export const ANTIVIRUS_NOTICE =
  "> **Antivirus notice.** Your antivirus may flag or quarantine this build. The desktop companion attaches to the running Bomb Farm client to read the data that client is already exchanging with the game's server, and attaching to another running program is the technique behavior-based detection is built to look for. The warning is about that technique, not about a virus.";

/**
 * @param {VersionDiff} diff
 * @returns {boolean}
 */
function isReleased(diff) {
  return Boolean(diff.newVersion) && diff.oldVersion !== diff.newVersion;
}

/**
 * @param {VersionDiff[]} diffs
 * @param {string} rootDir
 * @returns {string}
 */
export async function buildAggregatedReleaseNotes(diffs, rootDir) {
  const { packages } = await getPackages(rootDir);
  const packageByName = new Map(
    packages.map((pkg) => [pkg.packageJson.name, pkg]),
  );

  const sections = [];

  const desktopDiff = diffs.find((diff) => diff.name === DESKTOP_PACKAGE_NAME);
  if (desktopDiff && isReleased(desktopDiff)) {
    sections.push(ANTIVIRUS_NOTICE);
  }

  for (const diff of [...diffs].sort((left, right) => left.name.localeCompare(right.name))) {
    if (!isReleased(diff)) {
      continue;
    }

    const pkg = packageByName.get(diff.name);
    if (!pkg) {
      sections.push(`## ${diff.name}\n\n_Changelog unavailable — package directory not found._`);
      continue;
    }

    const changelogPath = join(pkg.dir, 'CHANGELOG.md');
    if (!existsSync(changelogPath)) {
      sections.push(
        `## ${diff.name}\n\n_No CHANGELOG.md for ${diff.oldVersion ?? 'unknown'} → ${diff.newVersion}._`,
      );
      continue;
    }

    const changelog = readFileSync(changelogPath, 'utf8');
    const body = extractChangelogSection(changelog, diff.newVersion);
    if (body === null) {
      sections.push(
        `## ${diff.name}\n\n_No changelog section for version ${diff.newVersion}._`,
      );
      continue;
    }

    sections.push(`## ${diff.name}\n\n${body}`);
  }

  return sections.join('\n\n');
}
