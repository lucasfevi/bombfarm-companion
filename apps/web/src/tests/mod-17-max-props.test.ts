import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

/**
 * No component's *own* props exceed 8 members (error; no allowlist escape hatch).
 *
 * SPEC_DEVIATION: the spec said the W7
 * allowlist SHALL be empty. The user explicitly approved a narrower counting rule as the
 * mechanism to get there honestly: only *non-DOM* props count toward the 8-prop budget.
 * Native HTML/ARIA attribute names (and `aria-*`/`data-*` props) that a component simply
 * forwards to an underlying element or Base UI primitive are excluded — the rule's intent
 * is catching prop-drilled god-components, not penalizing thin DOM pass-through
 * primitives. `switch.tsx`'s `SwitchProps` is 14 props, all but two (`onCheckedChange`,
 * `size`) standard HTML/ARIA attributes forwarded to Base UI; `select.tsx`'s
 * `SelectProps` is `Omit<ComponentPropsWithoutRef<'select'>, …> & {…}` — it inherits the
 * whole native `<select>` surface and adds only a couple of its own. Under this counting
 * rule both components genuinely pass on their own merits, so the allowlist is empty
 * rather than papering over them with an exemption.
 */
const MAX_PROPS = 8;

/** Reviewed empty — no component is exempted from the 8-prop budget (error). */
const ALLOWLIST_FILES = new Set<string>([]);

/** W5-migrated components — must stay ≤8 and never live under ALLOWLIST_FILES.
 *  `AccountColumn` left the list when the Account page replaced it with focused panels. */
const MIGRATED_SIX = [
  'src/features/planner/components/planner-tabs.tsx::PlannerTabs',
  'src/features/planner/components/hero-abilities-tab.tsx::HeroAbilitiesTab',
  'src/features/planner/components/gear-tab.tsx::GearTab',
  'src/features/planner/components/advice-column.tsx::AdviceColumn',
  'src/features/planner/components/hero-strip.tsx::HeroStrip',
  'src/features/planner/components/hero-planner.tsx::HeroPlanner',
];

/**
 * Native HTML/ARIA attribute names a component may forward straight through to an
 * underlying element or Base UI primitive. These do not count as "own" props — they are
 * the DOM's surface, not the component's design. `aria-*` / `data-*` are matched by
 * prefix below rather than listed individually.
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

function walk(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== 'node_modules' && ent.name !== '__tests__') {
      walk(p, acc);
    } else if (ent.name.endsWith('.tsx') && !ent.name.includes('.stories.')) {
      acc.push(p);
    }
  }
  return acc;
}

type Hit = { key: string; file: string; name: string; count: number };

function collectHits(): Hit[] {
  const root = WEB_PACKAGE_ROOT;
  const files = walk(path.join(root, 'src'));
  const hits: Hit[] = [];

  for (const abs of files) {
    const rel = path.relative(root, abs).split(path.sep).join('/');
    const text = fs.readFileSync(abs, 'utf8');

    for (const m of text.matchAll(/(?:type|interface) (\w*Props)\s*=\s*\{([^}]+)\}/gs)) {
      const keys = [...m[2].matchAll(/^\s*(?:readonly\s+)?([A-Za-z_][\w]*)\s*[?:]/gm)]
        .map((x) => x[1])
        .filter((k) => k !== 'children' && !isDomProp(k));
      if (keys.length > MAX_PROPS) {
        hits.push({ key: `${rel}::${m[1]}`, file: rel, name: m[1], count: keys.length });
      }
    }

    for (const m of text.matchAll(
      /(?:export (?:default )?function|memo\(function) (\w+)\s*\(\s*\{([^}]*)\}/g,
    )) {
      const props = m[2]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.split(/[=:]/)[0].trim().replace(/^['"]|['"]$/g, ''))
        .filter((s) => s && !s.startsWith('...') && s !== 'children' && !isDomProp(s));
      if (props.length > MAX_PROPS) {
        hits.push({ key: `${rel}::${m[1]}`, file: rel, name: m[1], count: props.length });
      }
    }
  }

  const uniq = new Map<string, Hit>();
  for (const h of hits) uniq.set(h.key, h);
  return [...uniq.values()];
}

function countPropsFor(fileRel: string, exportName: string): number {
  const abs = path.join(WEB_PACKAGE_ROOT, fileRel);
  const text = fs.readFileSync(abs, 'utf8');
  const fnRe = new RegExp(
    `(?:export (?:default )?function|memo\\(function) ${exportName}\\s*\\(\\s*\\{([^}]*)\\}`,
  );
  const m = fnRe.exec(text);
  if (!m) {
    // Zero-arg component (e.g. AccountColumn())
    const zero = new RegExp(
      `(?:export (?:default )?function|memo\\(function) ${exportName}\\s*\\(\\s*\\)`,
    );
    if (zero.test(text)) return 0;
    throw new Error(`Could not find component ${exportName} in ${fileRel}`);
  }
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.split(/[=:]/)[0].trim().replace(/^['"]|['"]$/g, ''))
    .filter((s) => s && !s.startsWith('...') && s !== 'children' && !isDomProp(s)).length;
}

describe('max props (error, non-DOM props only, no allowlist)', () => {
  it('migrated six each declare ≤ 8 own props and are not allowlisted', () => {
    for (const key of MIGRATED_SIX) {
      const [file, name] = key.split('::');
      expect(ALLOWLIST_FILES.has(file), `${file} must not be on the W7 allowlist`).toBe(false);
      const count = countPropsFor(file, name);
      expect(count, `${key} has ${count} own props`).toBeLessThanOrEqual(MAX_PROPS);
    }
  });

  it('no component (including switch.tsx / select.tsx) exceeds 8 own props', () => {
    const hits = collectHits();
    expect(
      hits,
      hits.map((h) => `${h.key} (${h.count} own props)`).join('\n') || 'ok',
    ).toEqual([]);
    expect(ALLOWLIST_FILES.size, 'allowlist must stay empty (error, W7)').toBe(0);
  });
});
