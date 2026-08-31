import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  readReleaseSet,
  resolveArtifactPlan,
} from './release-plan.mjs';
import { REPORT_MARKER, renderReleaseReport } from './release-report.mjs';

const fixturesDir = join(fileURLToPath(new URL('.', import.meta.url)), '__fixtures__');
const loadFixture = (name) =>
  JSON.parse(readFileSync(join(fixturesDir, name), 'utf8'));

const headSha = 'abcdef1234567890abcdef1234567890abcdef12';
const runUrl = 'https://github.com/example/bombfarm-companion/actions/runs/42';

function renderForFixture(name) {
  const set = readReleaseSet(loadFixture(name));
  return renderReleaseReport({
    set,
    artifactPlan: resolveArtifactPlan(set),
    headSha,
    runUrl,
  });
}

describe('renderReleaseReport', () => {
  it('starts with the release report marker', () => {
    expect(renderForFixture('release-plan-web-only.json').startsWith(REPORT_MARKER)).toBe(true);
  });

  it('renders version bumps for a web-only release set', () => {
    const report = renderForFixture('release-plan-web-only.json');
    expect(report).toContain('| @bombfarm/web | 0.0.0 → 0.0.1 |');
    expect(report).toContain('skipped — @bombfarm/desktop is not in the release set');
  });

  it('renders version bumps for a desktop-only release set', () => {
    const report = renderForFixture('release-plan-desktop-only.json');
    expect(report).toContain('| @bombfarm/desktop | 0.0.0 → 0.0.1 |');
    expect(report).toContain('| Desktop beta installer | produced |');
  });

  it('renders both apps and the shared library for a ui bump', () => {
    const report = renderForFixture('release-plan-both-apps.json');
    expect(report).toContain('| @bombfarm/web | 0.0.0 → 0.0.1 |');
    expect(report).toContain('| @bombfarm/desktop | 0.0.0 → 0.0.1 |');
    expect(report).toContain('| Desktop beta installer | produced |');
    expect(report).toContain('| Web production deploy | produced |');
  });

  it('renders a library-only set without app version rows beyond the library', () => {
    const report = renderForFixture('release-plan-libs-only.json');
    expect(report).toContain('| @bombfarm/contracts | 0.0.0 → 0.0.1 |');
    expect(report).not.toContain('| @bombfarm/web |');
    expect(report).toContain('library-only release');
  });

  it('does not render a version table for an empty release set', () => {
    const report = renderForFixture('release-plan-empty.json');
    expect(report).toContain('No packages are scheduled to release');
    expect(report).not.toContain('## Version bumps');
  });

  it('includes the head SHA in short and full form', () => {
    const report = renderForFixture('release-plan-web-only.json');
    expect(report).toContain('`abcdef1`');
    expect(report).toContain(headSha);
  });

  /**
   * The report used to print a flag whose repository variable was never set, so 165 releases in a
   * row said "prod GitHub Release disabled" and nobody read it as anything but boilerplate. There
   * is no flag now: merging a desktop bump publishes, and the report says so.
   */
  it('tells the reviewer that merging a desktop bump publishes a stable release', () => {
    const report = renderForFixture('release-plan-desktop-only.json');
    expect(report).toContain('Merging this PR publishes a public GitHub Release');
    expect(report).not.toContain('BFC_ENABLE_PROD_RELEASE');
  });

  it('says no release is published when the set carries no desktop bump', () => {
    const report = renderForFixture('release-plan-web-only.json');
    expect(report).toContain('No desktop bump in this set');
  });

  it('includes the human soak checklist wording', () => {
    const report = renderForFixture('release-plan-desktop-only.json');
    expect(report).toContain('not a required GitHub check');
    expect(report).toContain('24 hours');
  });
});

