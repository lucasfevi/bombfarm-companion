import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataTableHeader } from './data-table-header';

function render(aside?: string) {
  return renderToStaticMarkup(
    createElement(DataTableHeader<'name'>, {
      sortable: true,
      col: 'name',
      sortKey: 'name',
      sortDir: 'asc',
      onSort: () => undefined,
      aside: aside === undefined ? undefined : createElement('button', { type: 'button' }, aside),
      children: 'Name',
    }),
  );
}

describe('DataTableHeader', () => {
  it('draws the aside beside the sort button, never inside it', () => {
    const html = render('tip');
    expect(html).toMatch(/<\/button><span[^>]*><button type="button">tip<\/button><\/span>/);
    expect(html.match(/<button/g)).toHaveLength(2);
  });

  it('keeps the bare sort button when there is no aside', () => {
    expect(render()).toMatch(/^<th[^>]*aria-sort="ascending"><button/);
  });
});
