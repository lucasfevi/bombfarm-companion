import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sparkline } from './sparkline';

function render(props: Parameters<typeof Sparkline>[0]) {
  return renderToStaticMarkup(createElement(Sparkline, props));
}

/** Every `d` attribute on a stroked (rather than filled) path, in document order. */
function linePaths(html: string): readonly string[] {
  return [...html.matchAll(/<path d="([^"]+)"[^>]*stroke="currentColor"/g)].map((match) => match[1] ?? '');
}

function areaPaths(html: string): readonly string[] {
  return [...html.matchAll(/<path d="([^"]+)" fill="currentColor"/g)].map((match) => match[1] ?? '');
}

/** `x,y` pairs of one path's vertices, in order. */
function vertices(d: string): readonly (readonly [number, number])[] {
  return [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(
    (match) => [Number(match[1]), Number(match[2])] as const,
  );
}

const ARIA = 'Gold per hour over the last 10 minutes';

describe('Sparkline', () => {
  it('spreads the readings across the full viewBox width, first to last', () => {
    const html = render({ values: [1, 2, 3, 4, 5], ariaLabel: ARIA });
    const points = vertices(linePaths(html)[0] ?? '');
    expect(points.map(([x]) => x)).toEqual([0, 25, 50, 75, 100]);
  });

  it('scales the y axis from zero to the tallest reading, not from the smallest', () => {
    const html = render({ values: [900, 1000], ariaLabel: ARIA, height: 42 });
    const points = vertices(linePaths(html)[0] ?? '');
    // 1000 is the peak and sits at the top of the box; 900 sits nine tenths of the way up from
    // the baseline, not at the bottom — which is what a min-anchored axis would have drawn.
    expect(points[1]?.[1]).toBe(1);
    expect(points[0]?.[1]).toBeCloseTo(5, 1);
  });

  it('holds a flat series flat rather than magnifying it to fill the box', () => {
    const html = render({ values: [500, 500, 500], ariaLabel: ARIA });
    const ys = vertices(linePaths(html)[0] ?? '').map(([, y]) => y);
    expect(new Set(ys).size).toBe(1);
  });

  it('breaks the line at a gap instead of drawing a reading through it', () => {
    const html = render({ values: [1, 2, null, 4, 5], ariaLabel: ARIA });
    const runs = linePaths(html);
    expect(runs).toHaveLength(2);
    expect(vertices(runs[0] ?? '').map(([x]) => x)).toEqual([0, 25]);
    expect(vertices(runs[1] ?? '').map(([x]) => x)).toEqual([75, 100]);
  });

  it('draws a zero reading on the baseline, unlike a gap', () => {
    const withZero = render({ values: [10, 0, 10], ariaLabel: ARIA, height: 42 });
    expect(linePaths(withZero)).toHaveLength(1);
    expect(vertices(linePaths(withZero)[0] ?? '')[1]?.[1]).toBe(41);

    const withGap = render({ values: [10, null, 10], ariaLabel: ARIA, height: 42 });
    expect(linePaths(withGap)).toHaveLength(2);
  });

  it('closes each area down to the baseline', () => {
    const html = render({ values: [10, 20], ariaLabel: ARIA, height: 42 });
    const area = areaPaths(html)[0] ?? '';
    expect(area.endsWith('Z')).toBe(true);
    expect(vertices(area).slice(-2).map(([, y]) => y)).toEqual([41, 41]);
  });

  it('still reserves its full height when there is nothing to draw', () => {
    const html = render({ values: [], ariaLabel: ARIA, height: 44 });
    expect(html).toContain('height="44"');
    expect(linePaths(html)).toHaveLength(0);
    expect(html).toContain('<line');
  });

  it('treats an all-gap series as nothing to draw rather than as zeroes', () => {
    const html = render({ values: [null, null, null], ariaLabel: ARIA });
    expect(linePaths(html)).toHaveLength(0);
  });

  it('renders a lone reading as a dot rather than dropping it', () => {
    const html = render({ values: [7], ariaLabel: ARIA });
    const points = vertices(linePaths(html)[0] ?? '');
    expect(points).toHaveLength(1);
    expect(points[0]?.[0]).toBe(50);
  });

  it('takes its tone from currentColor so a caller sets it with a text colour', () => {
    const html = render({ values: [1, 2], ariaLabel: ARIA, className: 'text-gold' });
    expect(html).toContain('text-gold');
    expect(html).toContain('stroke="currentColor"');
    expect(html).not.toMatch(/stroke="#|stroke="var\(--gold/);
  });

  it('is announced as one labelled image, not as bare graphics', () => {
    const html = render({ values: [1, 2], ariaLabel: ARIA });
    expect(html).toContain('role="img"');
    expect(html).toContain(`aria-label="${ARIA}"`);
  });

  it('keeps the stroke unstretched when the box is scaled to its container', () => {
    const html = render({ values: [1, 2], ariaLabel: ARIA });
    expect(html).toContain('preserveAspectRatio="none"');
    expect(html).toContain('vector-effect="non-scaling-stroke"');
  });

  describe('domain', () => {
    const SERIES = [200, 205, 195, 200, 190] as const;

    it('is the zero floor by default: the markup is byte-identical with the prop omitted and with `zero` given', () => {
      const omitted = render({ values: SERIES, ariaLabel: ARIA, height: 42 });
      expect(omitted).toBe(render({ values: SERIES, ariaLabel: ARIA, height: 42, domain: 'zero' }));
      const ys = vertices(linePaths(omitted)[0] ?? '').map(([, y]) => y);
      expect(ys[1]).toBe(1);
      expect(ys[4]).toBeCloseTo(3.93, 2);
    });

    it('`data` runs the axis from the smallest reading at the baseline to the largest at the top', () => {
      const html = render({ values: SERIES, ariaLabel: ARIA, height: 42, domain: 'data' });
      const ys = vertices(linePaths(html)[0] ?? '').map(([, y]) => y);
      expect(ys[1]).toBe(1);
      expect(ys[4]).toBe(41);
      expect(ys[0]).toBeCloseTo(41 - (10 / 15) * 40, 2);
    });

    it('`data` lays a series with no spread on the baseline, having no scale to draw it at', () => {
      const html = render({ values: [500, 500, 500], ariaLabel: ARIA, height: 42, domain: 'data' });
      const ys = vertices(linePaths(html)[0] ?? '').map(([, y]) => y);
      expect(ys).toEqual([41, 41, 41]);
    });
  });

  describe('marks', () => {
    function markPaths(html: string): readonly { tone: string; d: string; width: number }[] {
      return [...html.matchAll(/<path data-sparkline-mark="(\w+)" d="([^"]+)"[^>]*stroke-width="(\d+)"/g)].map((match) => ({
        tone: match[1] ?? '',
        d: match[2] ?? '',
        width: Number(match[3]),
      }));
    }

    it('draws one round dot per toned entry, on the reading it marks, in the tone\'s stroke class', () => {
      const html = render({ values: [1, 2, 3], ariaLabel: ARIA, height: 42, marks: ['up', null, 'down'] });
      const marks = markPaths(html);
      expect(marks.map((mark) => mark.tone)).toEqual(['up', 'down']);
      expect(html).toContain('class="stroke-up"');
      expect(html).toContain('class="stroke-down"');
      const line = vertices(linePaths(html)[0] ?? '');
      expect(vertices(marks[0]?.d ?? '')).toEqual([line[0], line[0]]);
      expect(vertices(marks[1]?.d ?? '')).toEqual([line[2], line[2]]);
      expect(html.match(/stroke-linecap="round"/g)?.length).toBe(3);
    });

    it('draws the newest reading\'s dot larger than the rest', () => {
      const html = render({ values: [1, 2, 3], ariaLabel: ARIA, marks: ['up', 'up', 'down'] });
      expect(markPaths(html).map((mark) => mark.width)).toEqual([6, 6, 8]);
    });

    it('marks nothing at a gap, and nothing at all when no entry carries a tone', () => {
      expect(markPaths(render({ values: [1, null, 3], ariaLabel: ARIA, marks: ['up', 'down', null] }))).toHaveLength(1);
      expect(markPaths(render({ values: [1, 2, 3], ariaLabel: ARIA, marks: [null, null, null] }))).toHaveLength(0);
      expect(render({ values: [1, 2, 3], ariaLabel: ARIA, marks: [] })).toBe(render({ values: [1, 2, 3], ariaLabel: ARIA }));
    });

    it('keeps a dot round under the box\'s own stretch: a non-scaling stroke, not a circle', () => {
      const html = render({ values: [1, 2], ariaLabel: ARIA, marks: ['up', 'up'] });
      expect(html).not.toContain('<circle');
      expect(html.match(/vector-effect="non-scaling-stroke"/g)?.length).toBe(4);
    });
  });
});
