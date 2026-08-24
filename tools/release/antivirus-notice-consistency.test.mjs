import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ANTIVIRUS_NOTICE } from './aggregated-release-notes.mjs';

/**
 * Joins a JS string-literal concatenation (`'a ' +\n  'b'`) or a markdown blockquote's wrapped
 * lines (`> a\n> b`) back into one run of prose, so a fragment that a source file wraps across
 * lines for readability can still be found as a contiguous substring.
 *
 * @param {string} source
 * @returns {string}
 */
function unwrap(source) {
  return source
    .replace(/['"]\s*\+\s*\r?\n\s*['"]/g, '')
    .replace(/\r?\n>\s?/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * The release-note preamble is the one surface that is a code constant rather than prose, so the
 * two claims every surface owes the reader are read off it instead of retyped here — a reworded
 * notice cannot leave this guard asserting wording no surface uses any more.
 */
const CAUSE = 'attaching to another running program is the technique behavior-based detection is built to look for';
const CONSEQUENCE = 'flag or quarantine';

const surfaces = {
  'the consent disclosure': fileURLToPath(
    new URL('../../packages/game-api/src/consent-text.ts', import.meta.url),
  ),
  'README.md': fileURLToPath(new URL('../../README.md', import.meta.url)),
};

describe('the antivirus notice names the same cause and consequence on every surface', () => {
  it('the release-note preamble carries both claims the other surfaces are measured against', () => {
    expect(ANTIVIRUS_NOTICE).toContain(CAUSE);
    expect(ANTIVIRUS_NOTICE).toContain(CONSEQUENCE);
  });

  for (const [label, path] of Object.entries(surfaces)) {
    const source = unwrap(readFileSync(path, 'utf8'));

    it(`${label} names attaching-to-a-running-program as the detection cause`, () => {
      expect(source).toContain(CAUSE);
    });

    it(`${label} says the app may be flagged or quarantined`, () => {
      expect(source).toContain(CONSEQUENCE);
    });
  }
});
