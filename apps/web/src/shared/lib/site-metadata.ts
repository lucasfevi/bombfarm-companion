import type { Metadata } from 'next';
import previews from './site-previews.json';
import { SITE_SECTION_HREF, type SiteSection } from './site-sections';

export const SITE_URL = 'https://bombfarm-companion.vercel.app';
export const SITE_NAME = 'Bomb Farm Companion';

/**
 * `--color-accent` resolved to sRGB. Chat clients paint a shared link's embed edge with the
 * page's `theme-color`, so this is link-preview chrome as much as browser chrome — it drifted
 * once already, to a value the app itself stopped using.
 */
export const SITE_THEME_COLOR = '#e78a45';

export type SectionPreview = {
  /** Section name drawn above the headline on the share card. */
  readonly eyebrow: string;
  /** `<title>`, and the bold first line of a link preview. */
  readonly title: string;
  readonly description: string;
  /** Share-card headline, one entry per rendered line — wrapping is chosen, not measured. */
  readonly cardHeadline: readonly string[];
  readonly cardChips: readonly string[];
};

export const SECTION_PREVIEWS: Record<SiteSection, SectionPreview> = previews;

/**
 * `planner` for `/`, the path without its slash for everything else — so the image file and the
 * route it belongs to can never be paired up wrong.
 */
export function sectionSlug(section: SiteSection): string {
  const href = SITE_SECTION_HREF[section];
  return href === '/' ? 'planner' : href.slice(1);
}

export function sectionOgImagePath(section: SiteSection): string {
  return `/og/${sectionSlug(section)}.png`;
}

/**
 * Every route needs its own `openGraph`, not just its own `title`: a segment that sets `title`
 * alone still inherits the parent's whole `openGraph` object, so before this existed each page's
 * description reached the browser tab and none of them reached a shared link — every link
 * previewed as the planner.
 */
export function sectionMetadata(section: SiteSection): Metadata {
  const preview = SECTION_PREVIEWS[section];
  const href = SITE_SECTION_HREF[section];
  const image = {
    url: sectionOgImagePath(section),
    width: 1200,
    height: 630,
    alt: `${SITE_NAME} — ${preview.cardHeadline.join(' ')}`,
  };

  return {
    title: preview.title,
    description: preview.description,
    alternates: { canonical: href },
    openGraph: {
      type: 'website',
      url: new URL(href, SITE_URL).toString(),
      siteName: SITE_NAME,
      title: preview.title,
      description: preview.description,
      images: [image],
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: preview.title,
      description: preview.description,
      images: [image.url],
    },
  };
}
