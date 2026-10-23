import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { guardScanner } from './guard-scan';

const SRC_ROOT = resolve(__dirname, '..');
const MAIN_INDEX = resolve(__dirname, 'index.ts');
const MINI_LIVE_WINDOW = resolve(__dirname, 'mini-live-window.ts');

const { readAll } = guardScanner(__filename);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const WEAKENINGS: [string, RegExp][] = [
  ['sandbox: false', /\bsandbox\s*:\s*false\b/],
  ['nodeIntegration: true', /\bnodeIntegration\s*:\s*true\b/],
  ['nodeIntegrationInWorker: true', /\bnodeIntegrationInWorker\s*:\s*true\b/],
  ['nodeIntegrationInSubFrames: true', /\bnodeIntegrationInSubFrames\s*:\s*true\b/],
  ['contextIsolation: false', /\bcontextIsolation\s*:\s*false\b/],
  ['webSecurity: false', /\bwebSecurity\s*:\s*false\b/],
  ['allowRunningInsecureContent: true', /\ballowRunningInsecureContent\s*:\s*true\b/],
  ['webviewTag: true', /\bwebviewTag\s*:\s*true\b/],
  ['no-sandbox', /no-sandbox/],
  ['disable-gpu-sandbox', /disable-gpu-sandbox/],
];

const OTHER_WEB_CONTENTS_HOSTS: [string, RegExp][] = [
  ['BrowserView', /\bBrowserView\b/],
  ['WebContentsView', /\bWebContentsView\b/],
  ['<webview', /<webview\b/],
];

function weakeningsIn(source: string): string[] {
  const code = stripComments(source);
  return WEAKENINGS.filter(([, pattern]) => pattern.test(code)).map(([name]) => name);
}

function webPreferencesNotFromSandboxedBuilder(source: string): number {
  const code = stripComments(source);
  const all = [...code.matchAll(/\bwebPreferences\s*:/g)].length;
  const sanctioned = [...code.matchAll(/\bwebPreferences\s*:\s*sandboxedWebPreferences\(/g)].length;
  return all - sanctioned;
}

function otherHostsIn(source: string): string[] {
  const code = stripComments(source);
  return OTHER_WEB_CONTENTS_HOSTS.filter(([, pattern]) => pattern.test(code)).map(([name]) => name);
}

describe('renderer windows stay sandboxed', () => {
  const sources = readAll(SRC_ROOT, ['.ts']);

  it('scans the main and preload trees', () => {
    expect(sources.length).toBeGreaterThanOrEqual(90);
  });

  it('weakens no web preference and passes no flag that turns the sandbox off', () => {
    const offenders = sources
      .map((file) => ({ file: relative(SRC_ROOT, file.path), found: weakeningsIn(file.source) }))
      .filter((entry) => entry.found.length > 0);

    expect(offenders).toEqual([]);
  });

  it('builds every window\'s web preferences from sandboxedWebPreferences', () => {
    const offenders = sources
      .filter((file) => webPreferencesNotFromSandboxedBuilder(file.source) > 0)
      .map((file) => relative(SRC_ROOT, file.path));

    expect(offenders).toEqual([]);
  });

  it('gives both windows that builder', () => {
    const byPath = new Map(sources.map((file) => [file.path, file.source]));

    for (const path of [MAIN_INDEX, MINI_LIVE_WINDOW]) {
      const source = byPath.get(path) ?? '';
      expect(stripComments(source), relative(SRC_ROOT, path)).toMatch(
        /\bwebPreferences\s*:\s*sandboxedWebPreferences\(/,
      );
    }
  });

  it('opens windows only from the two files that hand them the builder', () => {
    const creators = sources
      .filter((file) => /\bnew\s+BrowserWindow\b|\bBrowserWindowCtor\s*\(/.test(stripComments(file.source)))
      .map((file) => file.path)
      .sort();

    expect(creators).toEqual([MAIN_INDEX, MINI_LIVE_WINDOW].sort());
  });

  it('hosts no web content in a view, webview or other process Electron would not sandbox the same way', () => {
    const offenders = sources
      .map((file) => ({ file: relative(SRC_ROOT, file.path), found: otherHostsIn(file.source) }))
      .filter((entry) => entry.found.length > 0);

    expect(offenders).toEqual([]);
  });

  it('asks Electron to sandbox every renderer before the app is ready', () => {
    const code = stripComments(sources.find((file) => file.path === MAIN_INDEX)?.source ?? '');
    const enableAt = code.indexOf('app.enableSandbox()');
    const readyAt = code.indexOf('app.whenReady()');

    expect(enableAt).toBeGreaterThan(-1);
    expect(readyAt).toBeGreaterThan(enableAt);
  });

  it('red state demonstrated: each weakening is caught', () => {
    expect(weakeningsIn('webPreferences: { sandbox: false }')).toEqual(['sandbox: false']);
    expect(weakeningsIn('{ nodeIntegration: true, contextIsolation: false }')).toEqual([
      'nodeIntegration: true',
      'contextIsolation: false',
    ]);
    expect(weakeningsIn("app.commandLine.appendSwitch('no-sandbox')")).toEqual(['no-sandbox']);
    expect(weakeningsIn("args: ['--no-sandbox']")).toEqual(['no-sandbox']);
    expect(weakeningsIn("appendSwitch('disable-gpu-sandbox')")).toEqual(['disable-gpu-sandbox']);
  });

  it('red state demonstrated: hand-written web preferences are caught', () => {
    expect(webPreferencesNotFromSandboxedBuilder('new BrowserWindow({ webPreferences: { preload } })')).toBe(1);
    expect(
      webPreferencesNotFromSandboxedBuilder('new BrowserWindow({ webPreferences: sandboxedWebPreferences(p) })'),
    ).toBe(0);
  });

  it('red state demonstrated: a view or webview is caught', () => {
    expect(otherHostsIn('new WebContentsView({})')).toEqual(['WebContentsView']);
    expect(otherHostsIn('<webview src="x" />')).toEqual(['<webview']);
  });

  it('ignores a weakening named only in a comment', () => {
    expect(weakeningsIn('// sandbox: false would break the preload\nconst x = 1;')).toEqual([]);
  });
});
