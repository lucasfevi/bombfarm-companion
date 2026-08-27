import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeroIdentity } from './hero-identity';

function render(props: Parameters<typeof HeroIdentity>[0]) {
  return renderToStaticMarkup(createElement(HeroIdentity, props));
}

describe('HeroIdentity', () => {
  it('names a rarity it recognises', () => {
    const html = render({ name: 'Aurora', rarityIdx: 3, lang: 'en', variant: 'stacked' });
    expect(html).toContain('Epic');
  });

  it('treats a rarity index past the end as unknown rather than as a nameless rarity', () => {
    // The roster join accepts any non-negative number, so a tier this list does not know yet
    // arrives here intact. Naming it by index would render an empty line where a rarity belongs.
    const html = render({ name: 'Aurora', rarityIdx: 6, lang: 'en', variant: 'stacked' });
    expect(html).toContain('invisible');
    expect(html).not.toContain('undefined');
  });

  it('treats the -1 a failed rarity lookup returns as unknown', () => {
    const html = render({ name: 'Aurora', rarityIdx: -1, lang: 'en', variant: 'stacked' });
    expect(html).toContain('invisible');
    expect(html).not.toContain('undefined');
  });

  it('renders an id-only hero without inventing a rank, stars or rarity', () => {
    const html = render({ name: 'hero-7', lang: 'en', variant: 'stacked' });
    expect(html).toContain('hero-7');
    expect(html).toContain('—');
    expect(html).not.toContain('★');
    expect(html).not.toContain('undefined');
  });
});
