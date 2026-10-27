import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { guardScanner, isTestFile } from '../guard-scan';

/**
 * The files outside tests that may ask the gate whether premium code may run, or subscribe to its
 * changes. Empty until premium code exists: adding a caller means adding it here, on purpose.
 */
const PREMIUM_ACCOUNT_GATE_CALLERS: readonly string[] = [];

/** The one file that hands the app's state to the Premium service, its only writer. */
const PLAYING_ACCOUNT_WRITERS: readonly string[] = ['src/main/premium/index.ts'];

const DESKTOP_ROOT = resolve(__dirname, '..', '..', '..');
const GATE_MODULE = join(__dirname, 'playing-account-gate.ts');
const GATE_NAMES = /\b(premiumAccountAllows|onPremiumAccountChange)\b/;
const STATE_NAME = /\bappPlayingAccount\b/;
const { readAll } = guardScanner(__filename);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const desktopSources = () =>
  [
    ...readAll(join(DESKTOP_ROOT, 'src'), ['.ts', '.tsx', '.mjs'], { includeTests: true }),
    ...readAll(join(DESKTOP_ROOT, 'renderer'), ['.ts', '.tsx', '.mjs'], { includeTests: true }),
    ...readAll(join(DESKTOP_ROOT, 'tests'), ['.ts', '.tsx', '.mjs'], { includeTests: true }),
  ];

const asListed = (path: string): string => relative(DESKTOP_ROOT, path).split(sep).join('/');

describe('who may call the premium account gate', () => {
  it('sees the gate module itself, so the scan is not vacuous', () => {
    const gate = desktopSources().find((file) => file.path === GATE_MODULE);

    expect(gate).toBeDefined();
    expect(GATE_NAMES.test(stripComments(gate?.source ?? ''))).toBe(true);
  });

  it('is called from no file outside tests except the listed callers, and none are listed yet', () => {
    const callers = desktopSources()
      .filter((file) => file.path !== GATE_MODULE && !isTestFile(file.path))
      .filter((file) => GATE_NAMES.test(stripComments(file.source)))
      .map((file) => asListed(file.path));

    expect(callers).toEqual([...PREMIUM_ACCOUNT_GATE_CALLERS]);
    expect(PREMIUM_ACCOUNT_GATE_CALLERS).toEqual([]);
  });

  it('hands the app state itself to nothing but the Premium service wiring', () => {
    const holders = desktopSources()
      .filter((file) => file.path !== GATE_MODULE && !isTestFile(file.path))
      .filter((file) => STATE_NAME.test(stripComments(file.source)))
      .map((file) => asListed(file.path));

    expect(holders).toEqual([...PLAYING_ACCOUNT_WRITERS]);
  });
});
