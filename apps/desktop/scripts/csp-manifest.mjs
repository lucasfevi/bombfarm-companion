import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const CSP_MANIFEST_FILE = 'csp-manifest.json';
export const CSP_MANIFEST_VERSION = 1;

export class CspManifestError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(`Renderer CSP manifest: ${problems.length} problem(s)\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    this.name = 'CspManifestError';
    this.problems = problems;
  }
}

const RAW_TEXT_ELEMENTS = new Set(['style', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript']);
const ESCAPABLE_RAW_TEXT_ELEMENTS = new Set(['textarea', 'title']);
const FOREIGN_ROOTS = new Set(['svg', 'math']);
const BLOCKED_BY_POLICY = new Set(['iframe', 'frame', 'frameset', 'object', 'embed', 'applet']);
const URL_ATTRIBUTES = new Set([
  'href', 'src', 'action', 'formaction', 'data', 'poster', 'xlink:href', 'background', 'cite',
  'longdesc', 'manifest', 'ping', 'srcset', 'codebase', 'profile', 'usemap', 'lowsrc', 'dynsrc',
]);

const WHITESPACE = new Set(['\t', '\n', '\f', '\r', ' ']);
const isLetter = (char) => char !== undefined && /[A-Za-z]/.test(char);

const NAMED_REFERENCES = { 'amp;': '&', 'lt;': '<', 'gt;': '>', 'quot;': '"', 'apos;': "'" };

export function normalizeNewlines(text) {
  return text.replace(/\r\n?/g, '\n');
}

export function cspHash(text) {
  return `sha256-${createHash('sha256').update(normalizeNewlines(text), 'utf8').digest('base64')}`;
}

/** Returns null when the value holds a character reference this scanner does not decode. */
function decodeAttributeValue(raw) {
  let unsupported = false;
  const decoded = raw.replace(/&(#[xX][0-9a-fA-F]+;|#[0-9]+;|[A-Za-z][A-Za-z0-9]*;?)/g, (whole, body) => {
    if (body.startsWith('#')) {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = Number.parseInt(body.slice(isHex ? 2 : 1, -1), isHex ? 16 : 10);
      if (code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)) return String.fromCodePoint(code);
      unsupported = true;
      return whole;
    }
    const named = NAMED_REFERENCES[body];
    if (named !== undefined) return named;
    unsupported = true;
    return whole;
  });
  return unsupported || /&#/.test(decoded) ? null : decoded;
}

function skipBogusComment(html, from) {
  const close = html.indexOf('>', from);
  return close === -1 ? html.length : close + 1;
}

function skipComment(html, openIndex) {
  const bodyStart = openIndex + 4;
  if (html.startsWith('>', bodyStart)) return bodyStart + 1;
  if (html.startsWith('->', bodyStart)) return bodyStart + 2;
  let search = bodyStart;
  for (;;) {
    const dashes = html.indexOf('--', search);
    if (dashes === -1) return html.length;
    if (html.startsWith('>', dashes + 2)) return dashes + 3;
    if (html.startsWith('!>', dashes + 2)) return dashes + 4;
    search = dashes + 1;
  }
}

/** Mirrors the HTML tokenizer's tag states, which is where a quoted `>` hides from a regex. */
function readTag(html, from) {
  let index = from;
  while (index < html.length && !WHITESPACE.has(html[index]) && html[index] !== '/' && html[index] !== '>') index += 1;
  const name = html.slice(from, index).toLowerCase();
  const attributes = [];
  let selfClosing = false;

  for (;;) {
    while (index < html.length && (WHITESPACE.has(html[index]) || html[index] === '/')) {
      selfClosing = html[index] === '/' && html[index + 1] === '>';
      index += 1;
    }
    if (index >= html.length) return null;
    if (html[index] === '>') return { name, attributes, selfClosing, end: index + 1 };

    const nameStart = index;
    index += 1;
    while (index < html.length && !WHITESPACE.has(html[index]) && !'/>='.includes(html[index])) index += 1;
    const attributeName = html.slice(nameStart, index).toLowerCase();
    while (index < html.length && WHITESPACE.has(html[index])) index += 1;

    let rawValue = null;
    if (html[index] === '=') {
      index += 1;
      while (index < html.length && WHITESPACE.has(html[index])) index += 1;
      const quote = html[index];
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, index + 1);
        if (close === -1) return null;
        rawValue = html.slice(index + 1, close);
        index = close + 1;
      } else {
        const valueStart = index;
        while (index < html.length && !WHITESPACE.has(html[index]) && html[index] !== '>') index += 1;
        rawValue = html.slice(valueStart, index);
      }
    }
    if (!attributes.some((existing) => existing.name === attributeName)) {
      attributes.push({ name: attributeName, rawValue });
    }
    selfClosing = false;
  }
}

function findRawTextEnd(html, name, from) {
  const closer = new RegExp(`</${name}(?=[\\t\\n\\f\\r />])`, 'ig');
  closer.lastIndex = from;
  const match = closer.exec(html);
  return match === null ? -1 : match.index;
}

function looksLikeJavascriptUrl(value) {
  return /^javascript:/i.test(value.replace(/[\u0000- ]/g, ''));
}

/**
 * Collects what the page's policy has to allow (inline script text, `<style>` text, `style`
 * attribute values) and what it can never allow (event-handler attributes, `javascript:` URLs,
 * constructs this scanner does not model and so refuses to guess at).
 */
export function scanHtml(html) {
  const found = { scripts: [], styleElements: [], styleAttributes: [], problems: [] };
  let foreignDepth = 0;
  let index = 0;

  while (index < html.length) {
    const open = html.indexOf('<', index);
    if (open === -1) break;
    const next = html[open + 1];

    if (html.startsWith('<!--', open)) {
      index = skipComment(html, open);
      continue;
    }
    if (html.startsWith('<![CDATA[', open)) {
      found.problems.push('a CDATA section (not modelled by the scanner)');
      index = skipBogusComment(html, open + 2);
      continue;
    }
    if (next === '!' || next === '?') {
      index = skipBogusComment(html, open + 2);
      continue;
    }
    if (next === '/') {
      if (isLetter(html[open + 2])) {
        const endTag = readTag(html, open + 2);
        if (endTag === null) {
          found.problems.push('an unterminated end tag');
          break;
        }
        if (FOREIGN_ROOTS.has(endTag.name)) foreignDepth = Math.max(0, foreignDepth - 1);
        index = endTag.end;
      } else {
        index = html[open + 2] === '>' ? open + 3 : skipBogusComment(html, open + 2);
      }
      continue;
    }
    if (!isLetter(next)) {
      index = open + 1;
      continue;
    }

    const tag = readTag(html, open + 1);
    if (tag === null) {
      found.problems.push('an unterminated start tag');
      break;
    }
    index = tag.end;
    inspectAttributes(tag, found);

    if (FOREIGN_ROOTS.has(tag.name)) {
      if (!tag.selfClosing) foreignDepth += 1;
      continue;
    }
    if (BLOCKED_BY_POLICY.has(tag.name)) {
      found.problems.push(`<${tag.name}> (the policy blocks embedded content)`);
    }
    const isRawText = tag.name === 'script' || RAW_TEXT_ELEMENTS.has(tag.name) || ESCAPABLE_RAW_TEXT_ELEMENTS.has(tag.name);
    if (tag.name === 'plaintext') {
      found.problems.push('<plaintext> (swallows the rest of the document)');
      break;
    }
    if (!isRawText) continue;
    if (foreignDepth > 0) {
      if (tag.name === 'script' || tag.name === 'style') {
        found.problems.push(`<${tag.name}> inside <svg> or <math> (tokenised differently there; not modelled)`);
      }
      continue;
    }

    const end = findRawTextEnd(html, tag.name, index);
    if (end === -1) {
      found.problems.push(`an unterminated <${tag.name}>`);
      break;
    }
    const text = html.slice(index, end);
    index = end;

    if (tag.name === 'script') {
      if (/<!--/.test(text)) {
        found.problems.push('an inline <script> containing "<!--" (script-data escape states are not modelled)');
      } else if (!tag.attributes.some((attribute) => attribute.name === 'src')) {
        found.scripts.push(text);
      }
    } else if (tag.name === 'style') {
      found.styleElements.push(text);
    }
  }
  return found;
}

function inspectAttributes(tag, found) {
  for (const attribute of tag.attributes) {
    if (attribute.name.startsWith('on')) {
      found.problems.push(`an inline event handler (${attribute.name} on <${tag.name}>)`);
    }
    if (attribute.rawValue === null) continue;
    const value = decodeAttributeValue(attribute.rawValue);
    if (value === null) {
      found.problems.push(`an attribute with a character reference the scanner does not decode (${attribute.name} on <${tag.name}>)`);
      continue;
    }
    if (URL_ATTRIBUTES.has(attribute.name) && looksLikeJavascriptUrl(value)) {
      found.problems.push(`a javascript: URL (${attribute.name} on <${tag.name}>)`);
    }
    if (attribute.name === 'style') found.styleAttributes.push(value);
  }
}

const sortedUnique = (values) => [...new Set(values)].sort();

export function hashesForPage(html) {
  const scan = scanHtml(html);
  return {
    problems: scan.problems,
    page: {
      scripts: sortedUnique(scan.scripts.map(cspHash)),
      styleElements: sortedUnique(scan.styleElements.map(cspHash)),
      styleAttributes: sortedUnique(scan.styleAttributes.map(cspHash)),
    },
  };
}

/**
 * @param {ReadonlyMap<string, string>} pages exported HTML keyed by posix path under the export root
 */
export function buildManifest(pages) {
  const problems = [];
  const manifestPages = {};
  for (const relativePath of [...pages.keys()].sort()) {
    const result = hashesForPage(pages.get(relativePath));
    for (const problem of result.problems) problems.push(`${relativePath}: ${problem}`);
    manifestPages[relativePath] = result.page;
  }
  if (problems.length > 0) throw new CspManifestError(problems);
  return { version: CSP_MANIFEST_VERSION, pages: manifestPages };
}

/**
 * Re-derives every page's hashes from the HTML as it is now and compares them with the manifest,
 * in both directions: a script nobody hashed, and a hash no script matches.
 * @param {ReadonlyMap<string, string>} pages
 */
export function verifyManifest(manifest, pages) {
  const problems = [];
  if (manifest?.version !== CSP_MANIFEST_VERSION || typeof manifest.pages !== 'object' || manifest.pages === null) {
    throw new CspManifestError([`the manifest is not version ${CSP_MANIFEST_VERSION} with a pages table`]);
  }

  for (const relativePath of Object.keys(manifest.pages)) {
    if (!pages.has(relativePath)) problems.push(`${relativePath}: listed in the manifest but not in the export`);
  }
  for (const [relativePath, html] of [...pages].sort(([a], [b]) => a.localeCompare(b))) {
    const entry = manifest.pages[relativePath];
    if (entry === undefined) {
      problems.push(`${relativePath}: in the export but missing from the manifest`);
      continue;
    }
    const { problems: pageProblems, page } = hashesForPage(html);
    for (const problem of pageProblems) problems.push(`${relativePath}: ${problem}`);
    for (const kind of ['scripts', 'styleElements', 'styleAttributes']) {
      const recorded = new Set(entry[kind] ?? []);
      const actual = new Set(page[kind]);
      for (const hash of actual) {
        if (!recorded.has(hash)) problems.push(`${relativePath}: inline ${kind} hash ${hash} is not in the manifest`);
      }
      for (const hash of recorded) {
        if (!actual.has(hash)) problems.push(`${relativePath}: manifest ${kind} hash ${hash} matches nothing in the page`);
      }
    }
  }
  if (problems.length > 0) throw new CspManifestError(problems);
}

function htmlFilesUnder(root, relative = '') {
  const files = [];
  for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const entryRelative = relative === '' ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) files.push(...htmlFilesUnder(root, entryRelative));
    else if (/\.html?$/i.test(entry.name)) files.push(entryRelative);
  }
  return files;
}

export function readExportedPages(outDir) {
  return new Map(htmlFilesUnder(outDir).map((relativePath) => [relativePath, readFileSync(path.join(outDir, relativePath), 'utf8')]));
}

export function writeManifest(outDir) {
  const pages = readExportedPages(outDir);
  if (pages.size === 0) throw new CspManifestError([`no HTML files under ${outDir}`]);
  const manifest = buildManifest(pages);
  writeFileSync(path.join(outDir, CSP_MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  verifyManifestOnDisk(outDir);
  return manifest;
}

export function verifyManifestOnDisk(outDir) {
  const manifest = JSON.parse(readFileSync(path.join(outDir, CSP_MANIFEST_FILE), 'utf8'));
  verifyManifest(manifest, readExportedPages(outDir));
  return manifest;
}
