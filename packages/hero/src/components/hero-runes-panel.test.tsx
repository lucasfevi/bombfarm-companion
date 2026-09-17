import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { statLabel } from '@bombfarm/domain/game-labels';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import { RUNE_AXES, runesOf } from '@bombfarm/domain/runes';
import { runeIconSrc } from '@bombfarm/domain/wiki-assets';
import { heroCopyFor, sub, type Lang } from '../copy';
import { fixtureHero, loadBreakdownFixture } from '../model/combat-breakdown.test-fixture';
import { HeroRunesPanel } from './hero-runes-panel';

const fixture = loadBreakdownFixture('payload-20260913-20heroes-runes.json');
const bellatrix = fixtureHero(fixture, 'Bellatrix');
const unruned = fixtureHero(fixture, 'Ivo');

function render(hero: typeof bellatrix, lang: Lang, defaultOpen = false): string {
  const label = (key: SheetKey) => (key === 'luck' ? 'Luck' : statLabel(key, lang));
  return renderToStaticMarkup(
    <HeroRunesPanel hero={hero} lang={lang} statLabel={label} defaultOpen={defaultOpen} />,
  );
}

describe('HeroRunesPanel', () => {
  it('draws nothing for a hero without runes, rather than an empty fold', () => {
    expect(runesOf(unruned)).toEqual([]);
    expect(render(unruned, 'en')).toBe('');
  });

  it.each(['en', 'pt'] as const)(
    '%s, opened: one tile per rune, each with its own sprite, the axis in the host vocabulary, and the strength over the buff time left',
    (lang) => {
      const t = heroCopyFor(lang);
      const runes = runesOf(bellatrix);
      // Every axis at once — the one fixture hero that covers the two non-sheet axes as well.
      expect(runes.map((rune) => rune.axis).sort()).toEqual([...RUNE_AXES].sort());

      const html = render(bellatrix, lang, true);
      expect(html).toMatch(/<h2[^>]*><button[^>]*>[^<]*Run/);
      expect(html).toContain(t.heroDetailRunesTip);
      expect(html.match(/<li /g)).toHaveLength(runes.length);

      for (const rune of runes) {
        expect(html, rune.axis).toContain(`src="${runeIconSrc(rune.axis, rune.rarity)}"`);
        expect(html, rune.axis).toContain(
          `>${sub(t.heroDetailRunePlayLeft, { hours: String(Math.round(rune.playSecondsLeft / 3600)) })}<`,
        );
      }
      expect(html.match(/>\+5%</g), 'one strength per rune').toHaveLength(runes.length);
      expect(html).toContain(`>${statLabel('critDmg', lang)}<`);
      expect(html).toContain(`>${t.heroDetailRuneAxisGold}<`);
      expect(html).toContain(`>${t.heroDetailRuneAxisXp}<`);
    },
  );

  it('starts folded: the header carries one sprite per rune and no tile is drawn', () => {
    const html = render(bellatrix, 'en');
    expect(html).not.toContain('<li ');
    const strip = html.slice(html.indexOf('hero-runes-folded'));
    expect(strip.match(/src="\/wiki-assets\/icons\/rune_/g)).toHaveLength(runesOf(bellatrix).length);
  });
});
