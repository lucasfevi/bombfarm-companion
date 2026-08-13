import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildPlanningModel } from '../../lib/planning/account-model';
import { syntheticAccountView } from '../../lib/planning/fixtures/synthetic-views';
import { FidelityNotice } from './fidelity-notice';

describe('FidelityNotice (MPV-06, MPV-07, MPV-08)', () => {
  it('renders nothing when grade is full (MPV-06)', () => {
    const model = buildPlanningModel(syntheticAccountView());
    const html = renderToStaticMarkup(createElement(FidelityNotice, { model }));
    expect(html).toBe('');
  });

  it('names every degraded section, in report order (MPV-07)', () => {
    const model = buildPlanningModel(
      syntheticAccountView({ sectionStatuses: { skills: 'missing', items: 'missing' } }),
    );
    const html = renderToStaticMarkup(createElement(FidelityNotice, { model }));
    expect(html).toContain('data-testid="fidelity-notice"');
    expect(html).toContain('data-testid="fidelity-section-skills"');
    expect(html).toContain('data-testid="fidelity-section-items"');
    // ACCOUNT_SECTIONS order places "skills" before "items".
    expect(html.indexOf('fidelity-section-skills')).toBeLessThan(html.indexOf('fidelity-section-items'));
  });

  it('a degraded section additionally surfaces missingKeys (MPV-08)', () => {
    const model = buildPlanningModel(
      syntheticAccountView({
        sectionStatuses: { skills: 'degraded' },
        missingKeysBySection: { skills: ['totals.dmg_static'] },
      }),
    );
    const html = renderToStaticMarkup(createElement(FidelityNotice, { model }));
    expect(html).toContain('data-testid="fidelity-missing-keys"');
    expect(html).toContain('totals.dmg_static');
  });
});
