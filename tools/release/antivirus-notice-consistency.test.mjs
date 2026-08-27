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
 * Case-insensitive substring check — a clause that opens a sentence with `needle` capitalizes
 * its first letter, and that alone must not read as a different cause or consequence.
 *
 * @param {string} haystack
 * @param {string} needle
 * @returns {boolean}
 */
function containsCaseInsensitive(haystack, needle) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * The release-note preamble is the one surface that is a code constant rather than prose, so the
 * two claims every surface owes the reader are read off it instead of retyped here — a reworded
 * notice cannot leave this guard asserting wording no surface uses any more.
 */
const CAUSE = 'attaching to another running program is the technique behavior-based detection looks for';
const CONSEQUENCE = 'flag or quarantine';

/**
 * The pt-BR counterpart of `CAUSE`, given verbatim alongside the English disclosure text — the
 * one fact the cross-surface guard below must not let a translation silently drop.
 */
const CAUSE_PT_BR =
  'conectar-se a outro programa em execução é a técnica que a detecção por comportamento procura';

const CONSENT_TEXT_PATH = fileURLToPath(new URL('../../packages/game-api/src/consent-text.ts', import.meta.url));

const surfaces = {
  'the consent disclosure': CONSENT_TEXT_PATH,
  'README.md': fileURLToPath(new URL('../../README.md', import.meta.url)),
};

describe('the antivirus notice names the same cause and consequence on every surface', () => {
  it('the release-note preamble carries both claims the other surfaces are measured against', () => {
    expect(containsCaseInsensitive(ANTIVIRUS_NOTICE, CAUSE)).toBe(true);
    expect(containsCaseInsensitive(ANTIVIRUS_NOTICE, CONSEQUENCE)).toBe(true);
  });

  for (const [label, path] of Object.entries(surfaces)) {
    const source = unwrap(readFileSync(path, 'utf8'));

    it(`${label} names attaching-to-a-running-program as the detection cause`, () => {
      expect(containsCaseInsensitive(source, CAUSE)).toBe(true);
    });

    it(`${label} says the app may be flagged or quarantined`, () => {
      expect(containsCaseInsensitive(source, CONSEQUENCE)).toBe(true);
    });
  }

  it('the pt-BR consent disclosure names the same detection cause, in Portuguese', () => {
    const source = unwrap(readFileSync(CONSENT_TEXT_PATH, 'utf8'));
    expect(containsCaseInsensitive(source, CAUSE_PT_BR)).toBe(true);
  });
});
