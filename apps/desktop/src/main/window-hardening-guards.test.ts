import { join, relative, resolve } from 'node:path';
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
  const all = [...code.matchAll(/\bwebPreferences\b/g)].length;
  const sanctioned = [...code.matchAll(/\bwebPreferences\s*:\s*sandboxedWebPreferences\(/g)].length;
  return all - sanctioned;
}

function otherHostsIn(source: string): string[] {
  const code = stripComments(source);
  return OTHER_WEB_CONTENTS_HOSTS.filter(([, pattern]) => pattern.test(code)).map(([name]) => name);
}

const WINDOW_CLASSES = ['BrowserWindow', 'BaseWindow', 'WebContentsView'];

function withoutStrings(code: string): string {
  return code.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');
}

function windowImportsFromElectron(source: string): string[] {
  const code = stripComments(source);
  const found: string[] = [];

  for (const match of code.matchAll(/\b(?:import|export)\s+(type\s+)?([^;]*?)\s*from\s*['"]electron['"]/g)) {
    if (match[1]) continue;
    const clause = (match[2] ?? '').trim();
    const named = /\{([^}]*)\}/.exec(clause);
    if (!named || clause.replace(/\{[^}]*\}/, '').replace(/[,\s]/g, '') !== '') {
      found.push('whole electron module');
    }
    for (const specifier of (named?.[1] ?? '').split(',')) {
      const trimmed = specifier.trim();
      if (trimmed === '' || /^type\s/.test(trimmed)) continue;
      const imported = (trimmed.split(/\s+as\s+/)[0] ?? '').trim();
      if (WINDOW_CLASSES.includes(imported)) found.push(imported);
    }
  }

  if (/\brequire\s*\(\s*['"]electron['"]\s*\)|\bimport\s*\(\s*['"]electron['"]\s*\)/.test(code)) {
    found.push('whole electron module');
  }

  return found;
}

function webPreferenceAssignmentsIn(source: string): string[] {
  const code = stripComments(source);
  const pattern =
    /(?:\.\s*|\[\s*['"])(sandbox|nodeIntegration|contextIsolation)(?:['"]\s*\])?\s*(?:[-+*/%&|^]|\*\*|<<|>>>?|&&|\|\||\?\?)?=(?!=)/g;
  return [...code.matchAll(pattern)].map((match) => match[1] ?? '');
}

function definesSecurityPreferenceKey(source: string): boolean {
  return /\b(?:sandbox|nodeIntegration|contextIsolation)\s*:/.test(stripComments(source));
}

function enableSandboxAtModuleTopLevel(source: string): boolean {
  const code = withoutStrings(stripComments(source));
  const call = /^app\.enableSandbox\(\);/m.exec(code);
  if (!call) return false;
  const before = code.slice(0, call.index);
  const opened = (before.match(/\{/g) ?? []).length;
  const closed = (before.match(/\}/g) ?? []).length;
  return opened === closed;
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

  it('asks Electron to sandbox every renderer at module top level, before the app is ready', () => {
    const source = sources.find((file) => file.path === MAIN_INDEX)?.source ?? '';
    const code = stripComments(source);

    expect(enableSandboxAtModuleTopLevel(source)).toBe(true);
    expect(code.search(/^app\.enableSandbox\(\);/m)).toBeLessThan(code.indexOf('app.whenReady()'));
  });

  it('imports a window class from electron in no file but the two that build windows', () => {
    const offenders = sources
      .filter((file) => file.path !== MAIN_INDEX && file.path !== MINI_LIVE_WINDOW)
      .map((file) => ({ file: relative(SRC_ROOT, file.path), found: windowImportsFromElectron(file.source) }))
      .filter((entry) => entry.found.length > 0);

    expect(offenders).toEqual([]);
  });

  it('assigns no security-relevant web preference anywhere', () => {
    const offenders = sources
      .map((file) => ({ file: relative(SRC_ROOT, file.path), found: webPreferenceAssignmentsIn(file.source) }))
      .filter((entry) => entry.found.length > 0);

    expect(offenders).toEqual([]);
  });

  it('spells the sandbox, isolation and node-integration keys only in the builder', () => {
    const spellers = sources
      .filter((file) => definesSecurityPreferenceKey(file.source))
      .map((file) => relative(SRC_ROOT, file.path));

    expect(spellers).toEqual([join('main', 'web-preferences.ts')]);
  });

  it('red state demonstrated: an aliased window import is caught, a type-only one is not', () => {
    expect(windowImportsFromElectron("import { BrowserWindow as BW } from 'electron';")).toEqual(['BrowserWindow']);
    expect(windowImportsFromElectron("import { app, type BaseWindow, WebContentsView } from 'electron';")).toEqual([
      'WebContentsView',
    ]);
    expect(windowImportsFromElectron("import type { BrowserWindow } from 'electron';")).toEqual([]);
    expect(windowImportsFromElectron("import { app, net } from 'electron';")).toEqual([]);
  });

  it('red state demonstrated: reaching the classes through the whole module is caught', () => {
    expect(windowImportsFromElectron("import * as e from 'electron';")).toEqual(['whole electron module']);
    expect(windowImportsFromElectron("import electron from 'electron';")).toEqual(['whole electron module']);
    expect(windowImportsFromElectron("const e = require('electron');")).toEqual(['whole electron module']);
    expect(windowImportsFromElectron("export { BaseWindow } from 'electron';")).toEqual(['BaseWindow']);
    expect(
      windowImportsFromElectron("import {\n  app,\n  BrowserWindow as BW,\n} from 'electron';"),
    ).toEqual(['BrowserWindow']);
  });

  it('red state demonstrated: assigning a security preference is caught', () => {
    expect(webPreferenceAssignmentsIn('webPreferences.sandbox = !true;')).toEqual(['sandbox']);
    expect(webPreferenceAssignmentsIn("prefs['nodeIntegration'] = flag;")).toEqual(['nodeIntegration']);
    expect(webPreferenceAssignmentsIn('prefs.contextIsolation &&= other;')).toEqual(['contextIsolation']);
    expect(webPreferenceAssignmentsIn('if (prefs.sandbox === true) {}')).toEqual([]);
  });

  it('red state demonstrated: a computed value for a security key is caught', () => {
    expect(definesSecurityPreferenceKey('{ sandbox: !true }')).toBe(true);
    expect(definesSecurityPreferenceKey('{ ...sandboxedWebPreferences(p), nodeIntegration: x }')).toBe(true);
    expect(definesSecurityPreferenceKey('sandboxedWebPreferences(p)')).toBe(false);
  });

  it('red state demonstrated: shorthand web preferences are caught', () => {
    expect(webPreferencesNotFromSandboxedBuilder('new BW({ webPreferences })')).toBe(1);
  });

  it('red state demonstrated: enableSandbox inside a function is not top level', () => {
    const inFunction = 'async function bootstrap() {\napp.enableSandbox();\n}\napp.whenReady();';
    const indented = 'async function bootstrap() {\n  app.enableSandbox();\n}\napp.whenReady();';
    const conditional = 'if (x) app.enableSandbox();\napp.whenReady();';

    expect(enableSandboxAtModuleTopLevel(inFunction)).toBe(false);
    expect(enableSandboxAtModuleTopLevel(indented)).toBe(false);
    expect(enableSandboxAtModuleTopLevel(conditional)).toBe(false);
    expect(enableSandboxAtModuleTopLevel('app.enableSandbox();\napp.whenReady();')).toBe(true);
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
