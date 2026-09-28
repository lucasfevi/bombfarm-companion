/**
 * The `title` half of the native-tooltip ban, checked where lint cannot reach.
 *
 * `react/forbid-dom-props` (root and web eslint configs) rejects `title` on a DOM element, and
 * that is the whole enforcement the repo had. The rule inspects lowercase intrinsic elements
 * only, so a capitalised component that accepts `title` and forwards it onto its own trigger
 * launders the attribute straight past lint: `<Select title={t.itemLevel}>` ends up as a native
 * tooltip on the Base UI trigger's button, unstyleable, theme-blind, absent on touch and on
 * keyboard focus — every reason the rule exists.
 *
 * `title` is also a legitimate content prop on a dozen design-system components, which render it
 * as a heading rather than hand it to an element. So the check cannot be "no `title` anywhere":
 * every design-system component carrying one is classified below, by reading what it does with
 * the prop, and a component in neither set fails until someone classifies it.
 *
 * Deliberately dumb text scanning over `git ls-files`, not a parse — the same convention
 * `tools/design-system-gate.test.mjs` and `tools/planning-reference-hygiene.test.mjs` use. It
 * lives under `tools/` because the two halves sit in different packages: the components are in
 * `packages/ui`, the call sites are in `apps/web` and `apps/desktop`, and only this project sees
 * both.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const SCANNED_ROOTS = ['apps', 'packages'];
const UI_INDEX = 'packages/ui/src/index.ts';
const UI_SRC = 'packages/ui/src/';

/**
 * Design-system components that render `title` themselves — a heading, a dialog title, a tip's
 * first line. Read out of each component before being listed here: every one puts the prop inside
 * an element's children, and none of them sets an attribute with it.
 */
const TITLE_IS_CONTENT = new Set([
  'AppShell',
  'Banner',
  'ConfirmDialog',
  'EmptyState',
  'PanelHeader',
  'SettingsSection',
  'Tooltip.StatusBody',
]);

/**
 * Design-system components that hand `title` to an element — a trigger's button, a table heading,
 * a dialog heading — so a call site passing one gets the native tooltip the lint rule forbids.
 * `Button`, `Select`, `SelectMultiple` and `Switch` no longer accept the prop at all (their props
 * omit it); they stay named here so a reinstated forward is an offense again rather than an
 * unclassified surprise. `Dialog.Title` and `DataTable.Header` spread the rest of their props onto
 * the heading element they render, which is how a `title` on either becomes an attribute.
 */
const TITLE_REACHES_AN_ELEMENT = new Set([
  'Button',
  'DataTable.Header',
  'Dialog.Title',
  'HelpTip',
  'Select',
  'SelectMultiple',
  'Switch',
]);

/**
 * The scan reached real call sites when it still finds these. Each is a content component with
 * call sites in both apps; losing one means the scan broke, not that the repo got tidier, and a
 * zero-offender result over zero files is the failure mode a bare `toEqual([])` cannot see.
 */
const CONTENT_FLOOR = new Set(['Banner', 'ConfirmDialog', 'EmptyState', 'PanelHeader', 'SettingsSection']);

/**
 * The native tooltips this repo keeps on purpose, each with the reason it is not simply removed.
 * A waiver is a decision recorded where the guard can see it, not an exemption: the staleness
 * check below fails once the site stops carrying a `title`, so a fix cannot leave a dead row
 * behind, and nothing outside this list may carry one.
 */
const WAIVERS = [
  {
    file: 'packages/hero/src/components/sheet-table.tsx',
    component: 'DataTable.Header',
    why:
      'two truncated column headings whose full text is the tooltip. Measured: a design-system ' +
      'Tooltip per heading costs ~8% more component renders across the planner perf scenarios, ' +
      'on a table that re-renders on every edit. The trade is recorded at the call site.',
  },
];

