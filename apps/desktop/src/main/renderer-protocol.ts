import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { protocol } from 'electron';
import type { PremiumRoutes } from './premium/host/premium-routes.js';
import { documentPolicy, SUBRESOURCE_POLICY, type CspManifest } from './renderer-csp.js';

export const RENDERER_SCHEME = 'app';
export const RENDERER_HOST = 'bundle';
export const RENDERER_ENTRY_URL = `${RENDERER_SCHEME}://${RENDERER_HOST}/index.html`;

const HTML_MIME_TYPE = 'text/html';

const MIME_TYPES: Record<string, string> = {
  '.html': HTML_MIME_TYPE,
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

const DEFAULT_MIME_TYPE = 'application/octet-stream';

export function isRendererUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === `${RENDERER_SCHEME}:` &&
      url.hostname === RENDERER_HOST &&
      url.port === '' &&
      url.username === '' &&
      url.password === ''
    );
  } catch {
    return false;
  }
}

export function mimeTypeFor(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? DEFAULT_MIME_TYPE;
}

function extractPathname(requestUrl: string): string {
  const withoutFragment = requestUrl.split('#', 1)[0] ?? requestUrl;
  const withoutQuery = withoutFragment.split('?', 1)[0] ?? withoutFragment;
  const schemeMatch = /^[a-z][a-z0-9+.-]*:\/\//i.exec(withoutQuery);
  const afterScheme = schemeMatch ? withoutQuery.slice(schemeMatch[0].length) : withoutQuery;
  const slashIndex = afterScheme.indexOf('/');
  return slashIndex === -1 ? '/' : afterScheme.slice(slashIndex);
}

export interface ResolvedRendererFile {
  path: string;
  mimeType: string;
}

/**
 * Maps an `app://bundle/...` request to a file under `root`, refusing anything that could
 * reach outside it. `protocol.handle` hands this whatever path a compromised or malformed
 * renderer request asks for, so the checks below — a decoded `..` segment, a percent-encoded
 * one, a protocol-relative `//host` prefix, a Windows drive segment — all have to run on the
 * fully decoded path before it ever touches the filesystem, and `path.relative` against `root`
 * is kept as a last defense in case a shape above was missed.
 */
export function resolveRendererFile(requestUrl: string, root: string): ResolvedRendererFile | null {
  if (!isRendererUrl(requestUrl)) {
    return null;
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(extractPathname(requestUrl));
  } catch {
    return null;
  }

  if (/^\/{2,}/.test(pathname) || /^\/+[a-zA-Z]:/.test(pathname)) {
    return null;
  }

  const segments = pathname.split('/').filter((segment) => segment !== '' && segment !== '.');
  if (segments.some((segment) => segment === '..')) {
    return null;
  }

  const lastSegment = segments.at(-1);
  const withIndex = lastSegment !== undefined && path.extname(lastSegment) ? segments : [...segments, 'index.html'];

  const resolved = path.join(root, ...withIndex);
  const relativeToRoot = path.relative(root, resolved);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return null;
  }

  return { path: resolved, mimeType: mimeTypeFor(resolved) };
}

/** Must run at module scope before `app.whenReady()` — Electron ignores a privileged-scheme
 *  registration made any later than that. */
export function registerRendererSchemeAsPrivileged(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: RENDERER_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

function policyFor(resolved: ResolvedRendererFile, root: string, manifest: CspManifest): string {
  if (resolved.mimeType !== HTML_MIME_TYPE) {
    return SUBRESOURCE_POLICY;
  }
  const pagePath = path.relative(root, resolved.path).split(path.sep).join('/');
  return documentPolicy(manifest.pages.get(pagePath));
}

function notFound(): Response {
  return new Response(null, {
    status: 404,
    headers: { 'content-security-policy': SUBRESOURCE_POLICY, 'x-content-type-options': 'nosniff' },
  });
}

/**
 * The pathname of a request that belongs to the Premium routes, or null for any other request.
 * Recognised the way the file lookup reads a path, so no spelling of `_premium` (dot segments,
 * doubled slashes, case) can reach the file lookup instead. The routes get the decoded path as
 * sent and match it exactly, so only the canonical spelling is ever served.
 */
function premiumPathname(requestUrl: string): string | null {
  if (!isRendererUrl(requestUrl)) return null;
  const raw = extractPathname(requestUrl);
  let pathname: string;
  try {
    pathname = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const segments = pathname.split('/').filter((segment) => segment !== '' && segment !== '.');
  if (segments[0]?.toLowerCase() !== '_premium') return null;
  // No Premium path contains a percent sign, so an encoded spelling is handed over as sent and misses.
  return raw.includes('%') ? raw : pathname;
}

function servePremium(pathname: string, premium: PremiumRoutes | undefined): Response {
  const resource = premium?.resolve(pathname) ?? null;
  if (resource === null) return notFound();
  return new Response(resource.bytes, {
    headers: {
      'content-type': resource.mimeType,
      'content-security-policy': SUBRESOURCE_POLICY,
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
    },
  });
}

export async function serveRendererRequest(
  requestUrl: string,
  root: string,
  manifest: CspManifest,
  read: (filePath: string) => Promise<Uint8Array> = readFile,
  premium?: PremiumRoutes,
): Promise<Response> {
  // Anything under `_premium` is answered from memory or not at all; the disk is never asked.
  const premiumPath = premiumPathname(requestUrl);
  if (premiumPath !== null) return servePremium(premiumPath, premium);

  const resolved = resolveRendererFile(requestUrl, root);
  if (!resolved) {
    return notFound();
  }

  try {
    const data = await read(resolved.path);
    return new Response(data, {
      headers: {
        'content-type': resolved.mimeType,
        'content-security-policy': policyFor(resolved, root, manifest),
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return notFound();
  }
}

export function registerRendererProtocol(root: string, manifest: CspManifest, premium?: PremiumRoutes): void {
  protocol.handle(RENDERER_SCHEME, (request) => serveRendererRequest(request.url, root, manifest, readFile, premium));
}
