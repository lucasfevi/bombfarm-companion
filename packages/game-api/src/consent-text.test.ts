import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CONSENT_TEXT } from './consent-text.js';

/** The sha256 of `CONSENT_TEXT.body.join('\n')` at each `version`. Recompute and add a new key
 *  when `version` is bumped — that pairing is the point of the test below. */
const KNOWN_BODY_DIGESTS: Readonly<Record<number, string>> = {
  1: '4353ef5f05a0ae24b720b46af0f8967949e8b590495d32d45b727ada1b212779',
  2: 'aa131a69c42e9161560254449cb5fe70b05f5bfbb140963f86fe82e65abcfbf5',
};

describe('CONSENT_TEXT', () => {
  it('has a title and both button labels', () => {
    expect(CONSENT_TEXT.title.length).toBeGreaterThan(0);
    expect(CONSENT_TEXT.acceptLabel.length).toBeGreaterThan(0);
    expect(CONSENT_TEXT.declineLabel.length).toBeGreaterThan(0);
  });

  it('carries exactly the seven clauses', () => {
    expect(CONSENT_TEXT.body).toHaveLength(7);
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

  it('states ATTACHING — what the tap observes, and that it sends nothing and modifies neither the client nor game state', () => {
    const clause = CONSENT_TEXT.body.find((p) => p.startsWith('Attaching:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/observes the traffic/i);
    expect(clause).toMatch(/sends nothing of its own/i);
    expect(clause).toMatch(/does not modify the.*game client/i);
    expect(clause).toMatch(/does not modify your game state/i);
  });

  it('states access is READ-ONLY, with no code path that writes to the account', () => {
    const clause = CONSENT_TEXT.body.find((p) => p.startsWith('Read-only:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/read-only/i);
    expect(clause).toMatch(/changes nothing/i);
    expect(clause).toMatch(/no code.*path that writes to your account/i);
  });

  it('states ANTIVIRUS may flag or quarantine the companion, and why', () => {
    const clause = CONSENT_TEXT.body.find((p) => p.startsWith('Antivirus:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/flag or quarantine/i);
    expect(clause).toContain(
      'attaching to another running program is the technique behavior-based detection is built to look for',
    );
  });

  it('states ACCOUNT RISK — attaching is detectable in principle, and the consequence lands on the player', () => {
    const clause = CONSENT_TEXT.body.find((p) => p.startsWith('Account risk:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/detectable in principle/i);
    expect(clause).toMatch(/consequence lands on your account/i);
  });

  it('states the decision is REVERSIBLE, and that reversing it detaches from the game client', () => {
    const clause = CONSENT_TEXT.body.find((p) => p.startsWith('Reversible:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/turn this off later/i);
    expect(clause).toMatch(/detaches from the game client/i);
  });

  it('binds CONSENT_TEXT.body to CONSENT_TEXT.version — editing the text without bumping the version fails', () => {
    const digest = createHash('sha256').update(CONSENT_TEXT.body.join('\n')).digest('hex');
    expect(KNOWN_BODY_DIGESTS[CONSENT_TEXT.version]).toBeDefined();
    expect(digest).toBe(KNOWN_BODY_DIGESTS[CONSENT_TEXT.version]);
  });
});
