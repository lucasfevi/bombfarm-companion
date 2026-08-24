/**
 * The revoke handler must tear the tap down *before* it records the revoke. The tap re-checks
 * consent only when deciding whether to attach, never against a session already in progress, so
 * recording the revoke first would leave an attached tap reading real game traffic past the
 * moment consent said to stop.
 *
 * That ordering is load-bearing and invisible: swapping the two statements keeps every other test
 * green, because each one passes on its own and nothing else observes their sequence. The handler
 * lives inside a module-private `registerIpcHandlers`, so this guard reads the source rather than
 * calling it — the same approach the live-source boundary guard already takes in this directory.
 *
 * Comments are stripped before scanning: the handler documents its own ordering in prose directly
 * above itself, and a bare substring match would find the explanation instead of the code.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const INDEX_PATH = resolve(__dirname, 'index.ts');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** The body between `'consent:revoke':` and the start of the next handler entry. */
function revokeHandlerBody(source: string): string {
  const start = source.indexOf("'consent:revoke'");
  expect(start).toBeGreaterThan(-1);
  const rest = source.slice(start);
  const end = rest.indexOf("'live:get'");
  expect(end).toBeGreaterThan(-1);
  return rest.slice(0, end);
}

describe('consent revoke tears the tap down before recording the revoke', () => {
  const source = stripComments(readFileSync(INDEX_PATH, 'utf8'));
  const body = revokeHandlerBody(source);

  it('calls forceDetach before applyConsentEvent', () => {
    const detachAt = body.indexOf('forceDetach');
    const recordAt = body.indexOf('applyConsentEvent');

    expect(detachAt).toBeGreaterThan(-1);
    expect(recordAt).toBeGreaterThan(-1);
    expect(detachAt).toBeLessThan(recordAt);
  });

  it('awaits the detach, so the revoke is not recorded while teardown is still in flight', () => {
    expect(/await\s+liveSource\?\.forceDetach\(\)/.test(body)).toBe(true);
  });

  it('scans the handler body, not the prose above it', () => {
    expect(body).not.toContain('should have stopped');
    expect(body.length).toBeLessThan(400);
  });
});
