import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CountdownAbsentValue, CountdownValue, type CountdownSize } from './countdown-value';

function render(qualified: boolean, size?: CountdownSize) {
  return renderToStaticMarkup(
    createElement(CountdownValue, {
      testId: 'live-countdown-x',
      formatted: '2:00',
      qualified,
      qualifier: 'a qualifier',
      ...(size ? { size } : {}),
    }),
  );
}

/** Class order is `cn()`'s to decide (tailwind-merge normalises it), so every assertion here
 *  compares membership rather than sequence. */
function classOf(html: string): string[] {
  return /data-testid="live-countdown-x" class="([^"]*)"/.exec(html)?.[1]?.split(' ') ?? [];
}

describe('CountdownValue — one look for every countdown', () => {
  it('renders identical markup either way, but for the qualifier text — no reflow, and no second colour', () => {
    const stripQualifierText = (html: string) =>
      html.replace(/(data-testid="live-countdown-x-qualifier"[^>]*>)[^<]*(<)/, '$1$2');

    expect(stripQualifierText(render(false))).toBe(stripQualifierText(render(true)));
  });

  it('carries exactly one text colour, and no border, whether qualified or not', () => {
    for (const classes of [classOf(render(false)), classOf(render(true))]) {
      expect(classes.filter((token) => token.startsWith('text-')).sort()).toEqual(['text-ink', 'text-sm']);
      expect(classes.some((token) => token.startsWith('border'))).toBe(false);
    }
  });

  it('draws the clock in the mono face, the only one here whose digits are all one width', () => {
    expect(classOf(render(false))).toContain('font-mono');
  });

  it('the number itself renders identically in both states', () => {
    expect(render(false)).toContain('2:00');
    expect(render(true)).toContain('2:00');
  });
});

describe('CountdownValue — the compact size the second Live window uses', () => {
  it('reserves a narrower digit column than the default, and still reserves one', () => {
    expect(classOf(render(false, 'compact'))).toContain('min-w-11');
    expect(classOf(render(false, 'default'))).toContain('min-w-16');
  });

  it('keeps the one colour and the mono face at either size', () => {
    const classes = classOf(render(false, 'compact'));
    expect(classes).toContain('font-mono');
    expect(classes.filter((token) => token.startsWith('text-')).sort()).toEqual(['text-[10px]', 'text-ink']);
    expect(classes.some((token) => token.startsWith('border'))).toBe(false);
  });

  it('omits the size class of the size it is not', () => {
    expect(classOf(render(false, 'compact'))).not.toContain('text-sm');
    expect(classOf(render(false, 'default'))).not.toContain('text-[10px]');
  });
});

describe('CountdownAbsentValue — a reading that has not arrived', () => {
  function renderAbsent(size?: CountdownSize) {
    return renderToStaticMarkup(
      createElement(CountdownAbsentValue, {
        testId: 'live-countdown-x',
        label: 'not available',
        ...(size ? { size } : {}),
      }),
    );
  }

  it('prints the words at the default size, where the column is wide enough for them', () => {
    expect(renderAbsent()).toContain('not available');
  });

  it('prints a dash at the compact size, keeping the words for a screen reader', () => {
    const html = renderAbsent('compact');
    expect(html).toContain('<span aria-hidden="true">—</span>');
    expect(html).toContain('<span class="sr-only">not available</span>');
    // Once, and only inside the visually-hidden span: it is the sighted copy that wraps the row.
    expect(html.match(/not available/g)).toHaveLength(1);
  });

  it('reserves the same compact digit column as a live reading, so the row cannot change width', () => {
    expect(classOf(renderAbsent('compact'))).toContain('min-w-11');
  });
});
