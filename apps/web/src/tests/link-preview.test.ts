import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import previews from '@/shared/lib/site-previews.json';
import {
  SECTION_PREVIEWS,
  SITE_THEME_COLOR,
  sectionMetadata,
  sectionOgImagePath,
} from '@/shared/lib/site-metadata';
import { SITE_SECTIONS } from '@/shared/lib/site-sections';

const publicDir = path.resolve(__dirname, '../../public');

function publicFile(urlPath: string): string {
  return path.join(publicDir, urlPath.replace(/^\//, ''));
}

describe('link preview', () => {
  it('gives every section its own title, description and card', () => {
    for (const section of SITE_SECTIONS) {
      const preview = SECTION_PREVIEWS[section];
      expect(preview, section).toBeDefined();
      expect(preview.title.length, section).toBeGreaterThan(0);
      expect(preview.description.length, section).toBeGreaterThan(0);
      expect(preview.cardHeadline.length, section).toBeGreaterThan(0);
    }

    const descriptions = SITE_SECTIONS.map((section) => SECTION_PREVIEWS[section].description);
    expect(new Set(descriptions).size).toBe(SITE_SECTIONS.length);
  });

  it('sets openGraph on every section, not only the page title', () => {
    for (const section of SITE_SECTIONS) {
      const preview = SECTION_PREVIEWS[section];
      const meta = sectionMetadata(section);

      expect(meta.openGraph?.title, section).toBe(preview.title);
      expect(meta.openGraph?.description, section).toBe(preview.description);
      expect(meta.twitter?.title, section).toBe(preview.title);
      expect(meta.twitter?.description, section).toBe(preview.description);
    }
  });

  it('points each section at its own share card, and ships the file', () => {
    const images = SITE_SECTIONS.map((section) => sectionOgImagePath(section));
    expect(new Set(images).size).toBe(SITE_SECTIONS.length);

    for (const image of images) {
      expect(existsSync(publicFile(image)), image).toBe(true);
    }

    // The generator names files by its own copy of the slug rule; an orphan here means the two
    // drifted and some route is pointing at a card that was never drawn under that name.
    const drawn = readdirSync(path.join(publicDir, 'og')).sort();
    expect(drawn).toEqual(images.map((image) => path.basename(image)).sort());
  });

  it('keeps /og.png so links shared before the per-section cards still preview', () => {
    expect(existsSync(publicFile('/og.png'))).toBe(true);
  });

  /**
   * The regression this whole file exists for: `og.png` was a committed binary with no
   * generator, so a copy change renamed the site everywhere except in the image every shared
   * link actually served. The manifest records what `pnpm --filter @bombfarm/web og` last drew
   * from, so editing the copy without re-running it fails here instead of shipping.
   */
  it('was rendered from the copy the site ships today', () => {
    const manifestPath = path.resolve(__dirname, '../../scripts/og-manifest.json');
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { renderedFrom: unknown };
    expect(manifest.renderedFrom).toEqual(previews);
  });

  /**
   * A shared link shows all three of these at once — the embed edge is `theme-color`, the card
   * sits beside it and the favicon sits above it — so the oranges have to be one orange. Each of
   * the three was written by hand at a different time, and the `theme-color` and the favicon had
   * both drifted to a value the app itself had stopped using.
   */
  it('paints the embed edge, the card and the favicon in one accent', () => {
    const read = (relative: string) =>
      readFileSync(path.resolve(__dirname, relative), 'utf8');

    const cardAccent = /accent:\s*'(#[0-9a-f]{6})'/.exec(
      read('../../scripts/generate-og-images.mjs'),
    )?.[1];
    const faviconAccents = new Set(read('../../public/favicon.svg').match(/#[0-9a-f]{6}/g) ?? []);

    expect(cardAccent).toBeDefined();
    expect(SITE_THEME_COLOR).toBe(cardAccent);
    expect(faviconAccents).toContain(SITE_THEME_COLOR);
  });
});
