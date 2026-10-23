import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const smokeDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'smoke');
const specs = readdirSync(smokeDir).filter((file) => file.endsWith('.spec.mjs'));
const read = (file) => readFileSync(path.join(smokeDir, file), 'utf8');

describe('the Electron smoke specs', () => {
  it('finds the specs it guards', () => {
    expect(specs.length).toBeGreaterThan(30);
  });

  it.each(specs)('%s launches Electron through the helper that fails the test on a CSP violation', (spec) => {
    const source = read(spec);
    expect(source).toMatch(/from '\.\/smoke-test\.mjs'/);
    expect(source).not.toMatch(/from '@playwright\/test'/);
    expect(source).not.toMatch(/_electron/);
  });

  it('are all listed in the electron-smoke project, which only runs what it names', () => {
    const config = readFileSync(path.join(smokeDir, '..', '..', 'playwright.config.ts'), 'utf8');
    const unlisted = specs.filter((spec) => !config.includes(`'${spec}'`));
    expect(unlisted).toEqual([]);
  });
});

describe('the helper the specs launch through', () => {
  const helper = read('smoke-test.mjs');

  it('turns an unreported violation into a failed test, per test and at the end of the worker', () => {
    expect(helper).toMatch(/csp:\s*\[/);
    expect(helper).toMatch(/scope: 'worker', auto: true/);
    expect(helper.match(/auto: true/g)).toHaveLength(2);
  });

  it('listens to both the securitypolicyviolation event and the console', () => {
    expect(helper).toContain("'securitypolicyviolation'");
    expect(helper).toContain("window.on('console'");
  });
});
