import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AreaChart } from './area-chart';
import { BarChart } from './bar-chart';
import { LineChart, type LineChartProps } from './line-chart';

const BASE = {
  labels: ['Mon', 'Tue', 'Wed'],
  ariaLabel: 'Daily visitors',
  empty: 'No visitors yet',
} as const;
const ONE = [{ label: 'Visitors', values: [0, 5, 10] }] as const;

function line(props: Partial<LineChartProps> = {}) {
  return renderToStaticMarkup(createElement(LineChart, { ...BASE, series: ONE, ...props }));
}

function area(props: Partial<LineChartProps> = {}) {
  return renderToStaticMarkup(createElement(AreaChart, { ...BASE, series: ONE, ...props }));
}

function bar(values: readonly (number | null)[], props: Record<string, unknown> = {}) {
  return renderToStaticMarkup(createElement(BarChart, { ...BASE, series: [{ label: 'Visitors', values }], ...props }));
}

function paths(html: string): string[] {
  return [...html.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1] ?? '');
}

describe('server render', () => {
  it('produces the whole graphic from props alone, with no placeholder', () => {
    const html = line();
    expect(html).toMatch(/^<div[^>]*><div class="relative"><svg viewBox="0 0 640 230" role="img"/);
    expect(paths(html)).toEqual(['M44 204 L330 108 L616 12']);
    expect(html).toContain('<circle');
    expect(html).toContain('>Mon</text>');
    expect(html).not.toContain('aria-busy');
  });

  it('sets the viewBox from the width and height props and scales with CSS', () => {
    const html = line({ width: 400, height: 150 });
    expect(html).toContain('viewBox="0 0 400 150"');
    expect(html).toContain('class="block h-auto w-full"');
    expect(html).not.toMatch(/<svg[^>]* (?:width|height)=/);
  });

  it('labels the graphic as one image', () => {
    const html = line();
    expect(html).toContain('role="img" aria-label="Daily visitors"');
  });
});

