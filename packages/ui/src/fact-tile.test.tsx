import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FactTile } from './fact-tile';

function render(props: Parameters<typeof FactTile>[0]) {
  return renderToStaticMarkup(createElement(FactTile, props));
}

describe('FactTile', () => {
  it('draws a bordered cell with a mono figure by default', () => {
    const html = render({ label: 'Level', value: '85', 'data-testid': 'level' });
    expect(html).toContain('data-testid="level"');
    expect(html).toContain('border-line');
    expect(html).toContain('font-mono');
    expect(html).toMatch(/<p[^>]*>85<\/p>/);
  });

  it('drops the box and enlarges the figure at the headline size', () => {
    const html = render({ label: 'Tier', value: '2', size: 'headline' });
    expect(html).not.toContain('border-line');
    expect(html).not.toContain('font-mono');
    expect(html).toContain('text-[23px]');
  });

  it('enlarges the figure again at the display size and lets its label wrap', () => {
    const html = render({ label: 'Forge Essence you receive', value: '+1,200', size: 'display' });
    expect(html).toContain('text-[34px]');
    expect(html).toContain('tabular-nums');
    expect(html).not.toContain('border-line');
    expect(html).not.toMatch(/<p[^>]*whitespace-nowrap[^>]*>Forge/);
  });

  it('prints a detail line under the figure only when given one', () => {
    const plain = render({ label: 'Essence', value: '+1,200', size: 'display' });
    expect(plain.match(/<p /g)).toHaveLength(2);
    const detailed = render({ label: 'Essence', value: '+1,200', size: 'display', detail: '212,464 → 213,664' });
    expect(detailed).toMatch(/<p class="[^"]*text-muted[^"]*">212,464 → 213,664<\/p>/);
  });

  it('lets the caller retone the value line', () => {
    const html = render({ label: 'Rank', value: 'Not read yet', valueClassName: 'text-muted' });
    expect(html).toContain('text-muted');
    expect(html).not.toContain('text-ink');
  });
});
