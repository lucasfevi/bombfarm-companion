import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mimeTypeFor, resolveRendererFile } from './renderer-protocol.js';

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
