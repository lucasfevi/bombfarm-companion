import { transform } from 'esbuild';
import { runInThisContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { PREMIUM_SHARED_MODULES } from '@bombfarm/contracts';
import { parseCspManifest } from '../../renderer-csp.js';
import { registerRendererProtocol, serveRendererRequest } from '../../renderer-protocol.js';
import {
  createPremiumRoutes,
  shimFileName,
  SHARED_GLOBAL,
  type PremiumRoutes,
  type ServedBundle,
} from './premium-routes.js';

const handle = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({ protocol: { registerSchemesAsPrivileged: vi.fn(), handle } }));

const ROOT = 'C:\\app\\renderer\\out';
const MANIFEST = parseCspManifest({ version: 1, pages: {} });
const LOCKED_DOWN = "default-src 'none'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const UI_JS = new TextEncoder().encode('export default function Panel() { return null; }\n');
const UI_CSS = new TextEncoder().encode('.panel { color: red; }\n');
const WORKER = new TextEncoder().encode('module.exports = {};\n');

const SHIMS: Record<string, string[]> = {
  react: ['useState', 'createElement'],
  'react/jsx-runtime': ['jsx', 'jsxs', 'Fragment'],
  'react-dom': ['createPortal'],
  'react/compiler-runtime': ['c'],
  '@bombfarm/ui': ['Button', 'Banner'],
};

function served(sequence = 4): ServedBundle {
  return {
    sequence,
    files: new Map([
      ['ui/index.js', UI_JS],
      ['ui/index.css', UI_CSS],
      ['worker/index.cjs', WORKER],
    ]),
  };
}

function routesFor(active: ServedBundle | null): PremiumRoutes {
  return createPremiumRoutes({ shims: SHIMS, active: () => active });
}

/** A read that fails the test if the disk is asked for anything. */
function forbiddenRead() {
  return vi.fn((_path: string): Promise<Uint8Array> => Promise.reject(new Error('the disk must not be read')));
}

function serve(url: string, active: ServedBundle | null = served()) {
  const read = forbiddenRead();
  const response = serveRendererRequest(url, ROOT, MANIFEST, read, routesFor(active));
  return { response, read };
}

/** Runs a shim's text against a stand-in for the table the renderer sets, and returns its exports. */
async function evaluateShim(source: string, table: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { code } = await transform(source, { format: 'cjs', loader: 'js' });
  const holder = globalThis as unknown as Record<string, unknown>;
  holder[SHARED_GLOBAL] = table;
  try {
    const module = { exports: {} as Record<string, unknown> };
    const run = runInThisContext(`(function (module, exports) {${code}
})`) as (m: unknown, e: unknown) => void;
    run(module, module.exports);
    return module.exports;
  } finally {
    holder[SHARED_GLOBAL] = undefined;
  }
}

