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

  it('lets the caller retone the value line', () => {
    const html = render({ label: 'Rank', value: 'Not read yet', valueClassName: 'text-muted' });
    expect(html).toContain('text-muted');
    expect(html).not.toContain('text-ink');
  });
});
