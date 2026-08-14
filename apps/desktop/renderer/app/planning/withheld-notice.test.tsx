import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WithheldNotice } from './withheld-notice';
import type { SectionUsability } from '../../lib/planning/types';

const UNUSABLE_SKILLS: SectionUsability = {
  section: 'skills',
  status: 'missing',
  capturedAt: null,
  missingKeys: [],
  usable: false,
};

describe('WithheldNotice — always-mounted, names quantity/section/status (design §5, no-layout-shift rule 1)', () => {
  it('renders withheld-<quantity> naming the section and its status in player language', () => {
    const html = renderToStaticMarkup(
      createElement(WithheldNotice, { quantity: 'dps', sections: [UNUSABLE_SKILLS] }),
    );
    expect(html).toContain('data-testid="withheld-dps"');
    expect(html).toContain('your skill tree');
    expect(html).not.toContain('skills'); // the raw section key must not leak into copy
  });

  it('never renders a dash, zero, NaN or spinner glyph in place of the withheld number', () => {
    const html = renderToStaticMarkup(
      createElement(WithheldNotice, { quantity: 'nextPointRanking', sections: [UNUSABLE_SKILLS] }),
    );
    expect(html).not.toMatch(/>\s*—\s*</);
    expect(html).not.toMatch(/>\s*0\s*</);
    expect(html).not.toMatch(/>\s*NaN\s*</);
  });

  it('renders a distinct testid per AdviceQuantity', () => {
    const quantities = ['rosterRow', 'gearSummary', 'dps', 'nextPointRanking', 'resetAdvice'] as const;
    for (const quantity of quantities) {
      const html = renderToStaticMarkup(createElement(WithheldNotice, { quantity, sections: [UNUSABLE_SKILLS] }));
      expect(html).toContain(`data-testid="withheld-${quantity}"`);
    }
  });
});