describe('the bundle UI files', () => {
  it.each([
    ['ui/index.js', 'text/javascript', UI_JS],
    ['ui/index.css', 'text/css', UI_CSS],
  ])('serves %s byte for byte from memory, with the locked-down headers', async (file, mime, bytes) => {
    const { response, read } = serve(`app://bundle/_premium/4/${file}`);
    const reply = await response;
    expect(reply.status).toBe(200);
    expect(Buffer.from(await reply.arrayBuffer()).equals(Buffer.from(bytes))).toBe(true);
    expect(reply.headers.get('content-type')).toBe(mime);
    expect(reply.headers.get('content-security-policy')).toBe(LOCKED_DOWN);
    expect(reply.headers.get('x-content-type-options')).toBe('nosniff');
    expect(reply.headers.get('cache-control')).toBe('no-store');
    expect(read).not.toHaveBeenCalled();
  });

  it('serves the local build under sequence 0', async () => {
    const { response } = serve('app://bundle/_premium/0/ui/index.js', served(0));
    expect((await response).status).toBe(200);
  });

  it('serves what is in memory now, not what was there when the routes were made', async () => {
    let active: ServedBundle | null = served(4);
    const routes = createPremiumRoutes({ shims: SHIMS, active: () => active });
    const url = 'app://bundle/_premium/5/ui/index.js';
    const before = await serveRendererRequest(url, ROOT, MANIFEST, forbiddenRead(), routes);
    expect(before.status).toBe(404);
    active = served(5);
    const after = await serveRendererRequest(url, ROOT, MANIFEST, forbiddenRead(), routes);
    expect(after.status).toBe(200);
  });

  it.each([
    ['another sequence', 'app://bundle/_premium/3/ui/index.js'],
    ['the worker half', 'app://bundle/_premium/4/worker/index.cjs'],
    ['a file the bundle does not hold', 'app://bundle/_premium/4/ui/other.js'],
    ['a directory', 'app://bundle/_premium/4/ui/'],
    ['the sequence folder', 'app://bundle/_premium/4'],
    ['the prefix alone', 'app://bundle/_premium/'],
    ['the prefix with no slash', 'app://bundle/_premium'],
    ['an unknown shim', 'app://bundle/_premium/_shared/lodash.js'],
    ['a shim with a path below it', 'app://bundle/_premium/_shared/react/extra.js'],
    ['traversal', 'app://bundle/_premium/4/ui/../worker/index.cjs'],
    ['encoded traversal', 'app://bundle/_premium/4/ui/..%2fworker%2findex.cjs'],
    ['an encoded slash in the sequence', 'app://bundle/_premium/4%2fui/index.js'],
    ['a doubled slash', 'app://bundle/_premium//4/ui/index.js'],
    ['a dot segment before the prefix', 'app://bundle/./_premium/4/ui/index.js'],
    ['another case', 'app://bundle/_PREMIUM/4/ui/index.js'],
    ['an encoded prefix', 'app://bundle/%5Fpremium/4/ui/index.js'],
    ['a leading zero in the sequence', 'app://bundle/_premium/04/ui/index.js'],
  ])('answers 404 for %s without reading the disk', async (_name, url) => {
    const { response, read } = serve(url);
    const reply = await response;
    expect(reply.status).toBe(404);
    expect(reply.headers.get('content-security-policy')).toBe(LOCKED_DOWN);
    expect(reply.headers.get('x-content-type-options')).toBe('nosniff');
    expect(read).not.toHaveBeenCalled();
  });

  it('answers 404 for everything under _premium while no bundle is active', async () => {
    for (const url of ['app://bundle/_premium/4/ui/index.js', 'app://bundle/_premium/_shared/react.js']) {
      const { response, read } = serve(url, null);
      expect((await response).status).toBe(404);
      expect(read).not.toHaveBeenCalled();
    }
  });

  it('answers 404 under _premium when the handler was given no routes at all', async () => {
    const read = forbiddenRead();
    const reply = await serveRendererRequest('app://bundle/_premium/4/ui/index.js', ROOT, MANIFEST, read);
    expect(reply.status).toBe(404);
    expect(read).not.toHaveBeenCalled();
  });

  it('leaves every other path to the file lookup', async () => {
    const read = vi.fn((_path: string) => Promise.resolve(new TextEncoder().encode('page')));
    const reply = await serveRendererRequest('app://bundle/premium/4/ui/index.js', ROOT, MANIFEST, read, routesFor(served()));
    expect(reply.status).toBe(200);
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe('the shared-module shims', () => {
  it.each(PREMIUM_SHARED_MODULES)('serves the shim for %s as JavaScript with the same headers', async (name) => {
    const { response, read } = serve(`app://bundle/_premium/_shared/${shimFileName(name)}`);
    const reply = await response;
    expect(reply.status).toBe(200);
    expect(reply.headers.get('content-type')).toBe('text/javascript');
    expect(reply.headers.get('content-security-policy')).toBe(LOCKED_DOWN);
    expect(reply.headers.get('x-content-type-options')).toBe('nosniff');
    expect(reply.headers.get('cache-control')).toBe('no-store');
    expect(read).not.toHaveBeenCalled();
  });

  it('names the files without a slash', () => {
    expect(PREMIUM_SHARED_MODULES.map(shimFileName)).toEqual([
      'react.js',
      'react__jsx-runtime.js',
      'react-dom.js',
      'react__compiler-runtime.js',
      '@bombfarm__ui.js',
    ]);
  });

  it.each(PREMIUM_SHARED_MODULES)('the shim for %s exports exactly its listed names from the live table', async (name) => {
    const resource = routesFor(served()).resolve(`/_premium/_shared/${shimFileName(name)}`);
    expect(resource).not.toBeNull();
    const names = SHIMS[name] ?? [];
    const live = Object.fromEntries(names.map((n) => [n, { live: n }]));
    const exported = await evaluateShim(new TextDecoder().decode(resource?.bytes), { [name]: live });

    expect(Object.keys(exported).filter((key) => key !== 'default' && key !== '__esModule').sort()).toEqual(
      [...names].sort(),
    );
    for (const n of names) expect(exported[n]).toBe(live[n]);
    expect(exported['default']).toBe(live);
  });

  it("prefers a module's own default export for the default", async () => {
    const resource = routesFor(served()).resolve('/_premium/_shared/react.js');
    const own = {};
    const exported = await evaluateShim(new TextDecoder().decode(resource?.bytes), {
      react: { default: own, useState: 1, createElement: 2 },
    });
    expect(exported['default']).toBe(own);
  });
});

describe('registerRendererProtocol with Premium routes', () => {
  it('hands the routes to the app:// handler', async () => {
    registerRendererProtocol(ROOT, MANIFEST, routesFor(served()));
    const handler = handle.mock.calls.at(-1)?.[1] as (request: { url: string }) => Promise<Response>;
    const reply = await handler({ url: 'app://bundle/_premium/4/ui/index.css' });
    expect(reply.status).toBe(200);
    expect(reply.headers.get('content-type')).toBe('text/css');
  });
});
