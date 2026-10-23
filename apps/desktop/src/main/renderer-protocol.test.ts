import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCspManifest } from './renderer-csp.js';
import {
  mimeTypeFor,
  registerRendererProtocol,
  registerRendererSchemeAsPrivileged,
  resolveRendererFile,
  serveRendererRequest,
} from './renderer-protocol.js';

const electronDouble = vi.hoisted(() => ({
  schemes: [] as { scheme: string; privileges: Record<string, boolean> }[],
  handlers: new Map<string, (request: { url: string }) => Promise<Response>>(),
}));

vi.mock('electron', () => ({
  protocol: {
    registerSchemesAsPrivileged: (schemes: typeof electronDouble.schemes) => {
      electronDouble.schemes.push(...schemes);
    },
    handle: (scheme: string, handler: (request: { url: string }) => Promise<Response>) => {
      electronDouble.handlers.set(scheme, handler);
    },
  },
}));

const ROOT = path.join('C:', 'app', 'renderer', 'out');

const INDEX_HASH = `sha256-${'I'.repeat(43)}=`;
const MINI_HASH = `sha256-${'M'.repeat(43)}=`;
const MANIFEST = parseCspManifest({
  version: 1,
  pages: {
    'index.html': { scripts: [INDEX_HASH], styleElements: [], styleAttributes: [] },
    'mini-live/index.html': { scripts: [MINI_HASH], styleElements: [], styleAttributes: [] },
  },
});

const readStub = (): Promise<Uint8Array> => Promise.resolve(new TextEncoder().encode('body'));
const serve = (url: string) => serveRendererRequest(url, ROOT, MANIFEST, readStub);

describe('the app:// scheme', () => {
  const tempDirs: string[] = [];
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('is never registered with bypassCSP, which would make every header here inert', () => {
    registerRendererSchemeAsPrivileged();
    const app = electronDouble.schemes.find((entry) => entry.scheme === 'app');
    expect(app?.privileges).toEqual({ standard: true, secure: true, supportFetchAPI: true });
    expect(app?.privileges).not.toHaveProperty('bypassCSP');
  });

  it('answers each request the handler is given with the policy header, from the real file', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'bfc-renderer-protocol-'));
    tempDirs.push(root);
    writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>x</title>');

    registerRendererProtocol(root, MANIFEST);
    const handler = electronDouble.handlers.get('app');
    const response = await handler?.({ url: 'app://bundle/index.html' });

    expect(response?.status).toBe(200);
    expect(await response?.text()).toContain('<title>x</title>');
    expect(response?.headers.get('content-security-policy')).toContain(`'${INDEX_HASH}'`);
  });
});

describe('serveRendererRequest', () => {
  it('sends a Content-Security-Policy with every HTML page', async () => {
    const response = await serve('app://bundle/index.html');
    expect(response.headers.get('content-type')).toBe('text/html');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
  });

  it('gives a page the hashes of its own inline scripts only', async () => {
    const index = (await serve('app://bundle/')).headers.get('content-security-policy');
    const mini = (await serve('app://bundle/mini-live/')).headers.get('content-security-policy');
    expect(index).toContain(`'${INDEX_HASH}'`);
    expect(index).not.toContain(MINI_HASH);
    expect(mini).toContain(`'${MINI_HASH}'`);
    expect(mini).not.toContain(INDEX_HASH);
  });

  it('allows no inline script on an HTML file the build did not list', async () => {
    const policy = (await serve('app://bundle/surprise.html')).headers.get('content-security-policy');
    expect(policy).toContain("script-src 'self';");
    expect(policy).not.toContain('sha256-');
  });

  it.each(['app://bundle/_next/static/chunks/worker.js', 'app://bundle/wiki-assets/a.png', 'app://bundle/x.svg', 'app://bundle/notes.txt'])(
    'sends the locked-down policy with %s, which a worker or a navigation could treat as its own document',
    async (url) => {
      const policy = (await serve(url)).headers.get('content-security-policy');
      expect(policy).toBe("default-src 'none'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    },
  );

  it('sends the same page policy for the index however the path is spelled', async () => {
    const spellings = ['app://bundle/', 'app://bundle/index.html', 'app://bundle/index.html?x=1#y', 'app://bundle/./index.html'];
    const policies = await Promise.all(spellings.map(async (url) => (await serve(url)).headers.get('content-security-policy')));
    expect(new Set(policies).size).toBe(1);
  });

  it('forbids content sniffing', async () => {
    expect((await serve('app://bundle/index.html')).headers.get('x-content-type-options')).toBe('nosniff');
    expect((await serve('app://bundle/a.js')).headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('serves a 404 with no page policy for a path outside the root', async () => {
    const response = await serve('app://bundle/..%2f..%2fsecret.html');
    expect(response.status).toBe(404);
    expect(response.headers.get('content-security-policy')).toBeNull();
  });

  it('serves a 404 when the file cannot be read', async () => {
    const response = await serveRendererRequest('app://bundle/index.html', ROOT, MANIFEST, () =>
      Promise.reject(new Error('ENOENT')),
    );
    expect(response.status).toBe(404);
  });
});

describe('resolveRendererFile', () => {
  it('resolves a normal file under the root', () => {
    const resolved = resolveRendererFile('app://bundle/_next/static/css/app.css', ROOT);
    expect(resolved?.path).toBe(path.join(ROOT, '_next', 'static', 'css', 'app.css'));
  });

  it('maps the root path to index.html', () => {
    const resolved = resolveRendererFile('app://bundle/', ROOT);
    expect(resolved?.path).toBe(path.join(ROOT, 'index.html'));
  });

  it('maps an extensionless path to its index.html', () => {
    const resolved = resolveRendererFile('app://bundle/settings', ROOT);
    expect(resolved?.path).toBe(path.join(ROOT, 'settings', 'index.html'));
  });

  it('refuses percent-encoded traversal', () => {
    expect(resolveRendererFile('app://bundle/..%2f..%2fsecret.txt', ROOT)).toBeNull();
  });

  it('refuses plain ../ traversal', () => {
    expect(resolveRendererFile('app://bundle/../../secret.txt', ROOT)).toBeNull();
  });

  it('refuses a protocol-relative-looking path', () => {
    expect(resolveRendererFile('app://bundle//etc/passwd', ROOT)).toBeNull();
  });

  it('refuses an absolute Windows drive path', () => {
    expect(resolveRendererFile('app://bundle/C:/Windows/System32/cmd.exe', ROOT)).toBeNull();
  });

  it('strips query and hash before resolving', () => {
    const resolved = resolveRendererFile('app://bundle/app.js?v=2#chunk', ROOT);
    expect(resolved?.path).toBe(path.join(ROOT, 'app.js'));
  });
});

describe('mimeTypeFor', () => {
  it('maps .woff2 to font/woff2', () => {
    expect(mimeTypeFor('font.woff2')).toBe('font/woff2');
  });

  it('maps .css to text/css', () => {
    expect(mimeTypeFor('app.css')).toBe('text/css');
  });

  it('falls back to application/octet-stream for an unknown extension', () => {
    expect(mimeTypeFor('archive.zzz')).toBe('application/octet-stream');
  });
});
