import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CONSENT_TEXT } from './consent-text.js';

/** The sha256 of `CONSENT_TEXT.body.join('\n')` at `version: 1`. Recompute and bump the key when
 *  `version` is bumped — that pairing is the point of the test below. */
const KNOWN_BODY_DIGESTS: Readonly<Record<number, string>> = {
  1: '4353ef5f05a0ae24b720b46af0f8967949e8b590495d32d45b727ada1b212779',
};

describe('CONSENT_TEXT', () => {
  it('has a title and both button labels', () => {
    expect(CONSENT_TEXT.title.length).toBeGreaterThan(0);
    expect(CONSENT_TEXT.acceptLabel.length).toBeGreaterThan(0);
    expect(CONSENT_TEXT.declineLabel.length).toBeGreaterThan(0);
  });

  it('carries exactly the five LAR-02 clauses', () => {
    expect(CONSENT_TEXT.body).toHaveLength(5);
  });

  it('states WHAT is used — the session token the game itself already uses', () => {
    const clause = CONSENT_TEXT.body.find((p) => p.startsWith('What:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/session token/i);
    expect(clause).toMatch(/game itself already/i);
  });

  it('states WHERE it is sent — api.bombfarm.net and nowhere else', () => {
    const clause = CONSENT_TEXT.body.find((p) => p.startsWith('Where:'));
    expect(clause).toBeDefined();
    expect(clause).toContain('api.bombfarm.net');
    expect(clause).toMatch(/nowhere else|never sent to us or anyone else/i);
  });

  it('states access is READ-ONLY', () => {
    const clause = CONSENT_TEXT.body.find((p) => p.startsWith('Read-only:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/read-only/i);
    expect(clause).toMatch(/changes nothing/i);
  });

  it('states NO SURPRISES — the exact "no disruptive action" sentence, verbatim', () => {
    const clause = CONSENT_TEXT.body.find((p) => p.startsWith('No surprises:'));
    expect(clause).toBeDefined();
    expect(clause).toContain('no disruptive action is taken without your approval');
  });

  it('states the decision is REVERSIBLE', () => {
    const clause = CONSENT_TEXT.body.find((p) => p.startsWith('Reversible:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/turn this off later/i);
  });

  it('binds CONSENT_TEXT.body to CONSENT_TEXT.version — editing the text without bumping the version fails', () => {
    const digest = createHash('sha256').update(CONSENT_TEXT.body.join('\n')).digest('hex');
    expect(KNOWN_BODY_DIGESTS[CONSENT_TEXT.version]).toBeDefined();
    expect(digest).toBe(KNOWN_BODY_DIGESTS[CONSENT_TEXT.version]);
  });
});
