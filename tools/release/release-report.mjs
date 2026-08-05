const REPORT_MARKER = '<!-- bfc-release-report -->';

/**
 * @typedef {import('./release-plan.mjs').ReleaseSet} ReleaseSet
 * @typedef {import('./release-plan.mjs').ArtifactPlan} ArtifactPlan
 */

/**
 * @param {{
 *   set: ReleaseSet,
 *   artifactPlan: ArtifactPlan,
 *   headSha: string,
 *   runUrl?: string,
 *   prodReleaseEnabled?: boolean,
 * }} options
 * @returns {string}
 */
export function renderReleaseReport({
  set,
  artifactPlan,
  headSha,
  runUrl = '',
  prodReleaseEnabled = false,
}) {
  const lines = [REPORT_MARKER, '', '# Release report', ''];

  if (isEmptySet(set)) {
    lines.push('No packages are scheduled to release in this run.');
    lines.push('');
    appendHeadSha(lines, headSha);
    appendRunUrl(lines, runUrl);
    appendProdFlag(lines, prodReleaseEnabled);
    appendSoakChecklist(lines);
    return lines.join('\n');
  }

  lines.push('## Version bumps', '');
  lines.push('| Package | Version |');
  lines.push('| --- | --- |');
  for (const release of set.releases) {
    lines.push(`| ${release.name} | ${release.oldVersion} → ${release.newVersion} |`);
  }
  lines.push('');

  lines.push('## Artifacts', '');
  lines.push('| Artifact | Status |');
  lines.push('| --- | --- |');
  lines.push(
    `| Desktop beta installer | ${formatArtifactStatus(artifactPlan.desktopInstaller.build, artifactPlan.desktopInstaller.reason)} |`,
  );
  lines.push(
    `| Web production deploy | ${formatArtifactStatus(artifactPlan.webProduction.deploy, artifactPlan.webProduction.reason)} |`,
  );
  lines.push('');

  appendHeadSha(lines, headSha);
  appendRunUrl(lines, runUrl);
  appendProdFlag(lines, prodReleaseEnabled);
  appendSoakChecklist(lines);

  return lines.join('\n');
}

/**
 * @param {ReleaseSet} set
 * @returns {boolean}
 */
function isEmptySet(set) {
  return !set.releases || set.releases.length === 0;
}

/**
 * @param {boolean} enabled
 * @param {string} reason
 * @returns {string}
 */
function formatArtifactStatus(enabled, reason) {
  return enabled ? 'produced' : `skipped — ${reason}`;
}

/**
 * @param {string[]} lines
 * @param {string} headSha
 */
function appendHeadSha(lines, headSha) {
  const shortSha = headSha.slice(0, 7);
  lines.push('## Head SHA', '');
  lines.push(`\`${shortSha}\` (${headSha})`, '');
}

/**
 * @param {string[]} lines
 * @param {string} runUrl
 */
function appendRunUrl(lines, runUrl) {
  if (runUrl) {
    lines.push('## Workflow run', '');
    lines.push(runUrl, '');
  }
}

/**
 * @param {string[]} lines
 * @param {boolean} prodReleaseEnabled
 */
function appendProdFlag(lines, prodReleaseEnabled) {
  lines.push('## Production GitHub Release', '');
  if (prodReleaseEnabled) {
    lines.push('Enabled — `BFC_ENABLE_PROD_RELEASE` is on.');
  } else {
    lines.push('Skipped — prod GitHub Release disabled (`BFC_ENABLE_PROD_RELEASE` is off).');
  }
  lines.push('');
}

/**
 * @param {string[]} lines
 */
function appendSoakChecklist(lines) {
  lines.push('## Pre-merge soak checklist', '');
  lines.push(
    '_Human checklist only — not a required GitHub check._ Wait at least 24 hours after the beta installer is available, exercise the desktop build, and confirm the changelog before merging to `main`.',
  );
  lines.push('');
}

export { REPORT_MARKER };