/** Runtime exports of the design system, so a misspelt component name cannot classify nothing. */
export function designSystemExports(indexSource) {
  const names = new Set();
  for (const block of indexSource.matchAll(/export\s+\{([^}]*)\}/g)) {
    for (const clause of block[1].split(',')) {
      const exported = clause.trim();
      if (exported.startsWith('type ')) continue;
      const name = exported.split(/\s+as\s+/).pop()?.trim() ?? '';
      if (/^[A-Z][A-Za-z0-9]*$/.test(name)) names.add(name);
    }
  }
  return names;
}

const TAG_START = /<([A-Za-z][A-Za-z0-9_$]*(?:\.[A-Za-z][A-Za-z0-9_$]*)*)/g;

/**
 * Every JSX opening tag with the text of its attributes. The end of an opening tag has to be
 * found by tracking brace depth and string literals rather than by looking for the next `>`: an
 * arrow function in a handler prop (`onChange={(event) => …}`) spells one, and so does a nested
 * element passed as a prop.
 */
function openingTags(source) {
  const tags = [];
  TAG_START.lastIndex = 0;
  let match;
  while ((match = TAG_START.exec(source)) !== null) {
    const nameEnd = match.index + match[0].length;
    if (/[A-Za-z0-9_$.]/.test(source[nameEnd] ?? '')) continue;

    let depth = 0;
    let quote = null;
    let end = -1;
    for (let i = nameEnd; i < source.length; i += 1) {
      const char = source[i];
      if (quote !== null) {
        if (char === '\\') i += 1;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === '`') quote = char;
      else if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (depth === 0 && char === '>') {
        end = i;
        break;
      } else if (depth === 0 && char === '<') break;
    }
    if (end === -1) continue;
    tags.push({
      name: match[1],
      attributes: source.slice(nameEnd, end),
      line: source.slice(0, match.index).split('\n').length,
    });
  }
  return tags;
}

