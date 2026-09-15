import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPackages } from '@manypkg/get-packages';
import { extractChangelogSection } from './changelog-section.mjs';

/**
 * @typedef {{ name: string, oldVersion: string | null, newVersion: string | null }} VersionDiff
 */

const DESKTOP_PACKAGE_NAME = '@bombfarm/desktop';

export const ANTIVIRUS_NOTICE =
  "> **Antivirus notice.** Your antivirus may flag or quarantine this build. The desktop companion attaches to the running Bomb Farm client to read the data that client is already exchanging with the game's server, and attaching to another running program is the technique behavior-based detection looks for. The warning is about that technique, not about a virus.";

// GitHub rejects a release whose body is longer than this with HTTP 422 "body is too long".
export const GITHUB_RELEASE_BODY_LIMIT = 125_000;

export const TRUNCATION_NOTICE =
  "_Truncated to fit GitHub's release-body limit. The full notes are in each released package's CHANGELOG.md at this tag._";

/**
 * @param {VersionDiff} diff
 * @returns {boolean}
 */
function isReleased(diff) {
  return Boolean(diff.newVersion) && diff.oldVersion !== diff.newVersion;
}

/**
 * @typedef {{ kind: 'heading' | 'bullet' | 'other', lines: string[] }} ChangelogBlock
 */

/**
 * A changelog section is `### <Bump> Changes` headings over top-level bullets whose
 * continuation lines are indented. Each block keeps its own trailing blank lines, so joining
 * the kept blocks with newlines reproduces the original layout.
 *
 * @param {string} body
 * @returns {ChangelogBlock[]}
 */
function splitChangelogBlocks(body) {
  /** @type {ChangelogBlock[]} */
  const blocks = [];
  for (const line of body.split('\n')) {
    const kind = line.startsWith('### ')
      ? 'heading'
      : line.startsWith('- ')
        ? 'bullet'
        : line.trim() !== '' && !/^\s/.test(line)
          ? 'other'
          : null;
    const last = blocks[blocks.length - 1];
    if (kind === null && last) {
      last.lines.push(line);
    } else {
      blocks.push({ kind: kind ?? 'other', lines: [line] });
    }
  }
  return blocks;
}

/**
 * Changesets copies one changeset's prose into every package it touches, so the same entry
 * recurs under every package section. Its identity is that prose, not the commit hash in front
 * of it. `Updated dependencies` bullets are per-package bookkeeping and have no identity.
 *
 * @param {ChangelogBlock} block
 * @returns {string | null}
 */
function changeEntryKey(block) {
  const match = /^- [0-9a-f]{7,}: ([\s\S]*)$/.exec(block.lines.join('\n'));
  return match ? match[1].replace(/\s+/g, ' ').trim() : null;
}

/**
 * @param {ChangelogBlock[]} blocks
 * @returns {ChangelogBlock[]}
 */
function dropHeadingsWithoutBullets(blocks) {
  return blocks.filter((block, index) => {
    if (block.kind !== 'heading') {
      return true;
    }
    for (const later of blocks.slice(index + 1)) {
      if (later.kind === 'heading') {
        return false;
      }
      if (later.kind === 'bullet') {
        return true;
      }
    }
    return false;
  });
}

/**
 * @param {string} body
 * @param {Set<string>} seenEntries
 * @returns {{ body: string, dropped: number }}
 */
function dedupeChangelogSection(body, seenEntries) {
  let dropped = 0;
  const kept = splitChangelogBlocks(body).filter((block) => {
    const key = block.kind === 'bullet' ? changeEntryKey(block) : null;
    if (key === null) {
      return true;
    }
    if (seenEntries.has(key)) {
      dropped += 1;
      return false;
    }
    seenEntries.add(key);
    return true;
  });

  const joined = dropHeadingsWithoutBullets(kept)
    .flatMap((block) => block.lines)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { body: joined, dropped };
}

/**
 * @param {number} dropped
 * @returns {string}
 */
function sharedEntriesNote(dropped) {
  const noun = dropped === 1 ? 'change' : 'changes';
  return `_Also carries ${dropped} ${noun} listed under an earlier package._`;
}

/**
 * @param {string} notes
 * @param {number} [limit]
 * @returns {string}
 */
export function fitGitHubReleaseBody(notes, limit = GITHUB_RELEASE_BODY_LIMIT) {
  if (notes.length <= limit) {
    return notes;
  }

  const head = notes.slice(0, limit - TRUNCATION_NOTICE.length - 2);
  const cut = Math.max(
    head.lastIndexOf('\n- '),
    head.lastIndexOf('\n## '),
    head.lastIndexOf('\n### '),
  );
  const kept = (cut > 0 ? head.slice(0, cut) : head).trimEnd();
  return `${kept}\n\n${TRUNCATION_NOTICE}`;
}

/**
 * @param {VersionDiff[]} diffs
 * @param {string} rootDir
 * @returns {Promise<string>}
 */
export async function buildAggregatedReleaseNotes(diffs, rootDir) {
  const { packages } = await getPackages(rootDir);
  const packageByName = new Map(
    packages.map((pkg) => [pkg.packageJson.name, pkg]),
  );

  const sections = [];
  const seenEntries = new Set();

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
    const section = extractChangelogSection(changelog, diff.newVersion);
    if (section === null) {
      sections.push(
        `## ${diff.name}\n\n_No changelog section for version ${diff.newVersion}._`,
      );
      continue;
    }

    const { body, dropped } = dedupeChangelogSection(section, seenEntries);
    const parts = [`## ${diff.name}`];
    if (body) {
      parts.push(body);
    }
    if (dropped > 0) {
      parts.push(sharedEntriesNote(dropped));
    }
    sections.push(parts.join('\n\n'));
  }

  return fitGitHubReleaseBody(sections.join('\n\n'));
}
