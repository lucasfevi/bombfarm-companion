import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ABILITIES } from '@bombfarm/domain/model';
import { PROPS } from '@bombfarm/domain/phases';
import { HERO_SKIN_COUNT, heroAvatarSrc, itemIconSrc, propIconSrc, dropIconSrc } from '@bombfarm/domain/wiki-assets';
import { DROP_RATES, type DropRateId } from '@bombfarm/domain/phase-wiki';
import catalog from '@bombfarm/domain/data/catalog.json';

const assetsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

/** `wiki-assets.ts` builds a `/wiki-assets/...` public-root URL; resolve it against this package's own bundle. */
const assetPath = (src: string) => resolve(assetsRoot, src.replace(/^\/wiki-assets\//, ''));

describe('bundled wiki assets', () => {
  it('ships PNG for every modeled ability', () => {
    const dir = resolve(assetsRoot, 'abilities');
    const files = new Set(readdirSync(dir).filter((f) => f.endsWith('.png')));
    for (const a of ABILITIES) {
      expect(files.has(`${a.id}.png`), `missing abilities/${a.id}.png`).toBe(true);
    }
  });

  /**
   * Item art is keyed by the SET's native level, which a game patch can re-key wholesale
   * (2026-08-15 moved 168 of 240 filenames). The catalog is regenerated then; the bundle is a
   * separate manual step, and when it is skipped every re-keyed item renders a blank frame with
   * no build or runtime error. Both directions are asserted so a stale leftover is caught too.
   */
  it('ships item art for every catalog def, and bundles no orphaned item art', () => {
    // Non-vacuity: an empty or truncated catalog would make the loop below prove nothing.
    expect(catalog.defs.length, 'catalog def count').toBeGreaterThan(200);

    const wanted = new Set<string>();
    const unresolved: string[] = [];
    const missing: string[] = [];

    for (const def of catalog.defs) {
      const src = itemIconSrc(def.id);
      if (!src) {
        unresolved.push(def.id);
        continue;
      }
      // `src` is a public-root URL (`/wiki-assets/items/…`); resolve it against the bundle so
      // the assertion follows the real helper output, not a re-derived filename.
      wanted.add(src.slice(src.lastIndexOf('/') + 1));
      if (!existsSync(assetPath(src))) missing.push(`${def.id} -> ${src}`);
    }

    expect(unresolved, 'catalog defs itemIconSrc returned null for').toEqual([]);
    expect(missing, 'catalog defs whose art is not bundled').toEqual([]);

    const dir = resolve(assetsRoot, 'items');
    const orphaned = readdirSync(dir).filter((f) => !wanted.has(f));
    expect(orphaned, 'bundled item art no catalog def points at').toEqual([]);
  });

  /**
   * Same failure shape as the item guard, one table further along: `heroAvatarSrc` indexes a
   * fixed array and falls back to `?? 1`, so an index with no bundled file renders ANOTHER
   * hero's face — wrong art, not a missing image, so nothing errors.
   *
   * SCOPE — read before trusting this to catch the next appearance. This enforces a bijection
   * between `SKIN_AVATAR_FILE` and the bundled files: a half-applied edit (bumping the count
   * without adding art, adding art without raising the count, or pointing two indices at one
   * file) fails here. It CANNOT tell that the *game* has more appearances than the code knows
   * about — with `HERO_SKIN_COUNT = 7` and seven bundled files, the pre-#98 state, this test is
   * green. That gap is real and unguarded: detecting it needs an external signal about the
   * game's skin count, which nothing in the app observes. The wiki drift job is the only thing
   * positioned to notice, and it does not track this field today.
   */
  it('ships hero art for every skin index, and bundles no unreachable hero art', () => {
    const dir = resolve(assetsRoot, 'hero');
    const wanted = new Set<string>();
    const missing: string[] = [];

    for (let skin = 0; skin < HERO_SKIN_COUNT; skin += 1) {
      const src = heroAvatarSrc(skin);
      const file = src.slice(src.lastIndexOf('/') + 1);
      // A duplicate here means two skin indices share one face — the `?? 1` bug's signature.
      expect(wanted.has(file), `skin ${skin} reuses ${file}`).toBe(false);
      wanted.add(file);
      if (!existsSync(assetPath(src))) missing.push(`skin ${skin} -> ${src}`);
    }

    expect(missing, 'skin indices whose avatar is not bundled').toEqual([]);

    // Only `hero{N}_avatar.png` participates; the directory also holds a
    // `hero6-bomb-activation/` subdirectory of unrelated sprites.
    const bundled = readdirSync(dir).filter((f) => /^hero\d+_avatar\.png$/.test(f));
    expect(bundled.length, 'bundled hero avatars').toBe(HERO_SKIN_COUNT);
    const orphaned = bundled.filter((f) => !wanted.has(f));
    expect(orphaned, 'bundled hero art no skin index points at').toEqual([]);
  });

  /**
   * `propIconSrc` is a bare string join over the prop's own name, so a renamed prop or a
   * missing mirror yields a well-formed path to nothing: the phase tables draw a broken
   * image and neither the type checker nor any math test notices.
   *
   * Forward direction ONLY, unlike the item and hero guards above. `env/` is a mixed
   * directory — it also holds `bomb`, `boss`, `jaula` and the five `cage_ato*` sprites,
   * which no prop points at — so a reverse "no orphaned art" sweep would fail on assets
   * that are legitimately reachable from elsewhere.
   */
  it('ships env art for every modeled prop', () => {
    // Non-vacuity: a truncated PROPS table would make the loop below prove nothing.
    expect(PROPS.length, 'modeled props').toBe(10);

    const missing: string[] = [];
    for (const prop of PROPS) {
      const src = propIconSrc(prop.name);
      expect(src, `propIconSrc returned null for ${prop.name}`).not.toBeNull();
      if (!existsSync(assetPath(src!))) missing.push(`${prop.name} -> ${src}`);
    }

    expect(missing, 'props whose env art is not bundled').toEqual([]);
  });

  /**
   * Same failure mode as the prop sweep above, with a much wider blast radius: `dropIconSrc`
   * builds 21 paths across three directories (`chests/`, `houses/`, `key/`), none of which any
   * other helper reaches. A missing drop sprite draws a broken image in the Drops panel and no
   * math or type check notices.
   *
   * Sharper here than for props, because these filenames are this repo's own rather than
   * upstream's: the per-band sprites are renamed on the way in, so nothing upstream would ever
   * agree with them and a rename typo has no second reader. See
   * `docs/bundled-art-provenance.md`.
   *
   * Every band is swept, not just one, because the per-band families are built by interpolating
   * the difficulty slug into the filename — so a family can be correct at ato 1 and dead at ato 4.
   *
   * Forward direction only, for the same reason as props — `key/` also holds the two rarities
   * no gate band selects, so a reverse "no orphaned art" sweep would fail on them.
   */
  it('ships drop art for every modeled drop-chance row, in every difficulty band', () => {
    const ids = Object.keys(DROP_RATES) as DropRateId[];
    const bands = [1, 2, 3, 4, 5];
    // Non-vacuity: a shrunken DROP_RATES would make the loop below prove nothing.
    expect(ids.length, 'modeled drop rows').toBe(5);

    const missing: string[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      for (const ato of bands) {
        const src = dropIconSrc(id, ato);
        expect(src, `dropIconSrc returned null for ${id} at ato ${ato}`).not.toBeNull();
        seen.add(src!);
        if (!existsSync(assetPath(src!))) missing.push(`${id}@${ato} -> ${src}`);
      }
    }

    expect(missing, 'drop rows whose art is not bundled').toEqual([]);
    // Four per-band families of 5, plus the one fixed item chest. Pins the count so a family
    // silently collapsing to a single sprite fails here rather than looking fine.
    expect(seen.size, 'distinct sprites the panel can reach').toBe(21);
  });
});
