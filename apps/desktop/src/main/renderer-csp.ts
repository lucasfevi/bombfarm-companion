import { readFileSync } from 'node:fs';
import path from 'node:path';

export const CSP_MANIFEST_FILE = 'csp-manifest.json';
const CSP_MANIFEST_VERSION = 1;
const HASH_SOURCE = /^sha256-[A-Za-z0-9+/]{43}=$/;

export interface PageHashes {
  readonly scripts: readonly string[];
  readonly styleElements: readonly string[];
  readonly styleAttributes: readonly string[];
}

export interface CspManifest {
  readonly pages: ReadonlyMap<string, PageHashes>;
}

const EMPTY_CSP_MANIFEST: CspManifest = { pages: new Map() };

export class CspManifestInvalidError extends Error {
  constructor(readonly reason: string) {
    super(`csp-manifest-invalid:${reason}`);
    this.name = 'CspManifestInvalidError';
  }
}

function hashList(value: unknown, where: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new CspManifestInvalidError(`${where}:not-a-list`);
  }
  return value.map((hash: unknown) => {
    if (typeof hash !== 'string' || !HASH_SOURCE.test(hash)) {
      throw new CspManifestInvalidError(`${where}:not-a-sha256-hash`);
    }
    return hash;
  });
}

export function parseCspManifest(raw: unknown): CspManifest {
  if (typeof raw !== 'object' || raw === null) {
    throw new CspManifestInvalidError('not-an-object');
  }
  const { version, pages } = raw as { version?: unknown; pages?: unknown };
  if (version !== CSP_MANIFEST_VERSION) {
    throw new CspManifestInvalidError(`version:expected-${String(CSP_MANIFEST_VERSION)}`);
  }
  if (typeof pages !== 'object' || pages === null) {
    throw new CspManifestInvalidError('pages:not-an-object');
  }

  const parsed = new Map<string, PageHashes>();
  for (const [pagePath, entry] of Object.entries(pages)) {
    if (typeof entry !== 'object' || entry === null) {
      throw new CspManifestInvalidError(`${pagePath}:not-an-object`);
    }
    const hashes = entry as Record<string, unknown>;
    parsed.set(pagePath, {
      scripts: hashList(hashes.scripts, `${pagePath}:scripts`),
      styleElements: hashList(hashes.styleElements, `${pagePath}:styleElements`),
      styleAttributes: hashList(hashes.styleAttributes, `${pagePath}:styleAttributes`),
    });
  }
  return { pages: parsed };
}

export function loadCspManifest(root: string): CspManifest {
  const manifestPath = path.join(root, CSP_MANIFEST_FILE);
  let text: string;
  try {
    text = readFileSync(manifestPath, 'utf8');
  } catch {
    throw new CspManifestInvalidError(`missing:${CSP_MANIFEST_FILE}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new CspManifestInvalidError('not-json');
  }
  return parseCspManifest(raw);
}

/** A dev run loads the Next dev server, never `app://`, and has no built export to read. */
export function cspManifestForBoot(isDev: boolean, root: string): CspManifest {
  return isDev ? EMPTY_CSP_MANIFEST : loadCspManifest(root);
}

const quoted = (hashes: readonly string[]): string => hashes.map((hash) => `'${hash}'`).join(' ');

/**
 * The renderer loads nothing from outside its own bundle: game art ships in the bundle, and
 * every network call goes through the main process over IPC. `data:` images cover the share
 * card's inlined SVG and the CSS-masked checkbox glyph.
 *
 * `base-uri` is `'self'`, not `'none'`: html-to-image resolves each url it embeds by setting a
 * `<base>` in a scratch document made with `createHTMLDocument`, which inherits this policy, and
 * under `'none'` the share card loses the fonts and images it was going to inline.
 */
export function documentPolicy(page: PageHashes | undefined): string {
  const scripts = page === undefined ? '' : quoted(page.scripts);
  const styleElements = page === undefined ? '' : quoted(page.styleElements);
  const styleAttributes = page === undefined ? '' : quoted(page.styleAttributes);
  return [
    "default-src 'none'",
    `script-src 'self' ${scripts}`.trimEnd(),
    "worker-src 'self'",
    `style-src 'self' ${styleElements}`.trimEnd(),
    styleAttributes === '' ? "style-src-attr 'none'" : `style-src-attr 'unsafe-hashes' ${styleAttributes}`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * A script served here can become a worker, and a worker takes its policy from its own response
 * rather than from the page that started it. The same header on every other file keeps an SVG
 * or text file that something navigates to from running inline script.
 */
export const SUBRESOURCE_POLICY =
  "default-src 'none'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
