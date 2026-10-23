import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { protocol } from 'electron';
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

export async function serveRendererRequest(
  requestUrl: string,
  root: string,
  manifest: CspManifest,
  read: (filePath: string) => Promise<Uint8Array> = readFile,
): Promise<Response> {
  const resolved = resolveRendererFile(requestUrl, root);
  if (!resolved) {
    return new Response(null, { status: 404 });
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
    return new Response(null, { status: 404 });
  }
}

export function registerRendererProtocol(root: string, manifest: CspManifest): void {
  protocol.handle(RENDERER_SCHEME, (request) => serveRendererRequest(request.url, root, manifest));
}
