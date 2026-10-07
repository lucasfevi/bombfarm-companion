import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { farmCopyFor } from '../copy';
import { FarmPass } from './farm-pass';
import { FarmReturnBonus } from './farm-return-bonus';

const en = farmCopyFor('en');
const pt = farmCopyFor('pt');

describe('FarmPass', () => {
  it('without a change handler shows the state read-only, with no switch', () => {
    const on = renderToStaticMarkup(<FarmPass pass t={en} />);
    expect(on).toContain('data-pass="on"');
    expect(on).toContain('>On<');
    expect(on).not.toContain('role="switch"');
    expect(renderToStaticMarkup(<FarmPass pass={false} t={en} />)).toContain('data-pass="off"');
  });

  it('says where the state comes from only when the player cannot set it', () => {
    expect(renderToStaticMarkup(<FarmPass pass t={en} />)).toContain(en.farmRankingPassTipDetected);
    expect(renderToStaticMarkup(<FarmPass pass t={en} onPassChange={vi.fn()} />)).not.toContain(
      en.farmRankingPassTipDetected,
    );
  });

  it('with a change handler is a switch reflecting the value', () => {
    const html = renderToStaticMarkup(<FarmPass pass t={en} onPassChange={vi.fn()} />);
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).not.toContain('data-testid="farm-pass-state"');
  });

  it('speaks Portuguese', () => {
    expect(renderToStaticMarkup(<FarmPass pass t={pt} />)).toContain('Passe');
  });
});

describe('FarmReturnBonus', () => {
  it('is an on/off switch', () => {
    const on = renderToStaticMarkup(<FarmReturnBonus value="on" onChange={vi.fn()} t={en} />);
    const off = renderToStaticMarkup(<FarmReturnBonus value="off" onChange={vi.fn()} t={en} />);
    expect(on).toContain('aria-checked="true"');
    expect(off).toContain('aria-checked="false"');
  });
});
