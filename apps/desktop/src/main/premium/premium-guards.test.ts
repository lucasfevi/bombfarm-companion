import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { guardScanner, type FileEntry } from '../guard-scan';

const MAIN_ROOT = resolve(__dirname, '..');
const PREMIUM_DIR = join(MAIN_ROOT, 'premium');
const { readAll } = guardScanner(__filename);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

interface ImportStatement {
  specifier: string;
  typeOnly: boolean;
  names: string;
}

function importsOf(source: string): ImportStatement[] {
  const code = stripComments(source);
  const found: ImportStatement[] = [];
  for (const match of code.matchAll(/\b(?:import|export)\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
    found.push({ specifier: match[3] ?? '', typeOnly: match[1] !== undefined, names: match[2] ?? '' });
  }
  for (const match of code.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) {
    found.push({ specifier: match[1] ?? '', typeOnly: false, names: '' });
  }
  for (const match of code.matchAll(/\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    found.push({ specifier: match[1] ?? '', typeOnly: false, names: '' });
  }
  return found;
}

function reachesGameApi(source: string): boolean {
  return importsOf(source).some((statement) => {
    if (statement.specifier.startsWith('@bombfarm/game-api')) return true;
    if (!/(^|\/)game-api\//.test(statement.specifier)) return false;
    const identityTypeOnly =
      /(^|\/)game-api\/session-token-file(\.js)?$/.test(statement.specifier) &&
      statement.typeOnly &&
      statement.names.replace(/[{}\s]/g, '') === 'GameIdentity';
    return !identityTypeOnly;
  });
}

function namesGameToken(source: string): boolean {
  return /\b(SessionToken|readSessionToken)\b/.test(stripComments(source));
}

function importsTransport(source: string): boolean {
  return importsOf(source).some((statement) => /(^|\/)premium-transport(\.js)?$/.test(statement.specifier));
}

function routesThroughExternalNavigation(source: string): boolean {
  const code = stripComments(source);
  return (
    importsOf(source).some((statement) => /(^|\/)external-navigation(\.js)?$/.test(statement.specifier)) ||
    /\b(applyExternalNavigationPolicy|decideNavigation)\b/.test(code)
  );
}

const premiumFiles = (): FileEntry[] => readAll(PREMIUM_DIR, ['.ts', '.tsx'], { includeTests: true });
const outsidePremiumFiles = (): FileEntry[] =>
  readAll(MAIN_ROOT, ['.ts', '.tsx'], { includeTests: true }).filter((file) => !file.path.startsWith(PREMIUM_DIR + sep));

describe('the premium module stays away from the game token', () => {
  it('scanned the premium sources', () => {
    const paths = premiumFiles().map((file) => file.path);
    expect(paths.some((path) => path.endsWith('premium-service.ts'))).toBe(true);
    expect(paths.some((path) => path.endsWith('premium-transport.ts'))).toBe(true);
    expect(paths.length).toBeGreaterThan(10);
  });

  it('nothing under premium/ imports the game API', () => {
    const offenders = premiumFiles()
      .filter((file) => reachesGameApi(file.source))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it('nothing under premium/ names the game session token', () => {
    const offenders = premiumFiles()
      .filter((file) => namesGameToken(file.source))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it('catches the shapes it exists to catch', () => {
    expect(reachesGameApi("import { createPacingGate } from '@bombfarm/game-api';")).toBe(true);
    expect(reachesGameApi("import type { ConsentState } from '@bombfarm/game-api/consent';")).toBe(true);
    expect(reachesGameApi("import { readSessionToken } from '../game-api/session-token-file.js';")).toBe(true);
    expect(reachesGameApi("import { readGameIdentity } from '../game-api/session-token-file.js';")).toBe(true);
    expect(reachesGameApi("import type { GameIdentity, GrantedConsent } from '../game-api/session-token-file.js';")).toBe(true);
    expect(reachesGameApi("import { createConsentStore } from '../game-api/consent-store.js';")).toBe(true);
    expect(reachesGameApi("const later = await import('@bombfarm/game-api');")).toBe(true);
    expect(namesGameToken('function leak(token: SessionToken) { return token; }')).toBe(true);
    expect(namesGameToken('const read = readSessionToken(consent);')).toBe(true);
  });

  it('lets the identity reader type through and ignores prose', () => {
    expect(reachesGameApi("import type { GameIdentity } from '../game-api/session-token-file.js';")).toBe(false);
    expect(reachesGameApi("// import { x } from '@bombfarm/game-api';\nconst y = 1;")).toBe(false);
    expect(reachesGameApi("import { readSessionTokenBody } from '@bombfarm/contracts';")).toBe(false);
    expect(namesGameToken('// the SessionToken never reaches this file\nconst y = 1;')).toBe(false);
    expect(namesGameToken('const body = readSessionTokenBody(value);')).toBe(false);
  });
});

describe('the premium transport has one importer family', () => {
  it('scanned sources outside premium/', () => {
    const paths = outsidePremiumFiles().map((file) => file.path);
    expect(paths.some((path) => path.endsWith(`${sep}index.ts`))).toBe(true);
    expect(paths.length).toBeGreaterThan(50);
  });

  it('nothing outside premium/ imports premium-transport', () => {
    const offenders = outsidePremiumFiles()
      .filter((file) => importsTransport(file.source))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it('is imported inside premium/, so the rule is not vacuous', () => {
    expect(premiumFiles().some((file) => importsTransport(file.source))).toBe(true);
  });

  it('catches the shapes it exists to catch', () => {
    expect(importsTransport("import { createPremiumHttp } from './premium/premium-transport.js';")).toBe(true);
    expect(importsTransport("import type { PremiumHttp } from '../premium/premium-transport';")).toBe(true);
    expect(importsTransport("// import { createPremiumHttp } from './premium/premium-transport.js';")).toBe(false);
    expect(importsTransport("import { createElectronPremium } from './premium/index.js';")).toBe(false);
  });
});

describe('premium URLs never go through external navigation', () => {
  it('nothing under premium/ uses external navigation', () => {
    const offenders = premiumFiles()
      .filter((file) => routesThroughExternalNavigation(file.source))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it('catches the shapes it exists to catch', () => {
    expect(routesThroughExternalNavigation("import { applyExternalNavigationPolicy } from '../external-navigation.js';")).toBe(true);
    expect(routesThroughExternalNavigation('const verdict = decideNavigation(url, origin);')).toBe(true);
    expect(routesThroughExternalNavigation("import { shell } from 'electron';\nvoid shell.openExternal(url);")).toBe(false);
  });
});

const RENDERER_ROOT = resolve(MAIN_ROOT, '..', '..', 'renderer');
const PREMIUM_STORE_FILE = 'lib/premium/use-premium.ts';
const FULL_HOOK_IMPORTERS: ReadonlySet<string> = new Set(['app/premium/premium-view.tsx', 'app/settings/premium-section.tsx']);
const VISIBILITY_HOOK_IMPORTERS: ReadonlySet<string> = new Set(['app/page.tsx']);

function rendererPath(path: string): string {
  return relative(RENDERER_ROOT, path).split(sep).join('/');
}

function readsPremiumOutsideItsSurface(file: FileEntry): boolean {
  const where = rendererPath(file.path);
  return importsOf(file.source).some((statement) => {
    if (/(^|\/)premium-store(\.js)?$/.test(statement.specifier)) return where !== PREMIUM_STORE_FILE;
    if (!/(^|\/)use-premium(\.js)?$/.test(statement.specifier)) return false;
    const wantsFull = /\busePremium\b/.test(statement.names);
    const wantsVisibility = /\busePremiumVisible\b/.test(statement.names);
    if (wantsFull && !FULL_HOOK_IMPORTERS.has(where)) return true;
    if (wantsVisibility && !VISIBILITY_HOOK_IMPORTERS.has(where)) return true;
    return !wantsFull && !wantsVisibility;
  });
}

const rendererFiles = (): FileEntry[] => readAll(RENDERER_ROOT, ['.ts', '.tsx']);

describe('only the Premium surface and its Settings section read the Premium status', () => {
  it('scanned the renderer sources, including the files the rule allows', () => {
    const paths = rendererFiles().map((file) => rendererPath(file.path));
    expect(paths.length).toBeGreaterThan(100);
    for (const allowed of [...FULL_HOOK_IMPORTERS, ...VISIBILITY_HOOK_IMPORTERS, PREMIUM_STORE_FILE]) {
      expect(paths).toContain(allowed);
    }
  });

  it('no renderer file outside them imports the premium hook or its store', () => {
    const offenders = rendererFiles()
      .filter(readsPremiumOutsideItsSurface)
      .map((file) => rendererPath(file.path));
    expect(offenders).toEqual([]);
  });

  it('is not vacuous: the surface, its section and the shell each do import the hook', () => {
    const importers = rendererFiles()
      .filter((file) => importsOf(file.source).some((statement) => /(^|\/)use-premium(\.js)?$/.test(statement.specifier)))
      .map((file) => rendererPath(file.path))
      .sort();
    expect(importers).toEqual(['app/page.tsx', 'app/premium/premium-view.tsx', 'app/settings/premium-section.tsx']);
  });

  it('the shell asks only whether the tab is visible', () => {
    const page = rendererFiles().find((file) => rendererPath(file.path) === 'app/page.tsx');
    const statement = importsOf(page?.source ?? '').find((entry) => /use-premium/.test(entry.specifier));
    expect(statement?.names.replace(/[{}\s]/g, '')).toBe('usePremiumVisible');
  });

  it('catches the shapes it exists to catch', () => {
    const fixture = (where: string, source: string): FileEntry => ({ path: join(RENDERER_ROOT, ...where.split('/')), source });
    expect(
      readsPremiumOutsideItsSurface(fixture('app/farm/farm-view.tsx', "import { usePremium } from '../../lib/premium/use-premium';")),
    ).toBe(true);
    expect(
      readsPremiumOutsideItsSurface(fixture('app/farm/farm-view.tsx', "import { usePremiumVisible } from '../../lib/premium/use-premium';")),
    ).toBe(true);
    expect(
      readsPremiumOutsideItsSurface(fixture('app/page.tsx', "import { usePremium } from '../lib/premium/use-premium';")),
    ).toBe(true);
    expect(
      readsPremiumOutsideItsSurface(fixture('app/farm/farm-view.tsx', "import { createPremiumStore } from '../../lib/premium/premium-store';")),
    ).toBe(true);
    expect(
      readsPremiumOutsideItsSurface(fixture('app/farm/farm-view.tsx', "import * as premium from '../../lib/premium/use-premium';")),
    ).toBe(true);
  });

  it('lets the allowed importers and prose through', () => {
    const fixture = (where: string, source: string): FileEntry => ({ path: join(RENDERER_ROOT, ...where.split('/')), source });
    expect(
      readsPremiumOutsideItsSurface(fixture('app/premium/premium-view.tsx', "import { usePremium } from '../../lib/premium/use-premium';")),
    ).toBe(false);
    expect(
      readsPremiumOutsideItsSurface(fixture('app/page.tsx', "import { usePremiumVisible } from '../lib/premium/use-premium';")),
    ).toBe(false);
    expect(
      readsPremiumOutsideItsSurface(fixture('app/farm/farm-view.tsx', "// import { usePremium } from '../../lib/premium/use-premium';\nconst x = 1;")),
    ).toBe(false);
  });
});
