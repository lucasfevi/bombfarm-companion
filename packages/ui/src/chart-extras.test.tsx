// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { AreaChart } from './area-chart';
import { BarChart } from './bar-chart';
import { niceScale } from './chart-scale';
import { LineChart, type LineChartProps } from './line-chart';
import { mountDom, type DomMount } from './dom-test-harness';

let mount: DomMount | undefined;

afterEach(() => {
  mount?.unmount();
  mount = undefined;
});

const BASE = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu'],
  ariaLabel: 'Daily runs',
  empty: 'No runs',
  series: [{ label: 'Running', values: [4, 8, 6, 9] }],
} as const;

/** Opens the tooltip of one index by keyboard and returns its text. */
function tooltipAt(props: Partial<LineChartProps>, ...keys: string[]): string {
  mount = mountDom();
  mount.render(<LineChart {...BASE} {...props} />);
  const plot = mount.container.querySelector<HTMLElement>('[data-chart-plot]');
  if (plot === null) throw new Error('no plot layer');
  for (const key of keys) mount.fire(plot, new KeyboardEvent('keydown', { bubbles: true, key }));
  return mount.container.querySelector('[data-chart-tooltip]')?.textContent ?? '';
}

const DETAILS = [
  [{ label: 'accounts', value: '12' }, { label: 'anonymous', value: '3' }],
  undefined,
  [{ label: 'accounts', value: '7' }],
  [{ label: '% updated', value: '80%' }],
] as const;

describe('chart details', () => {
  it('adds the extra rows to the tooltip of their index only', () => {
    expect(tooltipAt({ details: DETAILS }, 'Home')).toContain('accounts12anonymous3');
    expect(tooltipAt({ details: DETAILS }, 'End')).toContain('% updated80%');
    expect(tooltipAt({ details: DETAILS }, 'Home', 'ArrowRight')).not.toContain('accounts');
  });

  it('shows no extra row without details', () => {
    expect(tooltipAt({}, 'Home')).not.toContain('accounts');
  });

  it('lists them as table columns only when asked, a dash where an index has none', () => {
    const table = { summary: 'Table', labelHeading: 'Day' };
    const off = renderToStaticMarkup(<LineChart {...BASE} details={DETAILS} table={table} />);
    expect(off).not.toContain('>accounts</th>');
    const on = renderToStaticMarkup(<LineChart {...BASE} details={DETAILS} table={{ ...table, detailColumns: true }} />);
    expect(on).toContain('>accounts</th>');
    expect(on).toContain('>anonymous</th>');
    expect(on).toContain('>% updated</th>');
    expect(on).toContain('<td class="px-2 py-1 text-right">12</td>');
    expect(on).toContain('<td class="px-2 py-1 text-right">80%</td>');
  });
});

describe('chart partial range', () => {
  const partial = { from: 3, label: '(in progress)' };

  it('draws the stretch into the partial point dashed, and the rest solid', () => {
    const html = renderToStaticMarkup(<LineChart {...BASE} partial={partial} />);
    const dashed = html.match(/<path data-chart-partial="true" d="([^"]+)"[^>]*stroke-dasharray="4 4"/);
    expect(dashed).not.toBeNull();
    expect(dashed?.[1]?.match(/[ML]/g)).toHaveLength(2);
    const solid = html.match(/<path d="(M[^"]+)" fill="none" stroke="var\(--color-series-1\)" stroke-width="2"/);
    expect(solid?.[1]?.match(/[ML]/g)).toHaveLength(3);
  });

  it('dashes the same stretch in an area chart and keeps its fill', () => {
    const html = renderToStaticMarkup(<AreaChart {...BASE} partial={partial} />);
    expect(html).toContain('data-chart-partial');
    expect(html).toContain('color-mix');
  });

  it('draws no dashes without it, or when it starts past the data', () => {
    expect(renderToStaticMarkup(<LineChart {...BASE} />)).not.toContain('stroke-dasharray="4 4"');
    expect(renderToStaticMarkup(<LineChart {...BASE} partial={{ from: 9, label: 'x' }} />)).not.toContain('data-chart-partial');
  });

  it('adds the caller copy to the tooltip and the table row of the partial indexes only', () => {
    expect(tooltipAt({ partial }, 'End')).toContain('Thu (in progress)');
    expect(tooltipAt({ partial }, 'Home')).not.toContain('in progress');
    const html = renderToStaticMarkup(
      <LineChart {...BASE} partial={partial} table={{ summary: 'T', labelHeading: 'Day' }} />,
    );
    expect(html).toContain('>Thu (in progress)</th>');
    expect(html).not.toContain('Wed (in progress)');
  });

  it('marks a bar chart tooltip too', () => {
    mount = mountDom();
    mount.render(<BarChart {...BASE} partial={partial} />);
    const plot = mount.container.querySelector<HTMLElement>('[data-chart-plot]');
    mount.fire(plot as HTMLElement, new KeyboardEvent('keydown', { bubbles: true, key: 'End' }));
    expect(mount.container.querySelector('[data-chart-tooltip]')?.textContent).toContain('(in progress)');
  });
});

describe('integerTicks', () => {
  it.each([
    [10, 4],
    [3, 4],
    [1, 4],
    [7, 3],
    [0.4, 4],
  ])('never yields a fractional step for a peak of %s', (max, tickCount) => {
    const scale = niceScale(max, tickCount, true);
    expect(scale.ticks.every(Number.isInteger)).toBe(true);
    expect(scale.step).toBeGreaterThanOrEqual(1);
    expect(scale.max).toBeGreaterThanOrEqual(max);
  });

  it('keeps the default scale when off', () => {
    expect(niceScale(10, 4).step).toBe(2.5);
    expect(niceScale(10, 4, true).step).toBe(5);
  });

  it('reaches the axis of a chart', () => {
    const labels = (integerTicks: boolean) =>
      renderToStaticMarkup(createElement(LineChart, { ...BASE, series: [{ label: 'R', values: [0, 1, 2, 2] }], integerTicks }));
    expect(labels(false)).toContain('>0.5<');
    expect(labels(true)).not.toMatch(/>\d+\.\d+</);
  });
});
