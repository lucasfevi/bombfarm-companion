import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Disclosure } from './disclosure';

const SUMMARY =
  'cursor-pointer text-[13px] text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

describe('Disclosure', () => {
  it('renders a closed native details with a summary and a padded body', () => {
    const html = renderToStaticMarkup(<Disclosure summary="More detail">Body text</Disclosure>);
    expect(html).toBe(
      '<details class="rounded-sm border border-line px-2.5 py-1.5">' +
        `<summary class="${SUMMARY}">More detail</summary>` +
        '<div class="pt-2.5 pb-1">Body text</div></details>',
    );
    expect(html).not.toMatch(/\sopen/);
  });

  it('opens by default when asked', () => {
    const html = renderToStaticMarkup(
      <Disclosure summary="More detail" defaultOpen>
        Body text
      </Disclosure>,
    );
    expect(html).toContain('<details open="" class="rounded-sm border border-line px-2.5 py-1.5">');
  });

  it('works without script: no handlers and no motion', () => {
    const html = renderToStaticMarkup(
      <Disclosure summary="More detail" defaultOpen>
        Body text
      </Disclosure>,
    );
    expect(html).not.toMatch(/\son[a-z]+=/);
    expect(html).not.toMatch(/\b(?:transition|animate|duration)/);
    const source = readFileSync(new URL('./disclosure.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/motion/);
  });

  it('lets a caller class win a conflicting utility', () => {
    const html = renderToStaticMarkup(
      <Disclosure summary="s" className="px-4">
        b
      </Disclosure>,
    );
    const classes = (/class="([^"]*)"/.exec(html)?.[1] ?? '').split(' ');
    expect(classes).toContain('px-4');
    expect(classes).not.toContain('px-2.5');
  });
});