describe('LineChart', () => {
  it('draws the line from the nice scale: zero on the baseline, the peak at the top', () => {
    expect(paths(line())).toEqual(['M44 204 L330 108 L616 12']);
  });

  it('ends each series on a dot ringed in the surface colour', () => {
    expect(line()).toContain('<circle cx="616" cy="12" r="4" fill="var(--color-series-1)" stroke="var(--color-surface)" stroke-width="2"></circle>');
  });

  it('rounds the stroke and uses the series token by position', () => {
    const html = line({
      series: [
        { label: 'A', values: [1, 2, 3] },
        { label: 'B', values: [3, 2, 1] },
        { label: 'C', values: [2, 2, 2] },
        { label: 'D', values: [1, 1, 1] },
      ],
    });
    for (const n of [1, 2, 3, 4]) expect(html).toContain(`stroke="var(--color-series-${String(n)})"`);
    expect(html).toContain('stroke-width="2" stroke-linecap="round" stroke-linejoin="round"');
  });

  it('lets a series override its colour', () => {
    const html = line({ series: [{ label: 'A', values: [1, 2], color: '#123456' }] });
    expect(html).toContain('stroke="#123456"');
    expect(html).not.toContain('--color-series-1)"');
  });

  it('breaks the line at a null instead of bridging it', () => {
    const html = line({ series: [{ label: 'A', values: [1, 2, null, 4, 5] }], labels: ['a', 'b', 'c', 'd', 'e'] });
    expect(paths(html)).toEqual(['M44 172 L187 140', 'M473 76 L616 44']);
  });

  it('draws a reading with no neighbours as a dot', () => {
    const html = line({ series: [{ label: 'A', values: [1, null, 3, null, 5] }], labels: ['a', 'b', 'c', 'd', 'e'] });
    expect(paths(html)).toEqual([]);
    expect(html.match(/<circle/g)).toHaveLength(3);
    expect(html).toContain('r="2.5"');
  });

  it('centres a single point and gives it only the end dot', () => {
    const html = line({ series: [{ label: 'A', values: [7] }], labels: ['a'] });
    expect(paths(html)).toEqual([]);
    expect(html.match(/<circle/g)).toHaveLength(1);
    expect(html).toContain('cx="330"');
  });

  it('keeps an all-zero series on the baseline without dividing by zero', () => {
    const html = line({ series: [{ label: 'A', values: [0, 0, 0] }] });
    expect(paths(html)).toEqual(['M44 204 L330 204 L616 204']);
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('draws a negative reading as zero', () => {
    expect(paths(line({ series: [{ label: 'A', values: [-4, 5, 10] }] }))).toEqual(paths(line()));
  });

  it('reads a non-finite value as a gap', () => {
    const html = line({ series: [{ label: 'A', values: [1, Number.NaN, 3] }] });
    expect(paths(html)).toEqual([]);
    expect(html).not.toMatch(/NaN/);
  });

  it('shows the empty message instead of an svg when no series has a reading', () => {
    for (const series of [[], [{ label: 'A', values: [] }], [{ label: 'A', values: [null, null] }]]) {
      const html = line({ series });
      expect(html).toBe('<p class="m-0 text-[13px] text-muted">No visitors yet</p>');
    }
  });

  it('formats ticks and values with the host formatter', () => {
    const html = line({ formatValue: (value) => `${String(value)} users` });
    expect(html).toContain('>10 users</text>');
  });

  it('thins the x labels to the cap, keeping the newest', () => {
    const labels = Array.from({ length: 10 }, (_, index) => `d${String(index)}`);
    const html = line({ labels, maxXLabels: 4, series: [{ label: 'A', values: labels.map((_, index) => index) }] });
    const shown = [...html.matchAll(/text-anchor="middle"[^>]*>(d\d)</g)].map((match) => match[1]);
    expect(shown).toEqual(['d0', 'd3', 'd6', 'd9']);
  });

  it('adds a legend only when there is more than one series, unless asked', () => {
    expect(line()).not.toContain('<ul');
    const two = line({ series: [ONE[0], { label: 'Returning', values: [1, 2, 3] }] });
    expect(two).toContain('<ul');
    expect(two).toContain('background:var(--color-series-2)');
    expect(line({ legend: true })).toContain('<ul');
    expect(line({ series: [ONE[0], { label: 'Returning', values: [1, 2, 3] }], legend: false })).not.toContain('<ul');
  });

  it('offers the data as a table inside a disclosure when asked', () => {
    const html = line({ table: { summary: 'Show table', labelHeading: 'Day' } });
    expect(html).toContain('<details');
    expect(html).toContain('Show table');
    expect(html).toContain('<th scope="col" class="px-2 py-1 text-left font-semibold text-muted">Day</th>');
    expect(html).toContain('>Tue</th>');
    expect(html).toContain('>5</td>');
    expect(line()).not.toContain('<table');
  });

  it('shows a dash in the table for a gap', () => {
    const html = line({ series: [{ label: 'A', values: [1, null, 3] }], table: { summary: 's', labelHeading: 'h' } });
    expect(html).toContain('—</td>');
  });

  it('draws the grid in the chart-grid token, with the baseline in the line token', () => {
    const html = line();
    expect(html).toContain('stroke="var(--color-line)"');
    expect(html).toContain('stroke="var(--color-chart-grid)"');
    expect(html.match(/<line /g)).toHaveLength(5);
  });
});

describe('AreaChart', () => {
  it('adds a fill closed down to the baseline at 20% of the series colour', () => {
    const html = area();
    expect(paths(html)).toEqual(['M44 204 L330 108 L616 12 L616 204 L44 204 Z', 'M44 204 L330 108 L616 12']);
    expect(html).toContain('fill="color-mix(in srgb, var(--color-series-1) 20%, transparent)"');
  });

  it('shades nothing for a lone reading', () => {
    expect(paths(area({ series: [{ label: 'A', values: [4] }], labels: ['a'] }))).toEqual([]);
  });
});

describe('BarChart', () => {
  it('draws one bar per reading with only the top corners rounded', () => {
    expect(paths(bar([0, 5, 10]))).toEqual([
      'M310 204 V112 A4 4 0 0 1 314 108 H346 A4 4 0 0 1 350 112 V204 Z',
      'M500.67 204 V16 A4 4 0 0 1 504.67 12 H536.67 A4 4 0 0 1 540.67 16 V204 Z',
    ]);
  });

  it('caps the corner radius at the bar height', () => {
    const [d] = paths(bar([1, 1000], { labels: ['a', 'b'] }));
    expect(d).toMatch(/^M\S+ 204 V\S+ A\S+ \S+ 0 0 1/);
    const radius = Number(/A([\d.]+) /.exec(d ?? '')?.[1]);
    expect(radius).toBeLessThanOrEqual(4);
  });

  it('draws a zero as a one pixel baseline in the line colour', () => {
    const html = bar([0, 5, 10]);
    expect(html).toContain('<rect x="119.33" y="203" width="40" height="1" fill="var(--color-line)"></rect>');
  });

  it('leaves a gap out entirely', () => {
    const html = bar([3, null, 6]);
    expect(paths(html)).toHaveLength(2);
    expect(html).not.toContain('<rect x');
  });

  it('fills bars with the first series token', () => {
    expect(bar([1, 2, 3])).toContain('fill="var(--color-series-1)"');
  });

  it('handles an all-zero series as three baselines', () => {
    const html = bar([0, 0, 0]);
    expect(paths(html)).toEqual([]);
    expect(html.match(/<rect x/g)).toHaveLength(3);
  });

  it('shows the empty message for no readings', () => {
    expect(bar([])).toContain('No visitors yet');
    expect(bar([null])).not.toContain('<svg');
  });

  it('puts the x labels under the bar centres', () => {
    expect(bar([1, 2, 3])).toContain('<text x="139.33" y="220"');
  });
});

describe('module boundaries', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const source = (file: string) => readFileSync(join(dir, file), 'utf8');

  it.each(['line-chart.tsx', 'area-chart.tsx', 'bar-chart.tsx', 'chart-frame.tsx', 'chart-grid.tsx', 'chart-legend.tsx'])(
    '%s is server-safe: no directive, no hooks, no handlers',
    (file) => {
      const text = source(file);
      expect(text).not.toMatch(/use client/);
      expect(text).not.toMatch(/\buse[A-Z]\w*\(/);
      expect(text).not.toMatch(/\son[A-Z]\w*=/);
    },
  );

  it('keeps the pointer handling in the one client module', () => {
    const text = source('chart-pointer.tsx');
    expect(text.startsWith("'use client';")).toBe(true);
    expect(text).toMatch(/useState/);
  });
});
