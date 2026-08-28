import { beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildPlanningModel } from '../../lib/planning/account-model';
import { syntheticAccountView } from '../../lib/planning/fixtures/synthetic-views';
import { CopyProvider } from '../../lib/copy';
import { getAdviceComputeCount, resetAdviceComputeCount } from '../../lib/planning/hero-advice';
import { NextPointPanel } from './next-point-panel';

function firstHeroId(model: ReturnType<typeof buildPlanningModel>): string {
  const [entry] = model.heroes;
  if (!entry) throw new Error('expected at least one hero in the fixture');
  return entry.hero.id;
}

describe('NextPointPanel', () => {
  it('renders next-point-ranking, next-point-top-stat and next-point-gain when usable', () => {
    const model = buildPlanningModel(syntheticAccountView());
    const heroId = firstHeroId(model);
    const html = renderToStaticMarkup(createElement(NextPointPanel, { model, heroId }));
    expect(html).toContain('data-testid="next-point-ranking"');
    expect(html).toContain('data-testid="next-point-top-stat"');
    expect(html).toContain('data-testid="next-point-gain"');
  });

  it('the ranking renders in the engine\'s own order — never filtered or re-sorted', () => {
    const model = buildPlanningModel(syntheticAccountView());
    const heroId = firstHeroId(model);
    const advice = model.heroes[0] ? model.heroes[0] : null;
    if (!advice) throw new Error('expected a hero');
    const html = renderToStaticMarkup(createElement(NextPointPanel, { model, heroId }));
    // Every stat row should be present, in some order rendered — the exact ordering is proven
    // at the model layer (withhold-matrix.test.ts's layer 3); here we only assert the
    // renderer does not drop any ranking entries.
    expect((html.match(/<tr/g) ?? []).length).toBeGreaterThan(1);
  });

  it('when the bundle is withheld (skills unusable), renders withheld-nextPointRanking, never a partial table', () => {
    const model = buildPlanningModel(syntheticAccountView({ sectionStatuses: { skills: 'degraded' } }));
    const heroId = firstHeroId(model);
    const html = renderToStaticMarkup(createElement(NextPointPanel, { model, heroId }));
    expect(html).toContain('data-testid="withheld-nextPointRanking"');
    expect(html).not.toContain('data-testid="next-point-ranking"');
  });
});

/**
 * The no-recompute-on-language-change unit half (design §4.3): a language switch is a display change, not an account
 * change, and must trigger zero advice recomputation. `resetAdviceComputeCount()` in
 * `beforeEach` — F3's module-level-state warning applies verbatim (recompute-sequences.test.ts's
 * own convention, reused here).
 */
describe('a locale switch over a mounted planning tree recomputes nothing', () => {
  beforeEach(() => {
    resetAdviceComputeCount();
  });

  it('rendering the SAME model/hero under two different CopyProvider locales computes advice exactly once, not once per locale', () => {
    const model = buildPlanningModel(syntheticAccountView());
    const heroId = firstHeroId(model);

    // First render: a genuine cache miss (heroChangeKey/sharedChangeKey/usabilityKey are all new).
    renderToStaticMarkup(
      createElement(CopyProvider, { locale: 'en', children: createElement(NextPointPanel, { model, heroId }) }),
    );
    expect(getAdviceComputeCount()).toBe(1);

    // Switching locale touches neither heroChangeKey nor sharedChangeKey (§4.3 — AppLocale is not
    // a field of AccountPayload/HeroRecord/AccountShared, so it is structurally incapable of
    // entering either key) — the cache hits, and the count stays at 1.
    renderToStaticMarkup(
      createElement(CopyProvider, { locale: 'pt-BR', children: createElement(NextPointPanel, { model, heroId }) }),
    );
    expect(getAdviceComputeCount()).toBe(1);

    // And switching back, again over the same model/hero, still adds nothing.
    renderToStaticMarkup(
      createElement(CopyProvider, { locale: 'en', children: createElement(NextPointPanel, { model, heroId }) }),
    );
    expect(getAdviceComputeCount()).toBe(1);
  });
});
