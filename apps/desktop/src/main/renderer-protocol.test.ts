import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isRendererUrl, mimeTypeFor, resolveRendererFile } from './renderer-protocol.js';

const ROOT = path.join('C:', 'app', 'renderer', 'out');

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

describe('resolveRendererFile — only the bundle host is served', () => {
  it.each([
    'app://other-host/index.html',
    'app://bundle.evil/index.html',
    'app://evilbundle/index.html',
    'app://bundle@evil/index.html',
    'app://bundle:secret@evil/index.html',
    'app://bundle:80/index.html',
    'app://BUNDLE.evil/index.html',
    'app:///index.html',
    'https://bundle/index.html',
    'file:///C:/app/index.html',
    '/index.html',
    '',
  ])('refuses %s', (url) => {
    expect(resolveRendererFile(url, ROOT)).toBeNull();
  });
});

describe('isRendererUrl', () => {
  it('is true for the bundle host on any path, query or fragment', () => {
    expect(isRendererUrl('app://bundle')).toBe(true);
    expect(isRendererUrl('app://bundle/mini-live/index.html?x=1#y')).toBe(true);
  });

  it('is false for a look-alike host, a credential, a port or another scheme', () => {
    expect(isRendererUrl('app://bundle.evil/')).toBe(false);
    expect(isRendererUrl('app://user@bundle/')).toBe(false);
    expect(isRendererUrl('app://bundle:8080/')).toBe(false);
    expect(isRendererUrl('http://bundle/')).toBe(false);
    expect(isRendererUrl('not a url')).toBe(false);
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
