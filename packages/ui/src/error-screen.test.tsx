import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ErrorScreen } from './error-screen';

const BOX =
  'mx-auto flex max-w-md flex-col items-center gap-2 rounded-md border border-line bg-surface px-6 py-10 text-center';

describe('ErrorScreen', () => {
  it('renders a title and message on surface tokens', () => {
    const html = renderToStaticMarkup(<ErrorScreen title="Something went wrong" message="Try again in a moment." />);
    expect(html).toBe(
      `<div class="${BOX}"><h2 class="text-lg font-semibold text-ink">Something went wrong</h2><p class="m-0 max-w-prose text-sm text-muted">Try again in a moment.</p></div>`,
    );
  });

  it('renders the retry slot as given, whether a link, a form or a button', () => {
    const link = renderToStaticMarkup(<ErrorScreen title="Oops" action={<a href="/">Back</a>} />);
    expect(link).toContain('<div class="mt-2"><a href="/">Back</a></div>');
    const form = renderToStaticMarkup(
      <ErrorScreen
        title="Oops"
        action={
          <form action="/retry">
            <button type="submit">Retry</button>
          </form>
        }
      />,
    );
    expect(form).toContain('<div class="mt-2"><form action="/retry"><button type="submit">Retry</button></form></div>');
  });

  it('omits the message and the slot when unset', () => {
    const html = renderToStaticMarkup(<ErrorScreen title="Oops" />);
    expect(html).not.toContain('<p');
    expect(html).not.toContain('mt-2');
  });

  it('picks the heading level, h2 by default', () => {
    expect(renderToStaticMarkup(<ErrorScreen title="Oops" />)).toContain('<h2 ');
    expect(renderToStaticMarkup(<ErrorScreen title="Oops" headingLevel={1} />)).toContain('<h1 ');
    expect(renderToStaticMarkup(<ErrorScreen title="Oops" headingLevel={3} />)).toContain('<h3 ');
  });

  it('lets a caller class win a conflicting utility', () => {
    const html = renderToStaticMarkup(<ErrorScreen title="Oops" className="max-w-lg py-4" />);
    const classes = (/class="([^"]*)"/.exec(html)?.[1] ?? '').split(' ');
    expect(classes).toContain('max-w-lg');
    expect(classes).toContain('py-4');
    expect(classes).not.toContain('max-w-md');
    expect(classes).not.toContain('py-10');
  });

  it('uses design tokens only: no inline style and no literal colour', () => {
    const html = renderToStaticMarkup(<ErrorScreen title="Oops" message="Msg" action={<a href="/">Back</a>} />);
    expect(html).not.toContain('style=');
    expect(html).not.toMatch(/#[\da-f]{3,8}\b|oklch|rgb\(|hsl\(/i);
  });

  it('renders a node title inside the heading and a node message inside the paragraph', () => {
    const html = renderToStaticMarkup(<ErrorScreen title={<em>Oops</em>} message={<span>Try again.</span>} />);
    expect(html).toContain('<h2 class="text-lg font-semibold text-ink"><em>Oops</em></h2>');
    expect(html).toContain('<p class="m-0 max-w-prose text-sm text-muted"><span>Try again.</span></p>');
  });
});
