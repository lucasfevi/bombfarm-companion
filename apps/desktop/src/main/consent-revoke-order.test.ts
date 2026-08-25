/**
 * The stop-before-record guarantee itself is proved behaviourally in
 * `game-api/consent-applier.test.ts`, against `createConsentApplier` directly. What that suite
 * cannot see is whether `index.ts` actually wires `forceDetach` into `beforeLosingConsent` rather
 * than, say, reintroducing its own detach-then-record sequence beside it — `applyConsentEvent` is
 * a module-level `const` built once at load time, with no exported hook to call and assert
 * against, so this guard reads the source rather than calling it, the same approach the
 * live-source boundary guard already takes in this directory.
 *
 * Comments are stripped before scanning, since prose above the construction site could otherwise
 * satisfy a bare substring match in place of the code.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const INDEX_PATH = resolve(__dirname, 'index.ts');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** The body between `createConsentApplier({` and its matching closing `});`. */
function consentApplierConstruction(source: string): string {
  const start = source.indexOf('createConsentApplier({');
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf('});', start);
  expect(end).toBeGreaterThan(-1);
  return source.slice(start, end);
}

/** The body of the `'consent:revoke':` handler entry, up to the next handler entry. */
function revokeHandlerBody(source: string): string {
  const start = source.indexOf("'consent:revoke'");
  expect(start).toBeGreaterThan(-1);
  const rest = source.slice(start);
  const end = rest.indexOf("'live:get'");
  expect(end).toBeGreaterThan(-1);
  return rest.slice(0, end);
}

describe('consent:revoke wires forceDetach into the applier as a pre-persist hook', () => {
  const source = stripComments(readFileSync(INDEX_PATH, 'utf8'));

  it('lists forceDetach inside the beforeLosingConsent hooks passed to createConsentApplier', () => {
    const construction = consentApplierConstruction(source);
    const beforeStart = construction.indexOf('beforeLosingConsent');
    const afterStart = construction.indexOf('afterApplied');

    expect(beforeStart).toBeGreaterThan(-1);
    expect(afterStart).toBeGreaterThan(beforeStart);

    const beforeLosingConsentSection = construction.slice(beforeStart, afterStart);
    expect(beforeLosingConsentSection).toContain('forceDetach');
  });

  it('leaves the consent:revoke handler with no detach-then-record ordering of its own', () => {
    const body = revokeHandlerBody(source);

    expect(body).not.toContain('forceDetach');
    expect(body).not.toContain('await');
    expect(body).toContain('applyConsentEvent');
  });
});
