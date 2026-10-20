import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { farmCopyFor } from '../copy';
import { FarmPassBonus } from './farm-pass-bonus';

describe('FarmPassBonus', () => {
  const passBonus = { gold: 0.25, xp: 0.15 };

  it('shows the gold and XP adds as percentages, read-only and with its source named', () => {
    const html = renderToStaticMarkup(<FarmPassBonus passBonus={passBonus} t={farmCopyFor('en')} />);
    expect(html).toContain('+25% gold');
    expect(html).toContain('+15% XP');
    expect(html).not.toContain('role="switch"');
    expect(html).toContain(farmCopyFor('en').farmRankingPassTipDetected);
  });

  it('speaks Portuguese', () => {
    const html = renderToStaticMarkup(<FarmPassBonus passBonus={passBonus} t={farmCopyFor('pt')} />);
    expect(html).toContain('Bônus do Passe');
    expect(html).toContain('+25% ouro');
  });
});
