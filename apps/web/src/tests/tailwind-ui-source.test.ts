import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Recipe class strings live in `packages/ui/src`. If `globals.css` drops that `@source`,
 * package-only utilities (ability-card `auto-fill`/`240px` grid, sheet color-mix borders, …)
 * never enter the CSS bundle and the Abilities tab stacks full-width unstyled cards.
 */
const here = dirname(fileURLToPath(import.meta.url));
const globalsCss = resolve(here, '../app/globals.css');

describe('Tailwind @source covers @bombfarm/ui', () => {
  it('globals.css sources packages/ui recipes', () => {
    const css = readFileSync(globalsCss, 'utf8');
    expect(css).toMatch(/@source\s+['"][^'"]*packages\/ui\/src\/\*\*\/\*\.\{ts,tsx\}['"]/);
  });
});

/**
 * Same failure shape, one package over: `game-art.recipe.ts`'s literal rarity classes
 * (`border-rar-4`, `text-rar-2`, …) live in `packages/game-art/src`. Without this `@source`
 * Tailwind's JIT scanner never sees them and rarity chrome silently loses its colour.
 */
describe('Tailwind @source covers @bombfarm/game-art', () => {
  it('globals.css sources packages/game-art recipes', () => {
    const css = readFileSync(globalsCss, 'utf8');
    expect(css).toMatch(/@source\s+['"][^'"]*packages\/game-art\/src\/\*\*\/\*\.\{ts,tsx\}['"]/);
  });
});

/**
 * The two checks above pin one stylesheet against two packages, and every other
 * package/stylesheet pair was unguarded — including both apps against `packages/farm`, whose
 * classes have shipped unpinned all along.
 *
 * This is the one registration point in a shared UI package with no failure signal of its own.
 * A dropped `@source` is not a build error, not a type error and not a lint error, and no unit
 * test can see it because nothing in this repo renders a component: the utilities used *only* by
 * that package's components simply stop being emitted, and the layout degrades in a browser.
 * Measured on a scratch deletion of the hero line: the bundle lost 261 bytes, taking `-mx-4`,
 * `max-w-xl`, `border-y` and `--container-xl` with it, while the whole suite stayed green.
 *
 * Both apps are covered from one table so the two stylesheets cannot drift apart.
 */
const APP_STYLESHEETS = [
  { app: 'apps/web', path: globalsCss },
  { app: 'apps/desktop', path: resolve(here, '../../../desktop/renderer/app/globals.css') },
] as const;

const SOURCED_PACKAGES = ['ui', 'game-art', 'farm', 'hero'] as const;

function sourceGlobFor(pkg: string): RegExp {
  return new RegExp(String.raw`@source\s+['"][^'"]*packages/${pkg}/src/\*\*/\*\.\{ts,tsx\}['"]`);
}

describe('every app stylesheet scans every shared UI package', () => {
  for (const { app, path } of APP_STYLESHEETS) {
    const css = readFileSync(path, 'utf8');

    it(`${app} globals.css declares @source lines at all`, () => {
      expect(css.match(/@source\s/g) ?? [], `${app}: no @source directive found`).not.toHaveLength(
        0,
      );
    });

    for (const pkg of SOURCED_PACKAGES) {
      it(`${app} globals.css sources packages/${pkg}`, () => {
        expect(
          css,
          `${app}/globals.css does not @source packages/${pkg}/src. Classes used only by that ` +
            `package's components will be absent from the CSS bundle, with no build, type, lint ` +
            `or unit-test failure to say so.`,
        ).toMatch(sourceGlobFor(pkg));
      });
    }
  }

  it('red state: the matcher rejects a stylesheet missing the package it is asked about', () => {
    const withoutHero = "@source '../../../../packages/ui/src/**/*.{ts,tsx}';\n";
    expect(sourceGlobFor('hero').test(withoutHero)).toBe(false);
    expect(sourceGlobFor('ui').test(withoutHero)).toBe(true);
  });
});
