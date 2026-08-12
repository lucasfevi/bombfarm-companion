import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CI_DESKTOP_PATH = resolve(root, '.github/workflows/ci-desktop.yml');

/**
 * `ci-desktop.yml` keeps two copies of the same path-filter list — `on.push.paths` (what
 * triggers a push-driven run at all) and the `dorny/paths-filter` `desktop:` filter (what the
 * `quality`/`smoke-windows` jobs treat as "this PR touches desktop"). The file's own comments
 * say "keep in sync"; nothing enforced it until this guard (T1 Done-when, `mp2-live-account-read`).
 * One list alone means the package gets no CI on some triggers — the same shape as `AD-020`'s
 * consequence (2), which broke the web typecheck.
 *
 * Deliberately dumb text slicing, not a YAML parse — matches the existing convention in
 * `tools/design-system-gate.test.mjs` and `tools/release-config.test.mjs`.
 */
function extractQuotedListAfter(text, anchorLine) {
  const lines = text.split('\n');
  const anchorIndex = lines.findIndex((line) => line.trim() === anchorLine);
  if (anchorIndex === -1) return null;

  const items = [];
  for (let i = anchorIndex + 1; i < lines.length; i += 1) {
    const match = lines[i].match(/^\s*-\s*'([^']+)'\s*$/);
    if (!match) break;
    items.push(match[1]);
  }
  return items;
}

describe('ci-desktop.yml — the two path-filter lists stay in sync', () => {
  const workflowText = readFileSync(CI_DESKTOP_PATH, 'utf8');

  // The file has two `paths:` blocks (on.push.paths, and inside filters: | desktop:). The first
  // `paths:` line encountered is on.push's; the filter block is anchored on its own `desktop:` key.
  const pushPaths = extractQuotedListAfter(workflowText, 'paths:');
  const filterPaths = extractQuotedListAfter(workflowText, 'desktop:');

  it('finds a non-empty on.push.paths list', () => {
    expect(pushPaths).not.toBeNull();
    expect(pushPaths.length).toBeGreaterThan(0);
  });

  it('finds a non-empty dorny/paths-filter desktop: list', () => {
    expect(filterPaths).not.toBeNull();
    expect(filterPaths.length).toBeGreaterThan(0);
  });

  it('both lists carry packages/game-api/** — a game-api-only change must run desktop CI', () => {
    expect(pushPaths).toContain('packages/game-api/**');
    expect(filterPaths).toContain('packages/game-api/**');
  });

  it('the two lists are exactly equal, in the same order', () => {
    expect(filterPaths).toEqual(pushPaths);
  });
});
