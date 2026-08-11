import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Slider } from './slider';

function render(props: Parameters<typeof Slider>[0]) {
  return renderToStaticMarkup(createElement(Slider, props));
}

describe('Slider — TST-23 base-ui wrap', () => {
  it('renders a slider input with min/max/step wired through', () => {
    const html = render({ value: 30, min: 0, max: 60, step: 5, label: 'Price TTL' });
    expect(html).toContain('min="0"');
    expect(html).toContain('max="60"');
    expect(html).toContain('step="5"');
  });

  it('renders the visible label', () => {
    const html = render({ value: 10, label: 'Price TTL' });
    expect(html).toContain('Price TTL');
  });

  it('renders a preformatted valueLabel readout without owning locale formatting', () => {
    const html = render({ value: 30, label: 'Price TTL', valueLabel: '30 min' });
    expect(html).toContain('30 min');
  });

  it('renders no label row when neither label nor valueLabel is given', () => {
    const html = render({ value: 10 });
    expect(html).not.toContain('Price TTL');
  });
});

describe('Slider — TST-24 accessible name', () => {
  it('derives the input accessible name from label', () => {
    const html = render({ value: 10, label: 'Price TTL' });
    expect(html).toContain('aria-label="Price TTL"');
  });

  it('prefers an explicit aria-label over label for the accessible name', () => {
    const html = render({ value: 10, label: 'Price TTL', 'aria-label': 'Price cache lifetime' });
    expect(html).toContain('aria-label="Price cache lifetime"');
    expect(html).not.toContain('aria-label="Price TTL"');
  });

  it('keyboard operability comes from base-ui — renders a native range input carrying the value', () => {
    const html = render({ value: 42, min: 0, max: 100, label: 'Volume' });
    expect(html).toContain('type="range"');
    expect(html).toContain('value="42"');
  });
});

describe('Slider — no raw palette classes / --bf-*', () => {
  it('rendered markup contains no raw palette token', () => {
    const html = render({ value: 10, label: 'Price TTL', valueLabel: '10s' });
    // Anchored to an actual Tailwind palette-utility shape (e.g. `bg-amber-500`) so base-ui's own
    // inline `translate:-50% -50%` positioning style (containing the substring "slate") isn't a false hit.
    expect(html).not.toMatch(/-(?:emerald|amber|slate|zinc)-\d/);
    expect(html).not.toMatch(/--bf-/);
  });
});
