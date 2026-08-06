# Game glyph authoring contract

Original single-color line art for Bomb Farm game chrome. Sources live here; SVGR compiles them into committed React components under `packages/ui/src/icon/game/`.

## Authoring rules

Every `.svg` in this directory must satisfy all of the following:

1. **24×24 grid** — `viewBox="0 0 24 24"`.
2. **Theme-driven color** — paint with `fill="currentColor"` only. No hex, `rgb()`, `hsl()`, or named colors.
3. **No dimensions** — omit `width` and `height` attributes (CSS `size-*` utilities set the box).
4. **No `<style>`** — no embedded CSS blocks.
5. **No external references** — no `<use>`, `xlink:href`, or links to other files.
6. **No raster** — no embedded `data:` URLs, base64, or bitmap content.
7. **No `id` attributes** — avoids duplicate-id collisions when multiple glyphs render on one page.

Only files with a `.svg` extension are part of the glyph set. This README and other non-`.svg` files are ignored by the drift test.

## After editing a source

Regenerate committed components:

```bash
pnpm --filter @bombfarm/ui icons:generate
```

Commit both the updated `.svg` and the generated `.tsx` output.

## Swapping art later

Replacing placeholder art changes **only**:

- the `.svg` file in this directory, and
- the matching row in `packages/ui/src/icon/glyph-manifest.ts` when promoting from `placeholder` to `approved`.

Do **not** change the glyph enum, registry keys, generated filenames, or the `Icon` API. The drift test asserts enum ↔ `.svg` ↔ `.tsx` ↔ registry stay one-to-one.
