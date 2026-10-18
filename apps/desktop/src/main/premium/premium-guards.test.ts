import { join, resolve, sep } from 'node:path';
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
