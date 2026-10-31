import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { guardScanner, isTestFile } from '../../guard-scan';
import { createLeaseGate } from './lease-gate';

/**
 * The files outside tests that may ask the gate whether premium code may run, or subscribe to its
 * changes: the Premium host's wiring, which hands the host its view of the gate. Adding a caller
 * means adding it here, on purpose.
 */
const PREMIUM_LEASE_GATE_CALLERS: readonly string[] = ['src/main/premium/host/host-wiring.ts'];

/** The one file that holds the app's gate and writes its value: the licence service. */
const LEASE_GATE_WRITERS: readonly string[] = ['src/main/premium/licence/licence-runner.ts'];

const DESKTOP_ROOT = resolve(__dirname, '..', '..', '..', '..');
const GATE_MODULE = join(__dirname, 'lease-gate.ts');
const GATE_NAMES = /\b(premiumLeaseAllows|onPremiumLeaseChange)\b/;
const STATE_NAME = /\bappLeaseGate\b/;
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

describe('the lease gate value', () => {
  it('is false until it is set true', () => {
    const gate = createLeaseGate();

    expect(gate.allows()).toBe(false);
    gate.set(true);
    expect(gate.allows()).toBe(true);
    gate.set(false);
    expect(gate.allows()).toBe(false);
  });

  it('tells every subscriber synchronously, before set returns', () => {
    const gate = createLeaseGate();
    const heard: Array<[boolean, string]> = [];
    gate.subscribe((allows, state) => heard.push([allows, state]));

    gate.set(true, 'holds');

    expect(heard).toEqual([[true, 'holds']]);
  });

  it('announces a change of state alone, and nothing when neither value nor state changed', () => {
    const gate = createLeaseGate();
    const heard: Array<[boolean, string]> = [];
    gate.set(false, 'unconfirmed');
    gate.subscribe((allows, state) => heard.push([allows, state]));

    gate.set(false, 'unconfirmed');
    gate.set(false, 'ended');
    gate.set(false);

    expect(heard).toEqual([[false, 'ended']]);
  });

  it('keeps telling the others when one listener throws, and does not throw itself', () => {
    const gate = createLeaseGate();
    const heard: boolean[] = [];
    gate.subscribe(() => {
      throw new Error('listener fault');
    });
    gate.subscribe((allows) => heard.push(allows));

    expect(() => {
      gate.set(true);
    }).not.toThrow();
    expect(heard).toEqual([true]);
  });

  it('stops telling a listener once it has unsubscribed', () => {
    const gate = createLeaseGate();
    const heard: boolean[] = [];
    const stop = gate.subscribe((allows) => heard.push(allows));

    stop();
    gate.set(true);

    expect(heard).toEqual([]);
  });
});

describe('who may call the lease gate', () => {
  it('sees the gate module itself, so the scan is not vacuous', () => {
    const gate = desktopSources().find((file) => file.path === GATE_MODULE);

    expect(gate).toBeDefined();
    expect(GATE_NAMES.test(stripComments(gate?.source ?? ''))).toBe(true);
  });

  it('is called from no file outside tests except the listed callers', () => {
    const callers = desktopSources()
      .filter((file) => file.path !== GATE_MODULE && !isTestFile(file.path))
      .filter((file) => GATE_NAMES.test(stripComments(file.source)))
      .map((file) => asListed(file.path));

    expect(callers).toEqual([...PREMIUM_LEASE_GATE_CALLERS]);
  });

  it('hands the app gate itself to nothing but the licence service', () => {
    const holders = desktopSources()
      .filter((file) => file.path !== GATE_MODULE && !isTestFile(file.path))
      .filter((file) => STATE_NAME.test(stripComments(file.source)))
      .map((file) => asListed(file.path));

    expect(holders).toEqual([...LEASE_GATE_WRITERS]);
  });
});
