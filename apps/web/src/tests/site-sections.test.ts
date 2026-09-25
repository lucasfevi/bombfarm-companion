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
  it('home is first and heroes is second, in the order the nav draws them', () => {
    expect(SITE_SECTIONS).toEqual([
      'home',
      'heroes',
      'farm',
      'optimizer',
      'inventory',
      'skills',
      'account',
      'download',
      'privacy',
    ]);
    expect(NAV_SECTIONS).toEqual([
      'home',
      'heroes',
      'farm',
      'optimizer',
      'inventory',
      'skills',
      'account',
    ]);
    expect(SITE_SECTION_HREF.home).toBe('/');
    expect(SITE_SECTION_HREF.heroes).toBe('/heroes');
    expect(SITE_SECTION_LABEL_KEY.heroes).toBe('navHeroes');
    expect(STRINGS.en[SITE_SECTION_LABEL_KEY.heroes]).toBe('Heroes');
    expect(STRINGS.pt[SITE_SECTION_LABEL_KEY.heroes]).toBe('Heróis');
    expect(SITE_SECTION_LABEL_KEY.home).toBe('navHome');
    expect(STRINGS.en[SITE_SECTION_LABEL_KEY.home]).toBe('Home');
    expect(SITE_SECTION_LABEL_KEY.skills).toBe('navSkills');
    expect(SITE_SECTION_HREF.skills).toBe('/skills');
    expect(STRINGS.en[SITE_SECTION_LABEL_KEY.skills]).toBe('Skill Tree');
    expect(STRINGS.pt[SITE_SECTION_LABEL_KEY.skills]).toBe('Árvore');
  });

  it('home matches only the root and heroes matches its own prefix', () => {
    expect(isSiteSectionActive('home', '/')).toBe(true);
    expect(isSiteSectionActive('home', '/heroes')).toBe(false);
    expect(isSiteSectionActive('heroes', '/heroes/anything')).toBe(true);
    expect(isSiteSectionActive('heroes', '/')).toBe(false);
  });

  it('download is a section but not a tab', () => {
    expect(SITE_SECTIONS).toContain('download');
    expect(NAV_SECTIONS).not.toContain('download');
  });

  it('privacy is a section reached from the footer, not a tab', () => {
    expect(NAV_SECTIONS).not.toContain('privacy');
    expect(SITE_SECTION_HREF.privacy).toBe('/privacy');
    expect(STRINGS.en[SITE_SECTION_LABEL_KEY.privacy]).toBe('Privacy');
    expect(STRINGS.pt[SITE_SECTION_LABEL_KEY.privacy]).toBe('Privacidade');
  });
});
