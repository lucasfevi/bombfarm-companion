import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CSP_MANIFEST_FILE,
  CspManifestInvalidError,
  cspManifestForBoot,
  documentPolicy,
  loadCspManifest,
  parseCspManifest,
  SUBRESOURCE_POLICY,
} from './renderer-csp.js';

const HASH_A = `sha256-${'A'.repeat(43)}=`;
const HASH_B = `sha256-${'B'.repeat(43)}=`;
const HASH_C = `sha256-${'C'.repeat(43)}=`;

const manifestWith = (pages: Record<string, unknown>) => ({ version: 1, pages });
const page = (scripts: string[] = [], styleElements: string[] = [], styleAttributes: string[] = []) => ({
  scripts,
  styleElements,
  styleAttributes,
});

function directive(policy: string, name: string): string | undefined {
  return policy.split('; ').find((part) => part === name || part.startsWith(`${name} `));
}

describe('documentPolicy', () => {
  const policy = documentPolicy({ scripts: [HASH_A, HASH_B], styleElements: [HASH_C], styleAttributes: [HASH_A] });

  it('allows scripts from the bundle and the hashed inline ones, and nothing more', () => {
    expect(directive(policy, 'script-src')).toBe(`script-src 'self' '${HASH_A}' '${HASH_B}'`);
  });

  it.each(["'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'", "'strict-dynamic'", ' * ', 'http:', 'https:'])(
    'never contains %s',
    (token) => {
      expect(policy).not.toContain(token);
    },
  );

  it('starts from nothing allowed', () => {
    expect(directive(policy, 'default-src')).toBe("default-src 'none'");
  });

  it('keeps every fetch directive on the bundle', () => {
    expect(directive(policy, 'connect-src')).toBe("connect-src 'self'");
    expect(directive(policy, 'font-src')).toBe("font-src 'self'");
    expect(directive(policy, 'worker-src')).toBe("worker-src 'self'");
    expect(directive(policy, 'img-src')).toBe("img-src 'self' data:");
  });

  it('shuts embedding, plugins and form posts', () => {
    for (const closed of ['object-src', 'frame-src', 'form-action', 'frame-ancestors']) {
      expect(directive(policy, closed)).toBe(`${closed} 'none'`);
    }
  });

  it('lets a <base> point only back into the bundle, which the share card needs to inline its fonts', () => {
    expect(directive(policy, 'base-uri')).toBe("base-uri 'self'");
  });

  it('hashes style elements into style-src and style attributes into style-src-attr', () => {
    expect(directive(policy, 'style-src')).toBe(`style-src 'self' '${HASH_C}'`);
    expect(directive(policy, 'style-src-attr')).toBe(`style-src-attr 'unsafe-hashes' '${HASH_A}'`);
  });

  it('closes style attributes entirely for a page that has none', () => {
    expect(directive(documentPolicy(page()), 'style-src-attr')).toBe("style-src-attr 'none'");
  });

  it('allows no inline code on a page the build did not list', () => {
    const unlisted = documentPolicy(undefined);
    expect(directive(unlisted, 'script-src')).toBe("script-src 'self'");
    expect(directive(unlisted, 'style-src')).toBe("style-src 'self'");
    expect(unlisted).not.toContain('sha256-');
  });
});

describe('SUBRESOURCE_POLICY', () => {
  it('lets a worker load its own bundle chunks and nothing else', () => {
    expect(directive(SUBRESOURCE_POLICY, 'default-src')).toBe("default-src 'none'");
    expect(directive(SUBRESOURCE_POLICY, 'script-src')).toBe("script-src 'self'");
    expect(SUBRESOURCE_POLICY).not.toContain('unsafe');
  });
});

describe('parseCspManifest', () => {
  it('reads each page into its three hash lists', () => {
    const parsed = parseCspManifest(manifestWith({ 'index.html': page([HASH_A], [HASH_B], [HASH_C]) }));
    expect(parsed.pages.get('index.html')).toEqual({ scripts: [HASH_A], styleElements: [HASH_B], styleAttributes: [HASH_C] });
  });

  it.each([
    ['null', null],
    ['a string', 'x'],
    ['another version', { version: 2, pages: {} }],
    ['no version', { pages: {} }],
    ['no pages', { version: 1 }],
    ['a page that is not an object', manifestWith({ 'index.html': 'x' })],
    ['a missing list', manifestWith({ 'index.html': { scripts: [], styleElements: [] } })],
    ['a list that is not a list', manifestWith({ 'index.html': { ...page(), scripts: HASH_A } })],
    ['a non-string hash', manifestWith({ 'index.html': page([42 as unknown as string]) })],
    ['a short hash', manifestWith({ 'index.html': page(['sha256-AAAA']) })],
    ['a sha512 hash', manifestWith({ 'index.html': page([`sha512-${'A'.repeat(43)}=`]) })],
  ])('rejects %s', (_name, raw) => {
    expect(() => parseCspManifest(raw)).toThrow(CspManifestInvalidError);
  });

  it('refuses a hash that smuggles another directive into the policy', () => {
    const smuggled = `${HASH_A}'; script-src * '`;
    expect(() => parseCspManifest(manifestWith({ 'index.html': page([smuggled]) }))).toThrow(CspManifestInvalidError);
  });
});

describe('cspManifestForBoot', () => {
  const noBuild = path.join(os.tmpdir(), 'bfc-csp-no-such-build');

  it('lists no pages for a dev run, which has no export to read', () => {
    expect(cspManifestForBoot(true, noBuild).pages.size).toBe(0);
  });

  it('refuses a packaged run whose build has no manifest', () => {
    expect(() => cspManifestForBoot(false, noBuild)).toThrow(CspManifestInvalidError);
  });
});

describe('loadCspManifest', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'bfc-csp-load-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reads the manifest from the renderer root', () => {
    writeFileSync(path.join(root, CSP_MANIFEST_FILE), JSON.stringify(manifestWith({ 'index.html': page([HASH_A]) })));
    expect(loadCspManifest(root).pages.get('index.html')?.scripts).toEqual([HASH_A]);
  });

  it('fails loudly when the build did not write one', () => {
    expect(() => loadCspManifest(root)).toThrow(/csp-manifest-invalid:missing:csp-manifest\.json/);
  });

  it('fails loudly on a manifest that is not JSON', () => {
    writeFileSync(path.join(root, CSP_MANIFEST_FILE), '{not json');
    expect(() => loadCspManifest(root)).toThrow(/csp-manifest-invalid:not-json/);
  });
});
