import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/shared/lib/site-metadata';
import { SITE_SECTIONS, SITE_SECTION_HREF } from '@/shared/lib/site-sections';

/**
 * Generated rather than committed: the checked-in `sitemap.xml` listed only `/` and never grew a
 * line as five more routes shipped. Driving it off `SITE_SECTIONS` means adding a route adds its
 * sitemap entry. `/phases` is deliberately absent — it is a redirect stub.
 */
/** `output: 'export'` refuses to collect a metadata route that has not declared itself static. */
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return SITE_SECTIONS.map((section) => ({
    url: new URL(SITE_SECTION_HREF[section], SITE_URL).toString(),
    changeFrequency: 'weekly',
    priority: section === 'planner' ? 1 : 0.8,
  }));
}
