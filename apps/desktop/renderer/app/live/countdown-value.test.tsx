import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CountdownValue } from './countdown-value';

function render(qualified: boolean) {
  return renderToStaticMarkup(
    createElement(CountdownValue, { testId: 'live-countdown-x', formatted: '2:00', qualified, qualifier: 'a qualifier' }),
  );
}

describe('CountdownValue — one look for every countdown', () => {
  it('renders identical markup either way, but for the qualifier text — no reflow, and no second colour', () => {
    const stripQualifierText = (html: string) =>
      html.replace(/(data-testid="live-countdown-x-qualifier"[^>]*>)[^<]*(<)/, '$1$2');

    expect(stripQualifierText(render(false))).toBe(stripQualifierText(render(true)));
  });

  it('carries exactly one text colour, and no border, whether qualified or not', () => {
    const classOf = (html: string) => /data-testid="live-countdown-x" class="([^"]*)"/.exec(html)?.[1]?.split(' ') ?? [];

    for (const classes of [classOf(render(false)), classOf(render(true))]) {
      expect(classes.filter((token) => token.startsWith('text-'))).toEqual(['text-sm', 'text-ink']);
      expect(classes.some((token) => token.startsWith('border'))).toBe(false);
    }
  });

  it('the number itself renders identically in both states', () => {
    expect(render(false)).toContain('2:00');
    expect(render(true)).toContain('2:00');
  });
});

describe('CountdownValue — the visually-hidden qualifier', () => {
  it('carries the qualifier text when qualified — the only thing that still marks an estimate', () => {
    const html = render(true);
    expect(html).toContain('class="sr-only"');
    expect(html).toContain('a qualifier');
  });

  it('carries no qualifier text when not qualified', () => {
    const html = render(false);
    expect(html).not.toContain('a qualifier');
  });
});
