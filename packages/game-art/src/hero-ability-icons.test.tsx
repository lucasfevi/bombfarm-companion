import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeroAbilityIcons } from './hero-ability-icons';

function render(props: Parameters<typeof HeroAbilityIcons>[0]) {
  return renderToStaticMarkup(createElement(HeroAbilityIcons, props));
}

const ABILITIES = { olho_clinico: 12 };

/** The badge is text between tags; the accessible name carries the same reading inside a quote. */
const BADGE = />12\/20</;

describe('HeroAbilityIcons', () => {
  it('draws each icon with its level badge by default', () => {
    expect(render({ abilities: ABILITIES, lang: 'en' })).toMatch(BADGE);
  });

  it('with the level off, the badge goes but the accessible name still reads it', () => {
    const html = render({ abilities: ABILITIES, lang: 'en', showLevel: false });
    expect(html).not.toMatch(BADGE);
    expect(html).toMatch(/aria-label="[^"]*, 12\/20"/);
  });
});
