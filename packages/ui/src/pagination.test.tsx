import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Pagination } from './pagination';

const hrefFor = (page: number) => `/items?page=${page}`;
const LINK = 'text-accent underline-offset-2 hover:underline';

describe('Pagination', () => {
  it('renders a labelled nav with a status and previous and next anchors', () => {
    const html = renderToStaticMarkup(<Pagination page={2} pageCount={5} hrefFor={hrefFor} />);
    expect(html).toBe(
      '<nav aria-label="Pages" class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">' +
        '<span class="text-muted tabular-nums">Page 2 of 5</span>' +
        `<a class="${LINK}" href="/items?page=1" rel="prev">Previous</a>` +
        `<a class="${LINK}" href="/items?page=3" rel="next">Next</a>` +
        '</nav>',
    );
  });

  it('disables the previous end on the first page with a non-link span', () => {
    const html = renderToStaticMarkup(<Pagination page={1} pageCount={3} hrefFor={hrefFor} />);
    expect(html).toContain('<span class="text-muted" aria-disabled="true">Previous</span>');
    expect(html).toContain(`<a class="${LINK}" href="/items?page=2" rel="next">Next</a>`);
    expect(html).not.toContain('rel="prev"');
  });

  it('disables the next end on the last page', () => {
    const html = renderToStaticMarkup(<Pagination page={3} pageCount={3} hrefFor={hrefFor} />);
    expect(html).toContain('<span class="text-muted" aria-disabled="true">Next</span>');
    expect(html).toContain(`<a class="${LINK}" href="/items?page=2" rel="prev">Previous</a>`);
    expect(html).not.toContain('rel="next"');
  });

  it('shows the last page as current when the page is past the end', () => {
    const html = renderToStaticMarkup(<Pagination page={9} pageCount={4} hrefFor={hrefFor} />);
    expect(html).toContain('Page 4 of 4');
    expect(html).toContain('href="/items?page=3" rel="prev"');
    expect(html).toContain('<span class="text-muted" aria-disabled="true">Next</span>');
  });

  it('shows the first page as current when the page is below one', () => {
    const html = renderToStaticMarkup(<Pagination page={0} pageCount={4} hrefFor={hrefFor} />);
    expect(html).toContain('Page 1 of 4');
    expect(html).toContain('<span class="text-muted" aria-disabled="true">Previous</span>');
    expect(html).toContain('href="/items?page=2" rel="next"');
  });

  it('disables both ends for a single page', () => {
    const html = renderToStaticMarkup(<Pagination page={1} pageCount={1} hrefFor={hrefFor} />);
    expect(html).toContain('Page 1 of 1');
    expect(html).not.toContain('<a');
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(2);
  });

  it('treats a page count of zero as one page', () => {
    const html = renderToStaticMarkup(<Pagination page={1} pageCount={0} hrefFor={hrefFor} />);
    expect(html).toContain('Page 1 of 1');
    expect(html).not.toContain('<a');
  });

  it('floors a fractional page and clamps a negative page count to one page', () => {
    const html = renderToStaticMarkup(<Pagination page={2.7} pageCount={-3} hrefFor={hrefFor} />);
    expect(html).toContain('Page 1 of 1');
  });

  it('takes overridable copy', () => {
    const html = renderToStaticMarkup(
      <Pagination
        page={2}
        pageCount={3}
        hrefFor={hrefFor}
        label="Resultados"
        previousLabel="Anterior"
        nextLabel="Seguinte"
        formatStatus={(page, count) => `Pagina ${page} de ${count}`}
      />,
    );
    expect(html).toContain('<nav aria-label="Resultados"');
    expect(html).toContain('Pagina 2 de 3');
    expect(html).toContain('>Anterior</a>');
    expect(html).toContain('>Seguinte</a>');
  });

  it('renders the links through a consumer link component', () => {
    const html = renderToStaticMarkup(
      <Pagination
        page={2}
        pageCount={3}
        hrefFor={hrefFor}
        linkAs={(props: { href: string; className?: string }) => <a data-router="1" {...props} />}
      />,
    );
    expect(html.match(/data-router="1"/g)).toHaveLength(2);
  });

  it('carries no handlers, only anchors', () => {
    const html = renderToStaticMarkup(<Pagination page={2} pageCount={3} hrefFor={hrefFor} />);
    expect(html).not.toMatch(/\son[a-z]+=/);
    expect(html).not.toContain('<button');
  });
});
