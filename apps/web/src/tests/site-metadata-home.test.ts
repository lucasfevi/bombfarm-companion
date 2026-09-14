import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';
import { SITE_URL, sectionMetadata, sectionSlug } from '@/shared/lib/site-metadata';

const PLANNER_DESCRIPTION =
  "Import your Bomb Farm save and see what your next skill point is worth — every hero's geared stats, gear sets, points and DPS. Free, and the save never leaves your browser.";

describe('front page metadata', () => {
  it('the sitemap lists seven routes, the front page first at full priority and the planner at its own address', () => {
    const entries = sitemap();

    expect(entries).toEqual([
      { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
      { url: `${SITE_URL}/planner`, changeFrequency: 'weekly', priority: 0.8 },
      { url: `${SITE_URL}/farm`, changeFrequency: 'weekly', priority: 0.8 },
      { url: `${SITE_URL}/optimizer`, changeFrequency: 'weekly', priority: 0.8 },
      { url: `${SITE_URL}/inventory`, changeFrequency: 'weekly', priority: 0.8 },
      { url: `${SITE_URL}/account`, changeFrequency: 'weekly', priority: 0.8 },
      { url: `${SITE_URL}/download`, changeFrequency: 'weekly', priority: 0.8 },
    ]);
    expect(entries.map((entry) => entry.url)).not.toContain(`${SITE_URL}/phases`);
    expect(entries.map((entry) => entry.url)).not.toContain(`${SITE_URL}/team-plan`);
  });

  it("the front page carries the site title and the planner a title of its own, with the planner's description unchanged", () => {
    const home = sectionMetadata('home');
    const planner = sectionMetadata('planner');

    expect(home.title).toBe('Bomb Farm Companion');
    expect(home.description).toBe(
      "Your Bomb Farm account at a glance — the roster ranked by DPS, the phase that pays most, the optimizer's plan and what it is all worth. Free, and the save never leaves your browser.",
    );
    expect(planner.title).toBe('Planner — Bomb Farm Companion');
    expect(planner.description).toBe(PLANNER_DESCRIPTION);
    expect(home.description).not.toBe(planner.description);
  });

  it('the root path resolves to the home slug', () => {
    expect(sectionSlug('home')).toBe('home');
    expect(sectionSlug('planner')).toBe('planner');
  });
});
