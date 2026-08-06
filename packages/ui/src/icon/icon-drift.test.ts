import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GAME_GLYPH_NAMES } from './glyph-names';
import { glyphApproval } from './glyph-manifest';
import { gameIconRegistry } from './game-registry';

const iconModuleDir = dirname(fileURLToPath(import.meta.url));
const uiPackageRoot = join(iconModuleDir, '../../');
const svgDir = join(uiPackageRoot, 'icons/game');
const tsxDir = join(iconModuleDir, 'game');

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const COLOUR_LITERAL =
  /#(?:[0-9a-fA-F]{3,8})\b|rgb\s*\(|hsl\s*\(|\b(?:red|blue|green|yellow|orange|purple|pink|black|white|gray|grey)\b/;

function listSvgBasenames(): string[] {
  return readdirSync(svgDir)
    .filter((name) => name.endsWith('.svg'))
    .map((name) => name.replace(/\.svg$/, ''))
    .sort();
}

function listTsxBasenames(): string[] {
  return readdirSync(tsxDir)
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => name.replace(/\.tsx$/, ''))
    .sort();
}

function assertSetsEqual(
  actual: string[],
  expected: string[],
  actualLabel: string,
  expectedLabel: string,
) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  for (const item of actual) {
    if (!expectedSet.has(item)) {
      expect.fail(`${item} is in ${actualLabel} but missing from ${expectedLabel}`);
    }
  }

  for (const item of expected) {
    if (!actualSet.has(item)) {
      expect.fail(`${item} is in ${expectedLabel} but missing from ${actualLabel}`);
    }
  }
}

describe('glyph drift — four-way set parity (ICO-20)', () => {
  const enumNames = [...GAME_GLYPH_NAMES].sort();
  const svgNames = listSvgBasenames();
  const tsxNames = listTsxBasenames();
  const registryNames = Object.keys(gameIconRegistry).sort();

  it('matches GAME_GLYPH_NAMES, svg basenames, tsx basenames, and registry keys', () => {
    assertSetsEqual(svgNames, enumNames, 'svg basenames', 'GAME_GLYPH_NAMES');
    assertSetsEqual(tsxNames, enumNames, 'tsx basenames', 'GAME_GLYPH_NAMES');
    assertSetsEqual(registryNames, enumNames, 'gameIconRegistry keys', 'GAME_GLYPH_NAMES');
  });

  it('has exactly 17 kebab-case glyph ids', () => {
    expect(enumNames).toHaveLength(17);
    for (const name of enumNames) {
      expect(name, `${name} is not kebab-case`).toMatch(KEBAB_CASE);
    }
  });
});

describe('glyph drift — source svg contract (ICO-19)', () => {
  const svgFiles = listSvgBasenames();

  it.each(svgFiles)('%s satisfies the authoring contract', (basename) => {
    const content = readFileSync(join(svgDir, `${basename}.svg`), 'utf8');

    expect(content).toContain('viewBox="0 0 24 24"');
    expect(content).not.toMatch(/\bwidth=/);
    expect(content).not.toMatch(/\bheight=/);
    expect(content).not.toContain('<style');
    expect(content).not.toContain('<use');
    expect(content).not.toMatch(/data:|base64/i);
    expect(content).not.toMatch(/\bid=/);
    expect(content).not.toMatch(COLOUR_LITERAL);
    expect(content).toContain('currentColor');
  });
});

describe('glyph drift — generated tsx contract (ICO-20/21)', () => {
  const tsxFiles = listTsxBasenames();

  it.each(tsxFiles)('%s still matches the generated output contract', (basename) => {
    const content = readFileSync(join(tsxDir, `${basename}.tsx`), 'utf8');

    expect(content).toContain('currentColor');
    expect(content).not.toMatch(/\bwidth=/);
    expect(content).not.toMatch(/\bheight=/);
    expect(content).toContain('{...props}');
  });
});

describe('glyph drift — manifest integrity (ICO-33)', () => {
  it('has exactly 17 rows keyed by GAME_GLYPH_NAMES', () => {
    expect(Object.keys(glyphApproval).sort()).toEqual([...GAME_GLYPH_NAMES].sort());
  });

  it('requires approvedOn ISO dates that parse for approved rows', () => {
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;

    for (const name of GAME_GLYPH_NAMES) {
      const row = glyphApproval[name];
      if (row.approval === 'approved') {
        expect(row.approvedOn).toMatch(isoDate);
        expect(Number.isNaN(Date.parse(row.approvedOn))).toBe(false);
      }
    }
  });
});

describe('glyph drift — registry keys independent of art (ICO-22)', () => {
  it('binds registry keys to enum members, not file contents', () => {
    for (const name of GAME_GLYPH_NAMES) {
      expect(gameIconRegistry[name]).toBeDefined();
    }
    expect(Object.keys(gameIconRegistry)).toHaveLength(GAME_GLYPH_NAMES.length);
  });
});
