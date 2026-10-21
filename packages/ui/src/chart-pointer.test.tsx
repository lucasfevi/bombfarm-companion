// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { LineChart } from './line-chart';
import { BarChart } from './bar-chart';
import { mountDom, type DomMount } from './dom-test-harness';

let mount: DomMount | undefined;

afterEach(() => {
  mount?.unmount();
  mount = undefined;
});

const LABELS = ['Mon', 'Tue', 'Wed'];

function line(renderedWidth = 640) {
  mount = mountDom();
  mount.render(
    <LineChart
      labels={LABELS}
      ariaLabel="Daily visitors"
      empty="No visitors yet"
      formatValue={(value) => `${String(value)} users`}
      series={[
        { label: 'Visitors', values: [0, 5, 10] },
        { label: 'Returning', values: [1, null, 3] },
      ]}
    />,
  );
  const plot = mount.container.querySelector<HTMLElement>('[data-chart-plot]');
  if (plot === null) throw new Error('no plot layer');
  plot.getBoundingClientRect = () => ({ left: 10, top: 0, width: renderedWidth, height: 230, right: 0, bottom: 0, x: 10, y: 0, toJSON: () => null });
  return plot;
}

function move(plot: HTMLElement, clientX: number) {
  mount?.fire(plot, new MouseEvent('pointermove', { bubbles: true, clientX }));
}

const crosshair = () => mount?.container.querySelector('[data-chart-crosshair]') ?? null;
const tooltip = () => mount?.container.querySelector<HTMLElement>('[data-chart-tooltip]') ?? null;

function lone(width: number) {
  mount = mountDom();
  mount.render(<LineChart labels={['a']} ariaLabel="One" empty="None" width={width} series={[{ label: 'A', values: [5] }]} />);
  const plot = mount.container.querySelector<HTMLElement>('[data-chart-plot]');
  if (plot === null) throw new Error('no plot layer');
  plot.getBoundingClientRect = () => ({ left: 0, top: 0, width, height: 230, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => null });
  return plot;
}

