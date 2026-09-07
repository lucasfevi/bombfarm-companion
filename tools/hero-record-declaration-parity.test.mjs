/**
 * `HeroRecord` is declared twice — once for the web planner's storage layer and once for the
 * domain package's storage shapes — and neither declaration imports the other, on purpose: the
 * domain package must not depend on the app. Nothing else compares them, so a field added to one
 * alone type-checks everywhere and reads as permanently absent on the other side.
 *
 * Reading both declarations as source TEXT is what lets this guard hold without either side
 * importing the other. Home is `tools/`, so neither package gains a file for it. Deliberately
 * dumb text slicing rather than a parse, matching this directory's other source-text guards
 * (`advisor-input-parity.test.mjs`, `ci-desktop-paths.test.mjs`, `design-system-gate.test.mjs`).
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const DECLARATIONS = [
  { label: 'apps/web/src/shared/lib/storage.ts', path: join(root, 'apps/web/src/shared/lib/storage.ts') },
  {
    label: 'packages/domain/src/shims/storage.ts',
    path: join(root, 'packages/domain/src/shims/storage.ts'),
  },
];

/** Both declarations are heavily doc-commented, and comment prose otherwise reads as fields. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function sliceBalancedBraces(source, fromIndex, label) {
  const open = source.indexOf('{', fromIndex);
  if (open === -1) throw new Error(`${label}: no opening brace after the HeroRecord declaration`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`${label}: unbalanced braces reading the HeroRecord body`);
}

/**
 * Top-level field names of `export type HeroRecord = { ... }`. Members are split on depth-zero
 * semicolons, so a nested object literal inside a field's type contributes none of its own
 * names, and the optional marker is consumed along with the name.
 */
export function extractHeroRecordFields(source, label) {
  const declIndex = source.indexOf('export type HeroRecord = {');
  if (declIndex === -1) throw new Error(`${label}: no "export type HeroRecord = {" declaration`);

  const body = stripComments(sliceBalancedBraces(source, declIndex, label));

  const members = [];
  let buffer = '';
  let depth = 0;
  for (const char of body) {
    if (char === '{' || char === '(' || char === '[') depth += 1;
    else if (char === '}' || char === ')' || char === ']') depth -= 1;

    if (char === ';' && depth === 0) {
      members.push(buffer);
      buffer = '';
      continue;
    }
    buffer += char;
  }
  members.push(buffer);

  const fields = [];
  for (const member of members) {
    const match = member.match(/^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*\??\s*:/);
    if (match) fields.push(match[1]);
  }
  return fields;
}

describe('the two HeroRecord declarations carry the same fields', () => {
  const extracted = DECLARATIONS.map((declaration) => ({
    ...declaration,
    fields: new Set(extractHeroRecordFields(readFileSync(declaration.path, 'utf8'), declaration.label)),
  }));

  it('the extractor survives doc comments, nested object literals and optional markers', () => {
    const synthetic = `
      export type HeroRecord = {
        id: string;
        /** A doc comment with a { brace } and a stray ; semicolon. */
        level?: number;
        bounds: { min: number; max: number };
        // A line comment naming a decoy: decoy: string;
        pts: Record<keyof SheetStats, number>;
        readonly frozen: boolean;
      };
      export type Other = { notAField: number };
    `;
    expect(extractHeroRecordFields(synthetic, 'synthetic')).toEqual([
      'id',
      'level',
      'bounds',
      'pts',
      'frozen',
    ]);
  });

  it('both extractions found a real, non-trivial field set (sanity — otherwise this proves nothing)', () => {
    for (const declaration of extracted) {
      expect(declaration.fields.size, `${declaration.label} field count`).toBeGreaterThan(15);
      for (const anchor of ['id', 'name', 'naked', 'loadout', 'pts']) {
        expect(declaration.fields.has(anchor), `${declaration.label} is missing ${anchor}`).toBe(true);
      }
    }
  });

  it('the field-name sets are exactly equal', () => {
    const [first, second] = extracted;
    const drifted = [];
    for (const field of first.fields) {
      if (!second.fields.has(field)) {
        drifted.push(`${field} (declared in ${first.label}, absent from ${second.label})`);
      }
    }
    for (const field of second.fields) {
      if (!first.fields.has(field)) {
        drifted.push(`${field} (declared in ${second.label}, absent from ${first.label})`);
      }
    }

    expect(
      drifted,
      `the two HeroRecord declarations have drifted apart: ${drifted.join('; ')} — add each field to ` +
        'both declarations, or the side that lacks it reads that field as permanently absent',
    ).toEqual([]);
  });
});
