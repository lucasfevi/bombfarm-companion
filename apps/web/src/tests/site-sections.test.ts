import { describe, expect, it } from 'vitest';
import { STRINGS } from '@/shared/i18n';
import {
  NAV_SECTIONS,
  SITE_SECTIONS,
  SITE_SECTION_HREF,
  SITE_SECTION_LABEL_KEY,
  isSiteSectionActive,
} from '@/shared/lib/site-sections';

describe('site sections', () => {
  it('home is first and planner is second, in the order the nav draws them', () => {
    expect(SITE_SECTIONS).toEqual([
      'home',
      'planner',
      'farm',
      'optimizer',
      'inventory',
      'account',
      'download',
    ]);
    expect(NAV_SECTIONS).toEqual(['home', 'planner', 'farm', 'optimizer', 'inventory', 'account']);
    expect(SITE_SECTION_HREF.home).toBe('/');
    expect(SITE_SECTION_HREF.planner).toBe('/planner');
    expect(SITE_SECTION_LABEL_KEY.home).toBe('navHome');
    expect(STRINGS.en[SITE_SECTION_LABEL_KEY.home]).toBe('Home');
  });

  it('home matches only the root and planner matches its own prefix', () => {
    expect(isSiteSectionActive('home', '/')).toBe(true);
    expect(isSiteSectionActive('home', '/planner')).toBe(false);
    expect(isSiteSectionActive('planner', '/planner/anything')).toBe(true);
    expect(isSiteSectionActive('planner', '/')).toBe(false);
  });

  it('download is a section but not a tab', () => {
    expect(SITE_SECTIONS).toContain('download');
    expect(NAV_SECTIONS).not.toContain('download');
  });
});
