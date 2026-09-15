import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeCardOutline } from '@/features/home/components/home-card-outline';
import { HomeSectionCard } from '@/features/home/components/home-section-card';
import type { HomeCardSection } from '@/features/home/model/home-card-state';
import { STRINGS, type Lang } from '@/shared/i18n';
import { SITE_SECTION_HREF, SITE_SECTION_LABEL_KEY } from '@/shared/lib/site-sections';
import { resetPlannerStoreForTests, usePlannerStore, type PlannerStore } from '@/shared/stores';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

vi.mock('@/shared/stores/planner-store', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/shared/stores/planner-store')>();
  const live = Object.assign(
    (selector: (state: PlannerStore) => unknown) => selector(real.usePlannerStore.getState()),
    real.usePlannerStore,
  );
  return { ...real, usePlannerStore: live };
});

const LANGS: readonly Lang[] = ['en', 'pt'];
const KINDS: readonly HomeCardSection[] = [
  'heroes',
  'farm',
  'optimizer',
  'inventory',
  'account',
  'download',
];

const textOf = (html: string) => html.replace(/<[^>]+>/g, '');

function render(props: Partial<Parameters<typeof HomeSectionCard>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(HomeSectionCard, {
      section: 'account',
      state: 'ready',
      context: 'phase, House and tree',
      footer: 'from your last import',
      children: createElement('p', null, '7 fields filled'),
      ...props,
    }),
  );
}

const openingOf = (html: string, testId: string) =>
  html.lastIndexOf('<div', html.indexOf(`data-testid="${testId}"`));
const header = (html: string) => html.slice(0, openingOf(html, 'home-card-body'));
const body = (html: string) =>
  html.slice(openingOf(html, 'home-card-body'), openingOf(html, 'home-card-footer'));
const footer = (html: string) => textOf(html.slice(openingOf(html, 'home-card-footer')));

describe('the front page card shell', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it('the header holds the section name, its context line and exactly one link to the section, and is not itself a link', () => {
    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const html = render();
      const label = STRINGS[lang][SITE_SECTION_LABEL_KEY.account];

      expect(html.startsWith(`<article aria-label="${label}"`)).toBe(true);
      expect(header(html)).toContain(`<h2 class="`);
      expect(textOf(header(html))).toBe(`${label}phase, House and tree${STRINGS[lang].homeOpenLink}`);
      expect(html.match(/<a /g)).toHaveLength(1);
      expect(html).toContain(`href="${SITE_SECTION_HREF.account}"`);
    }

    const source = readFileSync(
      join(WEB_PACKAGE_ROOT, 'src/features/home/components/home-section-card.tsx'),
      'utf8',
    );
    expect(source).not.toContain('onClick');
    expect(source.match(/href=/g)).toHaveLength(1);
    expect(source).toContain('href={SITE_SECTION_HREF[section]}');
    expect(source).toContain("buttonRecipe({ variant: 'ghost' })");
  });

  it('a card that still needs a save carries no link to its section', () => {
    const html = render({ state: 'needs', footer: 'Needs your heroes' });

    expect(html).not.toContain('<a ');
    expect(html).not.toContain(STRINGS.en.homeOpenLink);
  });

  it('a card in its needs state hides its body from assistive tech, renders the outline and prints only the needs line', () => {
    const untouched = render({ state: 'needs', footer: 'Needs your heroes' });
    expect(footer(untouched)).toBe('');

    usePlannerStore.setState({ phase: 51 });
    const html = render({ state: 'needs', footer: 'Needs your heroes' });

    expect(html).toContain('data-home-card-state="needs"');
    expect(html).not.toContain('<a ');
    expect(body(html)).toMatch(/^<div aria-hidden="true"/);
    expect(body(html)).toContain('data-testid="home-card-outline"');
    expect(body(html)).not.toContain('7 fields filled');
    expect(textOf(body(html))).toBe('');
    expect(footer(html)).toBe('Needs your heroes');
  });

  it('a recalculating card keeps its body and dims it', () => {
    const html = render({ state: 'recalculating' });

    expect(html).toContain('data-home-card-state="recalculating"');
    expect(body(html)).toContain('<p>7 fields filled</p>');
    expect(body(html)).toMatch(/class="[^"]*\bopacity-50\b/);
    expect(html).not.toContain('aria-hidden');
    expect(render()).not.toContain('opacity-50');
  });

  it('every outline kind renders bars and no text', () => {
    for (const kind of KINDS) {
      const html = renderToStaticMarkup(createElement(HomeCardOutline, { kind }));

      expect(textOf(html)).toBe('');
      expect((html.match(/bg-bg-2/g) ?? []).length).toBeGreaterThan(0);
    }
  });
});
