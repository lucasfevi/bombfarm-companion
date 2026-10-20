import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DefinitionList } from './definition-list';

const ITEMS = [
  { term: 'Plan', detail: 'Annual' },
  { term: 'Seats', detail: <strong>4</strong> },
];

describe('DefinitionList', () => {
  it('renders a grid of term and detail rows, each in a contents wrapper', () => {
    const html = renderToStaticMarkup(<DefinitionList items={ITEMS} />);
    expect(html).toBe(
      '<dl class="m-0 grid grid-cols-[minmax(8rem,12rem)_1fr] gap-x-4 gap-y-1 text-[13px] max-[520px]:grid-cols-1">' +
        '<div class="contents"><dt class="text-muted">Plan</dt><dd class="m-0 min-w-0 break-words">Annual</dd></div>' +
        '<div class="contents"><dt class="text-muted">Seats</dt><dd class="m-0 min-w-0 break-words"><strong>4</strong></dd></div>' +
        '</dl>',
    );
  });

  it('renders the ruled variant with hairlines and a right-aligned bold value', () => {
    const html = renderToStaticMarkup(<DefinitionList items={[ITEMS[0]!]} variant="ruled" />);
    expect(html).toBe(
      '<dl class="m-0 grid grid-cols-[1fr_auto] gap-x-4 text-[13px]">' +
        '<div class="contents"><dt class="border-b border-line/70 py-1.5 text-muted">Plan</dt>' +
        '<dd class="m-0 min-w-0 border-b border-line/70 py-1.5 text-right font-semibold break-words">Annual</dd></div>' +
        '</dl>',
    );
  });

  it('renders an empty list for no items', () => {
    expect(renderToStaticMarkup(<DefinitionList items={[]} />)).toMatch(/^<dl [^>]*><\/dl>$/);
  });

  it('lets a caller class win a conflicting utility', () => {
    const html = renderToStaticMarkup(<DefinitionList items={ITEMS} className="text-sm gap-y-3" />);
    const classes = (/class="([^"]*)"/.exec(html)?.[1] ?? '').split(' ');
    expect(classes).toContain('text-sm');
    expect(classes).toContain('gap-y-3');
    expect(classes).not.toContain('text-[13px]');
    expect(classes).not.toContain('gap-y-1');
  });
});
