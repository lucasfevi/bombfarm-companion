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
});
