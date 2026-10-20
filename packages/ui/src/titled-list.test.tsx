import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TitledList } from './titled-list';

const HEADING = 'm-0 font-mono text-[11px] tracking-[0.12em] text-muted uppercase';
const ITEM = 'flex flex-col gap-1.5 border-b border-line pb-2 text-[13px] last:border-b-0 last:pb-0';

describe('TitledList', () => {
  it('renders a labelled section with a heading and ruled items', () => {
    const html = renderToStaticMarkup(<TitledList title="Recent events" items={['One', <b key="b">Two</b>]} empty="None" />);
    expect(html).toBe(
      '<section aria-label="Recent events" class="flex flex-col gap-1.5">' +
        `<h3 class="${HEADING}">Recent events</h3>` +
        '<ul class="m-0 flex list-none flex-col gap-2 p-0">' +
        `<li class="${ITEM}">One</li><li class="${ITEM}"><b>Two</b></li>` +
        '</ul></section>',
    );
  });

  it('renders the empty text and no list when there are no items', () => {
    const html = renderToStaticMarkup(<TitledList title="Recent events" items={[]} empty="Nothing yet" />);
    expect(html).toContain('<p class="m-0 text-[13px] text-muted">Nothing yet</p>');
    expect(html).not.toContain('<ul');
    expect(html).not.toContain('<li');
  });

  it('renders the heading at the requested level', () => {
    const html = renderToStaticMarkup(<TitledList title="Recent events" items={[]} empty="x" headingLevel={2} />);
    expect(html).toContain(`<h2 class="${HEADING}">Recent events</h2>`);
    expect(html).not.toContain('<h3');
  });

  it('lets a caller class win a conflicting utility', () => {
    const html = renderToStaticMarkup(<TitledList title="t" items={[]} empty="x" className="gap-4" />);
    expect(html).toContain('class="flex flex-col gap-4"');
  });
});