/** A `title` attribute on this tag itself, not one inside a nested element passed as a prop. */
function setsTitle(attributes) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < attributes.length; i += 1) {
    const char = attributes[i];
    if (quote !== null) {
      if (char === '\\') i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') quote = char;
    else if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;
    else if (
      depth === 0 &&
      char === 't' &&
      !/[A-Za-z0-9_$-]/.test(attributes[i - 1] ?? '') &&
      /^title\s*=/.test(attributes.slice(i))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * What a `title` on this tag is. `native` and `forwarded` are offenses; `unclassified` is a
 * design-system component nobody has judged yet; `host` is a caller's own component, which this
 * guard makes no claim about.
 */
export function titleVerdict(tagName, file, exports) {
  if (/^[a-z]/.test(tagName)) return 'native';
  if (TITLE_IS_CONTENT.has(tagName)) return 'content';
  if (TITLE_REACHES_AN_ELEMENT.has(tagName)) return 'forwarded';
  if (file.startsWith(UI_SRC)) return 'forwarded';
  return exports.has(tagName.split('.')[0]) ? 'unclassified' : 'host';
}

/**
 * Every top-level tree holding a tracked component file. Derived rather than listed a second time:
 * comparing `SCANNED_ROOTS` against another constant would only catch an edit to one of the two,
 * while this also fails when a NEW top-level tree of components appears that nobody added to the
 * scan — the way a guard stops covering the repo without anyone touching the guard.
 */
function rootsHoldingComponents() {
  const tracked = execFileSync('git', ['ls-files', '-z', '*.tsx'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean);
  return [...new Set(tracked.map((file) => file.split('/')[0]))].sort();
}

function scannedFiles() {
  return execFileSync('git', ['ls-files', '-z', ...SCANNED_ROOTS], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter((file) => file.endsWith('.tsx') && !file.includes('/dist/'));
}

const exportedComponents = designSystemExports(readFileSync(join(root, UI_INDEX), 'utf8'));
const files = scannedFiles();

const sites = files.flatMap((file) => {
  const source = readFileSync(join(root, file), 'utf8');
  if (!source.includes('title')) return [];
  return openingTags(source)
    .filter((tag) => setsTitle(tag.attributes))
    .map((tag) => ({
      where: `${file}:${tag.line}`,
      file,
      component: tag.name,
      verdict: titleVerdict(tag.name, file, exportedComponents),
    }));
});

const waivedFiles = new Map(WAIVERS.map((waiver) => [`${waiver.file} ${waiver.component}`, waiver]));

describe('native-tooltip hygiene — no design-system component forwards `title` to a trigger', () => {
  it('the scan covers a real file set (a green result over no files proves nothing)', () => {
    expect(files.length).toBeGreaterThan(400);
    expect(files.filter((file) => file.startsWith(UI_SRC)).length).toBeGreaterThan(100);
  });

  it('the scan covers every top-level tree that holds components, and each contributes files', () => {
    expect(
      [...SCANNED_ROOTS].sort(),
      'a tree of components this guard never reads is a tree where a native tooltip lives forever',
    ).toEqual(rootsHoldingComponents());
    for (const dir of SCANNED_ROOTS) {
      expect(files.filter((file) => file.startsWith(`${dir}/`)).length, dir).toBeGreaterThan(0);
    }
  });

  it('the design-system components it found taking a `title` still include the content ones it knows', () => {
    const found = new Set(sites.map((site) => site.component));
    expect([...CONTENT_FLOOR].filter((name) => !found.has(name))).toEqual([]);
  });

  it('every classified name is a real design-system export (a typo must not silently classify nothing)', () => {
    const unknown = [...TITLE_IS_CONTENT, ...TITLE_REACHES_AN_ELEMENT]
      .filter((name) => !exportedComponents.has(name.split('.')[0]))
      .sort();
    expect(unknown, `not exported from ${UI_INDEX}`).toEqual([]);
  });

  it('no component is classified both ways', () => {
    expect([...TITLE_IS_CONTENT].filter((name) => TITLE_REACHES_AN_ELEMENT.has(name))).toEqual([]);
  });

  it('every design-system component found taking a `title` is classified as content or as forwarded', () => {
    const unclassified = sites.filter((site) => site.verdict === 'unclassified');
    expect(
      [...new Set(unclassified.map((site) => `${site.component}  ${site.where}`))].sort(),
      'A design-system component takes a `title` and nothing here says what it does with it. ' +
        'Read the component: if it renders the prop, add it to TITLE_IS_CONTENT; if it hands it ' +
        'to an element, add it to TITLE_REACHES_AN_ELEMENT and drop the prop.',
    ).toEqual([]);
  });

  it('no `title` reaches a trigger, a DOM element, or a Base UI element inside the design system', () => {
    const offenders = sites
      .filter((site) => site.verdict === 'native' || site.verdict === 'forwarded')
      .filter((site) => !waivedFiles.has(`${site.file} ${site.component}`))
      .map((site) => `${site.where}  <${site.component} title=…>`)
      .sort();
    expect(
      offenders,
      'A native tooltip. Use the design-system Tooltip from @bombfarm/ui, or drop the attribute ' +
        'when an aria-label on the same element already carries the string — the native one ' +
        'cannot be styled, ignores the theme, and never appears on touch or for keyboard focus.',
    ).toEqual([]);
  });

  it('the lint half of the rule covers every package by wildcard, not a list someone must remember', () => {
    const config = readFileSync(join(root, 'eslint.config.mjs'), 'utf8');
    const block = /files: \[([^\]]*)\],\s*\n\s*plugins: \{ react \},\s*\n\s*rules: \{ 'react\/forbid-dom-props'/.exec(
      config,
    );
    expect(block, 'no forbid-dom-props config block found in eslint.config.mjs').not.toBeNull();
    expect(
      block[1],
      'name a package and the next one is unlinted until someone remembers it — which is how ' +
        'packages/account went unlinted for this rule',
    ).toContain("'packages/*/**");
  });

  it('every waived native tooltip is still there (a fix must not leave a dead waiver behind)', () => {
    const stale = WAIVERS.filter(
      (waiver) =>
        !sites.some((site) => site.file === waiver.file && site.component === waiver.component),
    ).map((waiver) => `${waiver.file}  <${waiver.component} title=…> is waived but no longer present`);
    expect(stale, 'Remove the waiver in the same change that removes the tooltip.').toEqual([]);
  });

  it('the props of the primitives that used to forward it no longer accept it', () => {
    const select = readFileSync(join(root, 'packages/ui/src/select.tsx'), 'utf8');
    for (const type of ['SelectProps', 'SelectMultipleProps']) {
      const declaration = select.slice(select.indexOf(`export type ${type} =`));
      const omitted = declaration.slice(0, declaration.indexOf('> & {'));
      expect(omitted, `${type} must omit 'title' from the <select> props it inherits`).toContain("'title'");
    }
    expect(readFileSync(join(root, 'packages/ui/src/switch.tsx'), 'utf8')).not.toMatch(/^\s*title\?:/m);
    expect(
      readFileSync(join(root, 'packages/ui/src/button.tsx'), 'utf8'),
      "ButtonProps must omit 'title' — it spreads the rest of its props onto a DOM button",
    ).toMatch(/export type ButtonProps = Omit<[^>]*'title'/);
  });
});

describe('native-tooltip hygiene — the scan discriminates', () => {
  const exports = new Set(['Button', 'Select', 'EmptyState', 'Chip']);

  it('red state: a `title` on a design-system trigger is caught at a call site', () => {
    expect(titleVerdict('Select', 'apps/web/src/features/gear/components/slot-editor.tsx', exports)).toBe(
      'forwarded',
    );
    expect(titleVerdict('Button', 'packages/farm/src/components/thing.tsx', exports)).toBe('forwarded');
  });

  it('red state: a `title` forwarded to a Base UI element inside the design system is caught', () => {
    expect(titleVerdict('BaseSelect.Trigger', 'packages/ui/src/select.tsx', exports)).toBe('forwarded');
    expect(titleVerdict('Popover.Trigger', 'packages/ui/src/help-tip.tsx', exports)).toBe('forwarded');
  });

  it('red state: a native `title` on a DOM element is caught even where lint does not run', () => {
    expect(titleVerdict('button', 'packages/account/src/skill-tree/skill-tree-screen.tsx', exports)).toBe(
      'native',
    );
  });

  it('red state: an unclassified design-system component taking a `title` is caught', () => {
    expect(titleVerdict('Chip', 'apps/web/src/features/home/components/live-card.tsx', exports)).toBe(
      'unclassified',
    );
  });

  it('green state: a content component renders the prop, and a host component is not this rule', () => {
    expect(titleVerdict('EmptyState', 'apps/desktop/renderer/app/farm/farm-view.tsx', exports)).toBe('content');
    expect(titleVerdict('ScreenCard', 'apps/web/src/features/download/components/included-screens.tsx', exports)).toBe(
      'host',
    );
  });

  it('an attribute inside a handler or a nested element is not read as this tag’s `title`', () => {
    const tags = openingTags('<Select onChange={(event) => pick(event, <b title="x" />)} value={v}>');
    expect(tags.map((tag) => [tag.name, setsTitle(tag.attributes)])).toEqual([
      ['Select', false],
      ['b', true],
    ]);
  });

  it('the export reader finds the primitives and skips the type-only names', () => {
    // One clause per filter, so each is load-bearing on its own: a RENAMED type export survives the
    // name regex (`SortableDir` looks like a component) and only the `type ` skip rejects it, while
    // a lowercase helper survives the `type ` skip and only the name regex rejects it. A type-only
    // export BLOCK must never be read at all. Drop any one of the three and this fixture fails.
    const index = [
      "export { Button, type ButtonProps } from './button';",
      "export { cn } from './cn';",
      "export { type SortDir as SortableDir } from './data-table';",
      "export type { BannerProps } from './banner';",
      '',
    ].join('\n');
    expect([...designSystemExports(index)]).toEqual(['Button']);
  });
});
