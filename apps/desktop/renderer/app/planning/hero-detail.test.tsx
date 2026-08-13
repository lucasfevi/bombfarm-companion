import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildPlanningModel } from '../../lib/planning/account-model';
import { syntheticAccountView } from '../../lib/planning/fixtures/synthetic-views';
import { HeroDetail } from './hero-detail';

function firstHeroId(model: ReturnType<typeof buildPlanningModel>): string {
  const [entry] = model.heroes;
  if (!entry) throw new Error('expected at least one hero in the fixture');
  return entry.hero.id;
}

describe('HeroDetail (MPV-02, MPV-09, MPV-13)', () => {
  it('renders hero-detail and hero-detail-name testids with the selected hero\'s name', () => {
    const model = buildPlanningModel(syntheticAccountView());
    const heroId = firstHeroId(model);
    const html = renderToStaticMarkup(createElement(HeroDetail, { model, heroId }));
    expect(html).toContain('data-testid="hero-detail"');
    expect(html).toMatch(/data-testid="hero-detail-name"[^>]*>[^<]*Alpha/);
  });

  it('when skills is not usable, the DPS figure renders a withheld-dps notice, never a placeholder glyph', () => {
    const model = buildPlanningModel(syntheticAccountView({ sectionStatuses: { skills: 'missing' } }));
    const heroId = firstHeroId(model);
    const html = renderToStaticMarkup(createElement(HeroDetail, { model, heroId }));
    expect(html).toContain('data-testid="withheld-dps"');
    // Isolate the withheld-dps fragment: it must never contain a placeholder in place of the
    // number it stands in for. (`gearSummary` legitimately renders a real "0" here — items is
    // still usable in this fixture — so the assertion is scoped to the dps notice, not the page.)
    const withheldDpsStart = html.indexOf('data-testid="withheld-dps"');
    const withheldDpsFragment = html.slice(withheldDpsStart, withheldDpsStart + 400);
    expect(withheldDpsFragment).not.toMatch(/>\s*—\s*</);
    expect(withheldDpsFragment).not.toMatch(/>\s*NaN\s*</);
  });

  it('when nothing is selected, it renders the select-hero prompt rather than an empty number', () => {
    const model = buildPlanningModel(syntheticAccountView());
    const html = renderToStaticMarkup(createElement(HeroDetail, { model, heroId: null }));
    expect(html).toContain('data-testid="hero-detail"');
    expect(html).not.toContain('hero-detail-name');
  });
});
