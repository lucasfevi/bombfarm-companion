import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * No component's *own* props exceed 8 members (error; no allowlist escape hatch).
 *
 * The web app enforces this over its own `src` and cannot see this package, so the farm screen's
 * components would have left the budget's reach the moment they moved here. This is that guard,
 * mirrored — same limit, same counting rule, same empty allowlist — so the rule follows its
 * subjects instead of quietly ceasing to apply to them.
 *
 * The counting rule is deliberately narrower than "every prop": only *non-DOM* props count.
 * Native HTML/ARIA attribute names (and `aria-*`/`data-*`) that a component forwards to an
 * underlying element or Base UI primitive are excluded — the rule exists to catch prop-drilled
 * god-components, not to penalise thin DOM pass-throughs. Under that rule the allowlist can stay
 * genuinely empty rather than papering over a primitive with an exemption.
 */
const MAX_PROPS = 8;

/** Reviewed empty — no component in this package is exempted from the 8-prop budget. */
const ALLOWLIST_FILES = new Set<string>([]);

/**
 * Native HTML/ARIA attribute names a component may forward straight through to an underlying
 * element or Base UI primitive. These are the DOM's surface, not the component's design.
 * `aria-*` / `data-*` are matched by prefix below rather than listed individually.
 */
const NATIVE_ATTRIBUTE_NAMES = new Set([
  'id',
  'name',
  'value',
  'defaultValue',
  'checked',
  'defaultChecked',
  'disabled',
  'readOnly',
  'required',
  'placeholder',
  'className',
  'style',
  'title',
  'type',
  'min',
  'max',
  'step',
  'pattern',
  'maxLength',
  'minLength',
  'autoFocus',
  'autoComplete',
  'tabIndex',
  'hidden',
  'role',
  'onChange',
  'onInput',
  'onFocus',
  'onBlur',
  'onClick',
  'onKeyDown',
  'onKeyUp',
  'onSubmit',
]);

function isDomProp(propName: string): boolean {
  return (
    NATIVE_ATTRIBUTE_NAMES.has(propName) ||
    propName.startsWith('aria-') ||
    propName.startsWith('data-')
  );
}

const PACKAGE_SRC = fileURLToPath(new URL('.', import.meta.url));

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') walk(full, acc);
    else if (entry.name.endsWith('.tsx') && !entry.name.includes('.stories.')) acc.push(full);
  }
  return acc;
}

type Hit = { key: string; file: string; name: string; count: number };

/** The `{ … }` starting at `open`, brace-balanced. A non-greedy `[^}]*` would stop at the first
 *  nested `}` instead — and a props type that groups two values into a bag (which is how a
 *  component gets UNDER this budget) is exactly the shape that has one. */
function balancedBlock(text: string, open: number): string {
  let depth = 0;
  for (let index = open; index < text.length; index++) {
    const char = text[index];
    if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) return text.slice(open + 1, index);
    }
  }
  return '';
}

/** The block's own text with every nested `{…}` / `(…)` dropped, newlines kept so line anchors
 *  still land — so a nested bag's members are not counted as the component's own props. */
function topLevelOnly(block: string): string {
  let depth = 0;
  let flat = '';
  for (const char of block) {
    if (char === '{' || char === '(') depth++;
    else if (char === '}' || char === ')') depth--;
    else if (depth === 0 || char === '\n') flat += char;
  }
  return flat;
}

function countDestructured(params: string): number {
  return topLevelOnly(params)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(/[=:]/)[0].trim().replace(/^['"]|['"]$/g, ''))
    .filter((part) => part && !part.startsWith('...') && part !== 'children' && !isDomProp(part))
    .length;
}

function countTypeMembers(block: string): number {
  return [...topLevelOnly(block).matchAll(/^\s*(?:readonly\s+)?([A-Za-z_][\w]*)\s*[?:]/gm)]
    .map((entry) => entry[1])
    .filter((key) => key !== 'children' && !isDomProp(key)).length;
}

function collectHits(files: string[]): Hit[] {
  const hits = new Map<string, Hit>();

  for (const abs of files) {
    const rel = path.relative(PACKAGE_SRC, abs).split(path.sep).join('/');
    const text = fs.readFileSync(abs, 'utf8');

    const record = (name: string, count: number) => {
      if (count > MAX_PROPS) hits.set(`${rel}::${name}`, { key: `${rel}::${name}`, file: rel, name, count });
    };

    for (const match of text.matchAll(/(?:type|interface) (\w*Props)\s*=?\s*\{/g)) {
      const open = match.index + match[0].length - 1;
      record(match[1], countTypeMembers(balancedBlock(text, open)));
    }

    for (const match of text.matchAll(
      /(?:export (?:default )?function|memo\(function) (\w+)\s*\(\s*\{/g,
    )) {
      const open = match.index + match[0].length - 1;
      record(match[1], countDestructured(balancedBlock(text, open)));
    }
  }

  return [...hits.values()];
}

describe('max props (error, non-DOM props only, no allowlist)', () => {
  const files = walk(PACKAGE_SRC);

  it('the scan reaches this package\'s components — it is not passing over an empty set', () => {
    const names = files.map((abs) => path.basename(abs));
    expect(names).toContain('farm-ranking-board.tsx');
    expect(names).toContain('farm-respec-panel.tsx');
    expect(names.filter((name) => name.startsWith('farm-')).length).toBeGreaterThanOrEqual(16);
  });

  it('red state: a fabricated nine-prop component is counted over the budget', () => {
    expect(countDestructured('a, b, c, d, e, f, g, h, i'), 'nine own props').toBeGreaterThan(
      MAX_PROPS,
    );
    // The same nine, but DOM pass-throughs, are not the component's own design.
    expect(
      countDestructured('id, name, value, checked, disabled, className, style, role, tabIndex'),
    ).toBe(0);
  });

  it('red state: a nested bag neither hides its own members nor truncates the count', () => {
    const nested = `
  rows: readonly Row[];
  sort: { key: SortKey; direction: SortDir };
  onSort: (key: SortKey) => void;
  currentPhase: number;
  onActivate: (phase: number) => void;
  lang: Lang;
  t: FarmCopy;
  reRankActive: boolean;
  ninth: boolean;
`;
    // Eight of the nine, if the scan stopped at the bag's first closing brace.
    expect(countTypeMembers(nested)).toBe(9);
  });

  it('no component in @bombfarm/farm exceeds 8 own props', () => {
    const hits = collectHits(files);
    expect(
      hits,
      hits.map((hit) => `${hit.key} (${hit.count} own props)`).join('\n') || 'ok',
    ).toEqual([]);
    expect(ALLOWLIST_FILES.size, 'allowlist must stay empty').toBe(0);
  });
});
