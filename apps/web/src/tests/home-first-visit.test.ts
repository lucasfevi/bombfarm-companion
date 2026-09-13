import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeFirstVisit } from '@/features/home/components/home-first-visit';
import { STRINGS, type Lang } from '@/shared/i18n';
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

const render = () => renderToStaticMarkup(createElement(HomeFirstVisit));

const escaped = (text: string) => text.replace(/'/g, '&#x27;');

describe('the front page on a first visit', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it('prints the eyebrow, the title, one sentence, one primary button and the hint in that order, in both locales', () => {
    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const strings = STRINGS[lang];
      const html = render();
      const markers = [
        `>${strings.homeFirstVisitEyebrow}</p>`,
        `<h2 class="`,
        `>${strings.homeFirstVisitTitle}</h2>`,
        `>${escaped(strings.homeFirstVisitBody)}</p>`,
        `>${strings.homeFirstVisitButton}</button>`,
        `>${escaped(strings.homeFirstVisitHint)}</p>`,
      ];
      const positions = markers.map((marker) => html.indexOf(marker));

      expect(html.startsWith('<div ')).toBe(true);
      expect(html).toContain('data-testid="home-first-visit"');
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((left, right) => left - right));
      expect(html.match(/<p /g)).toHaveLength(3);
      expect(html.match(/<h2 /g)).toHaveLength(1);
      expect(html.indexOf(`>${strings.homeFirstVisitEyebrow}</p>`)).toBeGreaterThan(
        html.indexOf('font-mono text-[11px] tracking-[0.17em] text-accent uppercase'),
      );
    }
  });

  it('its one button opens the import dialog', () => {
    const html = render();
    const source = readFileSync(
      join(WEB_PACKAGE_ROOT, 'src/features/home/components/home-first-visit.tsx'),
      'utf8',
    );

    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toMatch(/<button[^>]*class="[^"]*\bbg-accent\b[^"]*"[^>]*>/);
    expect(source).toContain('usePlannerStore((state) => state.openImportDialog)');
    expect(source.match(/onClick=/g)).toEqual(['onClick=']);
    expect(source).toContain('onClick={openImportDialog}');
    expect(source).toContain('<Button variant="primary" onClick={openImportDialog}>');
  });
});
