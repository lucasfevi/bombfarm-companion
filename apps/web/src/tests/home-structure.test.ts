import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

const SRC_ROOT = join(WEB_PACKAGE_ROOT, 'src');
const THIS_FILE = relative(SRC_ROOT, fileURLToPath(import.meta.url)).split(sep).join('/');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function sourceFilesMentioning(tokens: readonly string[]): string[] {
  return walk(SRC_ROOT)
    .map((full) => relative(SRC_ROOT, full).split(sep).join('/'))
    .filter((file) => file !== THIS_FILE)
    .filter((file) => {
      const text = readFileSync(join(SRC_ROOT, file), 'utf8');
      return tokens.some((token) => text.includes(token));
    });
}

function homeImportSpecifiers(): { file: string; specifier: string }[] {
  return walk(join(SRC_ROOT, 'features/home')).flatMap((full) => {
    const file = relative(SRC_ROOT, full).split(sep).join('/');
    const text = readFileSync(full, 'utf8');
    return Array.from(text.matchAll(/from '([^']+)'/g), (match) => ({ file, specifier: match[1] }));
  });
}

describe('home structure', () => {
  it("no file under the web source mentions the guide's storage key or component", () => {
    expect(sourceFilesMentioning(['bf_guide_hidden', 'GuideSection'])).toEqual([]);
  });

  it("the home feature imports nothing from the optimizer's hooks or worker", () => {
    const specifiers = homeImportSpecifiers();

    expect(specifiers.length).toBeGreaterThan(0);
    expect(
      specifiers.filter(({ specifier }) => /features\/team-plan\/(hooks|worker)/.test(specifier)),
    ).toEqual([]);
  });

  it("the home feature imports no other feature's components", () => {
    const specifiers = homeImportSpecifiers();

    expect(specifiers.length).toBeGreaterThan(0);
    expect(
      specifiers.filter(({ specifier }) => /features\/(?!home)[a-z-]+\/components\//.test(specifier)),
    ).toEqual([]);
  });

  it('the home feature never imports the pricing package', () => {
    const specifiers = homeImportSpecifiers();

    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter(({ specifier }) => specifier.startsWith('@bombfarm/pricing'))).toEqual([]);
  });
});
