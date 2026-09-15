import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AbilityIcon } from './ability-icon';

function render(props: Parameters<typeof AbilityIcon>[0]) {
  return renderToStaticMarkup(createElement(AbilityIcon, props));
}

/** A real ability id — the icon path is built from the id itself, so any non-empty one renders. */
const CODE = 'olho_clinico';

describe('AbilityIcon', () => {
  it('draws the level badge when it is given one', () => {
    const html = render({ code: CODE, level: 12, max: 20 });
    expect(html).toContain('12/20');
  });

  it('seats the badge by padding the sprite up, so the two never overlap', () => {
    expect(render({ code: CODE, level: 12, max: 20 })).toMatch(/class="[^"]*pb-4/);
    expect(render({ code: CODE, size: 'xs', level: 12, max: 20 })).toMatch(/class="[^"]*pb-3\.5/);
  });

  it('takes no seat for a badge it does not draw', () => {
    // The failure this is about: an icon with no level still reserved a strip of empty tile under
    // the sprite, which reads as a row of icons with too much space beneath them.
    const html = render({ code: CODE, size: 'xs' });
    expect(html).not.toContain('12/20');
    expect(html).not.toMatch(/pb-3\.5/);
    expect(html).not.toMatch(/pb-4/);
  });

  it('draws no badge for a zero-width scale, and seats none either', () => {
    // `max: 0` would render "0/0" and divide a progress readout by nothing.
    const html = render({ code: CODE, level: 0, max: 0 });
    expect(html).not.toContain('0/0');
    expect(html).not.toMatch(/pb-4/);
  });

  it('renders nothing when there is no id to build a path from', () => {
    // `abilityIconSrc` files an icon by id without checking the bundle actually carries one, so
    // an empty id is the only case that resolves to no icon at all.
    expect(render({ code: '' })).toBe('');
  });
});
