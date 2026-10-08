import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HeroAvatar } from './hero-avatar';
import { HeroDataFlagProvider, type HeroDataFlagResolver } from './hero-data-flag';

const FLAG = { label: 'Left out of calculations', tip: "The game stopped sending this hero's birth stats." };

function render(resolve: HeroDataFlagResolver, heroId: string | undefined) {
  return renderToStaticMarkup(
    createElement(HeroDataFlagProvider, {
      resolve,
      children: createElement(HeroAvatar, { skin: 0, rarityIdx: 1, name: 'Vex', heroId }),
    }),
  );
}

describe('HeroAvatar flag', () => {
  it('wears a keyboard-focusable dot with an accessible name for a hero the host holds back', () => {
    const html = render((id) => (id === 'h7' ? FLAG : undefined), 'h7');
    expect(html).toContain('data-testid="hero-data-flag"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Left out of calculations: The game stopped sending this hero&#x27;s birth stats."');
  });

  it('wears nothing for a hero the host does not hold back', () => {
    expect(render((id) => (id === 'h7' ? FLAG : undefined), 'h8')).not.toContain('hero-data-flag');
  });

  it('wears nothing when it is not told which hero it draws', () => {
    expect(render(() => FLAG, undefined)).not.toContain('hero-data-flag');
  });

  it('wears nothing without a host to ask', () => {
    expect(renderToStaticMarkup(createElement(HeroAvatar, { skin: 0, rarityIdx: 1, name: 'Vex', heroId: 'h7' }))).not.toContain(
      'hero-data-flag',
    );
  });
});
