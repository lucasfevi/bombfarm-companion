import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dataTableHeadButtonClass, dataTableHeadStaticClass } from '../data-table.recipe';
import { DataTableHeader } from './data-table-header';
import type { DataTableHeaderProps } from './types';

const render = (props: Partial<DataTableHeaderProps<'name'>> & { sortKey?: 'name' | 'other' }) =>
  renderToStaticMarkup(
    createElement(DataTableHeader<'name' | 'other'>, {
      sortable: true,
      col: 'name',
      sortKey: 'name',
      sortDir: 'asc',
      sortHref: '/records?sort=name&dir=desc',
      children: 'Name',
      ...props,
    } as DataTableHeaderProps<'name' | 'other'>),
  );

describe('DataTableHeader sortHref', () => {
  it('renders an anchor with the sort button look in place of a button', () => {
    const html = render({});
    expect(html).toContain(
      `<a href="/records?sort=name&amp;dir=desc" class="${dataTableHeadButtonClass.replaceAll("'", '&#x27;')} text-accent"><span>Name</span>`,
    );
    expect(html).not.toContain('<button');
    expect(html).toMatch(/^<th class="[^"]*" aria-sort="ascending">/);
  });

  it('carries the same classes as the button header for the same state', () => {
    const button = renderToStaticMarkup(
      createElement(DataTableHeader<'name' | 'other'>, {
        sortable: true,
        col: 'name',
        sortKey: 'name',
        sortDir: 'asc',
        onSort: () => undefined,
        children: 'Name',
      }),
    );
    const link = render({});
    const sortClass = (html: string) => /<(?:a|button)[^>]*class="([^"]*)"/.exec(html)?.[1];
    expect(sortClass(link)).toBe(sortClass(button));
    expect(link.replace(/<a href="[^"]*"/, '<button').replace('</a>', '</button>')).toBe(
      button.replace('<button type="button"', '<button'),
    );
  });

  it('reports descending and an idle column on aria-sort', () => {
    expect(render({ sortDir: 'desc' })).toContain('aria-sort="descending"');
    const idle = render({ sortKey: 'other' });
    expect(idle).toContain('aria-sort="none"');
    expect(idle).toContain('text-inherit hover:text-ink');
  });

  it('keeps the aside beside the link', () => {
    const html = renderToStaticMarkup(
      createElement(DataTableHeader<'name'>, {
        sortable: true,
        col: 'name',
        sortKey: 'name',
        sortDir: 'asc',
        sortHref: '/records',
        aside: createElement('button', { type: 'button' }, 'tip'),
        children: 'Name',
      }),
    );
    expect(html).toMatch(/<\/a><span[^>]*><button type="button">tip<\/button><\/span>/);
  });

  it('leaves the button header and the static header unchanged', () => {
    const button = renderToStaticMarkup(
      createElement(DataTableHeader<'name'>, {
        sortable: true,
        col: 'name',
        sortKey: 'name',
        sortDir: 'asc',
        onSort: () => undefined,
        children: 'Name',
      }),
    );
    expect(button).toMatch(/<button type="button" class="[^"]*text-accent[^"]*">/);
    expect(button).not.toContain('<a ');
    expect(renderToStaticMarkup(createElement(DataTableHeader, { children: 'Plain' }))).toContain(
      `class="${dataTableHeadStaticClass}"`,
    );
  });
});
