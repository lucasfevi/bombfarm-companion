import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { heroAvatarSrc } from '@bombfarm/domain/wiki-assets';
import { SkinIdentity } from './skin-identity';

function render(props: Parameters<typeof SkinIdentity>[0]) {
  return renderToStaticMarkup(createElement(SkinIdentity, props));
}

describe('SkinIdentity', () => {
  it('draws the avatar a hero wearing the skin shows, named by the skin', () => {
    const html = render({ skin: 4, name: 'Forest Warden Skin' });
    expect(html).toContain(`src="${heroAvatarSrc(4)}"`);
    expect(html).toContain('alt="Forest Warden Skin"');
    expect(html).toContain('>Forest Warden Skin<');
  });

  it('frames the avatar in the grey of the lowest tier, since a skin has no rarity', () => {
    expect(render({ skin: 8, name: 'Royal Sentinel Skin' })).toContain('border-rar-0');
  });

  it('opens no card on hover — there is no hero behind the art', () => {
    expect(render({ skin: 5, name: 'Shadow Hunter Skin' })).not.toContain('data-peek=');
  });
});