describe('chart pointer island', () => {
  it('renders nothing but the labelled, focusable plot layer until the pointer arrives', () => {
    const plot = line();
    expect(crosshair()).toBeNull();
    expect(tooltip()).toBeNull();
    expect(plot.getAttribute('tabindex')).toBe('0');
    expect(plot.getAttribute('aria-label')).toBe('Daily visitors');
  });

  it('selects the index nearest the pointer and draws the crosshair on it', () => {
    const plot = line();
    move(plot, 10 + 330);
    expect(crosshair()?.getAttribute('x1')).toBe('330');
    expect(tooltip()?.textContent).toContain('Tue');
    expect(tooltip()?.textContent).toContain('5 users');
    move(plot, 10 + 70);
    expect(crosshair()?.getAttribute('x1')).toBe('44');
    expect(tooltip()?.textContent).toContain('Mon');
    move(plot, 10 + 600);
    expect(crosshair()?.getAttribute('x1')).toBe('616');
    expect(tooltip()?.textContent).toContain('10 users');
  });

  it('draws the crosshair as a dashed muted line spanning the plot', () => {
    const plot = line();
    move(plot, 10 + 330);
    const mark = crosshair();
    expect(mark?.getAttribute('stroke')).toBe('var(--color-muted)');
    expect(mark?.getAttribute('stroke-dasharray')).toBe('2 3');
    expect(mark?.getAttribute('y1')).toBe('12');
    expect(mark?.getAttribute('y2')).toBe('204');
  });

  it('scales the pointer by the rendered width over the viewBox width', () => {
    const plot = line(320);
    move(plot, 10 + 165);
    expect(crosshair()?.getAttribute('x1')).toBe('330');
    move(plot, 10 + 300);
    expect(crosshair()?.getAttribute('x1')).toBe('616');
  });

  it('lists every series in the tooltip, with a dash for a gap', () => {
    const plot = line();
    move(plot, 10 + 330);
    const text = tooltip()?.textContent ?? '';
    expect(text).toContain('Visitors');
    expect(text).toContain('Returning');
    expect(text).toContain('—');
  });

  it('carries the tooltip styling and flips it left of the crosshair on the right side', () => {
    const plot = line();
    move(plot, 10 + 44);
    expect(tooltip()?.className).toContain('pointer-events-none absolute z-[2] rounded-sm bg-ink px-2 py-1.5');
    expect(tooltip()?.className).toContain('ml-3');
    move(plot, 10 + 616);
    expect(tooltip()?.className).toContain('-translate-x-full');
  });

  it('clears on pointer leave', () => {
    const plot = line();
    move(plot, 10 + 330);
    expect(crosshair()).not.toBeNull();
    mount?.fire(plot, new MouseEvent('pointerout', { bubbles: true, relatedTarget: null }));
    expect(crosshair()).toBeNull();
    expect(tooltip()).toBeNull();
  });

  it('steps through the indexes with the arrow keys, and clears on Escape', () => {
    const plot = line();
    const press = (key: string) => mount?.fire(plot, new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }));
    press('ArrowRight');
    expect(crosshair()?.getAttribute('x1')).toBe('44');
    press('ArrowRight');
    press('ArrowRight');
    press('ArrowRight');
    expect(crosshair()?.getAttribute('x1')).toBe('616');
    press('ArrowLeft');
    expect(crosshair()?.getAttribute('x1')).toBe('330');
    press('Home');
    expect(crosshair()?.getAttribute('x1')).toBe('44');
    press('End');
    expect(crosshair()?.getAttribute('x1')).toBe('616');
    press('Escape');
    expect(crosshair()).toBeNull();
  });

  it('selects on pointer down, for touch', () => {
    const plot = line();
    mount?.fire(plot, new MouseEvent('pointerdown', { bubbles: true, clientX: 10 + 330 }));
    expect(crosshair()?.getAttribute('x1')).toBe('330');
    expect(tooltip()?.textContent).toContain('Tue');
  });

  it('clears on pointer cancel', () => {
    const plot = line();
    move(plot, 10 + 330);
    mount?.fire(plot, new MouseEvent('pointercancel', { bubbles: true }));
    expect(crosshair()).toBeNull();
    expect(tooltip()).toBeNull();
  });

  it('clears when the plot loses focus', () => {
    const plot = line();
    move(plot, 10 + 330);
    mount?.fire(plot, new FocusEvent('focusout', { bubbles: true }));
    expect(crosshair()).toBeNull();
    expect(tooltip()).toBeNull();
  });

  it('starts a keyboard walk at the newest index on ArrowLeft and the oldest on ArrowRight', () => {
    const plot = line();
    const press = (key: string) => mount?.fire(plot, new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }));
    press('ArrowLeft');
    expect(crosshair()?.getAttribute('x1')).toBe('616');
    press('Escape');
    press('ArrowRight');
    expect(crosshair()?.getAttribute('x1')).toBe('44');
  });

  it('paints each tooltip swatch in its series colour', () => {
    mount = mountDom();
    mount.render(
      <LineChart
        labels={LABELS}
        ariaLabel="Daily visitors"
        empty="None"
        series={[
          { label: 'Visitors', values: [1, 2, 3] },
          { label: 'Returning', values: [1, 2, 3], color: '#123456' },
        ]}
      />,
    );
    const plot = mount.container.querySelector<HTMLElement>('[data-chart-plot]');
    if (plot === null) throw new Error('no plot layer');
    plot.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 230, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => null });
    move(plot, 330);
    const swatches = [...(tooltip()?.querySelectorAll<HTMLElement>('span[aria-hidden]') ?? [])].map((node) => node.getAttribute('style'));
    expect(swatches).toHaveLength(2);
    expect(swatches[0]).toContain('var(--color-series-1)');
    expect(swatches[1]).toContain('#123456');
  });

  it('flips the tooltip only past 60% of the width', () => {
    let plot = lone(100);
    mount?.fire(plot, new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Home' }));
    expect(crosshair()?.getAttribute('x1')).toBe('60');
    expect(tooltip()?.classList.contains('ml-3')).toBe(true);
    expect(tooltip()?.classList.contains('-translate-x-full')).toBe(false);
    mount?.unmount();
    plot = lone(99);
    mount?.fire(plot, new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Home' }));
    expect(crosshair()?.getAttribute('x1')).toBe('59.5');
    expect(tooltip()?.classList.contains('-translate-x-full')).toBe(true);
    expect(tooltip()?.classList.contains('ml-3')).toBe(false);
  });

  it('places the tooltip at the crosshair, level with the top of the plot', () => {
    const plot = line();
    move(plot, 10 + 330);
    expect(tooltip()?.style.left).toBe(`${String((330 / 640) * 100)}%`);
    expect(tooltip()?.style.top).toBe(`${String((12 / 230) * 100)}%`);
  });

  it('announces the tooltip politely', () => {
    const plot = line();
    move(plot, 10 + 330);
    expect(tooltip()?.getAttribute('aria-live')).toBe('polite');
  });

  it('works over bars, on the bar centres', () => {
    mount = mountDom();
    mount.render(
      <BarChart labels={LABELS} ariaLabel="Daily visitors" empty="None" series={[{ label: 'Visitors', values: [1, 2, 3] }]} />,
    );
    const plot = mount.container.querySelector<HTMLElement>('[data-chart-plot]');
    if (plot === null) throw new Error('no plot layer');
    plot.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 230, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => null });
    move(plot, 500);
    expect(crosshair()?.getAttribute('x1')).toBe('520.67');
    expect(tooltip()?.textContent).toContain('Wed');
  });
});
