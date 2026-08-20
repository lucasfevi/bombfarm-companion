/**
 * @param {string} markdown
 * @param {string} version
 * @returns {string | null}
 */
export function extractChangelogSection(markdown, version) {
  const headingPattern = new RegExp(`^## ${escapeRegExp(version)}\\s*$`, 'm');
  const match = headingPattern.exec(markdown);
  if (!match) {
    return null;
  }

  const bodyStart = match.index + match[0].length;
  const remainder = markdown.slice(bodyStart);
  const nextHeadingMatch = remainder.match(/^## \S/m);
  const bodyEnd = nextHeadingMatch ? nextHeadingMatch.index : remainder.length;
  const body = remainder.slice(0, bodyEnd).trim();

  return body.length > 0 ? body : '';
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
