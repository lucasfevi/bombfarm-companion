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

  it('both lists carry packages/domain/** — a domain-only change must run desktop CI', () => {
    expect(pushPaths).toContain('packages/domain/**');
    expect(filterPaths).toContain('packages/domain/**');
  });

  // MP5 F5 (MWD-15) — without this entry, a PR editing only wiki-drift.yml would run no guard
  // at all: the shape guard (tools/wiki-drift-workflow.test.mjs) is a `tools` unit test, reached
  // only through this workflow's own `quality` job.
  it('both lists carry .github/workflows/wiki-drift.yml — its own shape guard must run', () => {
    expect(pushPaths).toContain('.github/workflows/wiki-drift.yml');
    expect(filterPaths).toContain('.github/workflows/wiki-drift.yml');
  });

  it('the two lists are exactly equal, in the same order', () => {
    expect(filterPaths).toEqual(pushPaths);
  });
});

/**
 * `AD-032` makes `@bombfarm/domain` a built package, joining the five workspace packages
 * `ci-desktop.yml` already builds/typechecks/lints ahead of the desktop job (MDW-29). These
 * assertions read the exact `run:` lines of the three steps, so a future edit that drops
 * domain from one of them (while leaving the path filters above intact) fails loudly instead
 * of silently building the desktop shell against a stale/missing dist.
 */
describe('ci-desktop.yml — @bombfarm/domain joins the desktop build/typecheck/lint steps (MDW-29)', () => {
  const workflowText = readFileSync(CI_DESKTOP_PATH, 'utf8');

  function extractStepRun(anchorName) {
    const lines = workflowText.split('\n');
    const nameIndex = lines.findIndex((line) => line.trim() === `- name: ${anchorName}`);
    if (nameIndex === -1) return null;
    // The step's `run:` is the next non-blank line(s) after `- name:` (a bare `run:` line, or
    // a `run: >` folded block whose continuation lines follow with deeper indentation).
    const runLines = [];
    for (let i = nameIndex + 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (/^\s*run:/.test(line)) {
        runLines.push(line);
        for (let j = i + 1; j < lines.length; j += 1) {
          const next = lines[j];
          if (/^\s{10,}\S/.test(next)) {
            runLines.push(next);
          } else {
            break;
          }
        }
        break;
      }
      if (/^\s*- name:/.test(line)) break; // hit the next step with no run: found
    }
    return runLines.join('\n');
  }

  it('"Build workspace packages (desktop deps)" includes @bombfarm/domain', () => {
    const run = extractStepRun('Build workspace packages (desktop deps)');
    expect(run).not.toBeNull();
    expect(run).toContain('--filter @bombfarm/domain');
  });

  it('"Typecheck desktop + deps" includes @bombfarm/domain', () => {
    const run = extractStepRun('Typecheck desktop + deps');
    expect(run).not.toBeNull();
    expect(run).toContain('--filter @bombfarm/domain');
  });

  it('"Lint desktop + deps" includes @bombfarm/domain', () => {
    const run = extractStepRun('Lint desktop + deps');
    expect(run).not.toBeNull();
    expect(run).toContain('--filter @bombfarm/domain');
  });
});
