/**
 * One owner for the colour a hero's grade is painted in.
 *
 * The game paints grades on a six-step ladder, and `heroRankToneClass` is where that lives. It
 * arrived after ten surfaces had each written `rank ? 'text-accent' : 'text-muted'` inline, so nine
 * of them kept printing one flat accent for every grade and no test noticed — the colour is a class
 * string, and nothing in this repo renders these components and reads their computed style.
 *
 * So the guard is the absence: no file outside the owner may pair a grade with the accent tone. A
 * new surface that copies the old ternary fails here rather than shipping a wrong colour.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** The module that owns the ladder, and so the one place the accent may sit beside a grade. */
const OWNER = 'packages/game-art/src/game-art.recipe.ts';

const SCAN_ROOTS = ['apps/web', 'apps/desktop', 'packages'];

function linesMatching(pattern) {
  let out;
  try {
    out = execFileSync(
      'git',
      ['grep', '-nE', pattern, '--', ...SCAN_ROOTS, ':(exclude)**/*.test.ts', ':(exclude)**/*.test.tsx'],
      { cwd: root, encoding: 'utf8' },
    );
  } catch (err) {
    if (err.status === 1) return [];
    throw err;
  }
  return out.split('\n').filter(Boolean);
}

/** A line that names a grade and the accent tone together — the shape the ten copies had. */
const RANK_WITH_ACCENT = "rank.*text-accent|text-accent.*rank";

describe('hero grade colour — one owner', () => {
  it('non-vacuity: the scan reaches real files and can match at all', () => {
    // If this pattern ever returns nothing, the scan is looking at the wrong tree and every
    // assertion below would pass by finding nothing rather than by the rule holding.
    expect(linesMatching('text-accent').length).toBeGreaterThan(3);
    expect(linesMatching(RANK_WITH_ACCENT).length).toBeGreaterThan(0);
  });

  it('only the owner pairs a grade with the accent tone', () => {
    const offenders = linesMatching(RANK_WITH_ACCENT)
      .map((line) => line.slice(0, line.indexOf(':')))
      .filter((file) => file.replace(/\\/g, '/') !== OWNER);

    expect(offenders, 'these paint a grade without asking heroRankToneClass').toEqual([]);
  });

  it('the owner really is the file this guard names, and still holds the ladder', () => {
    const owned = linesMatching(RANK_WITH_ACCENT).map((line) => line.slice(0, line.indexOf(':')));

    expect(owned.map((file) => file.replace(/\\/g, '/'))).toContain(OWNER);
  });
});
