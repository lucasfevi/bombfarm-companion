import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CountdownValue } from './countdown-value';

function render(muted: boolean) {
  return renderToStaticMarkup(
    createElement(CountdownValue, { testId: 'live-countdown-x', formatted: '2:00', muted, qualifier: 'a qualifier' }),
  );
}

describe('CountdownValue — flipping muted causes no reflow', () => {
  it('renders the same element structure whether muted or not, differing only in the class attributes', () => {
    const clear = render(false);
    const muted = render(true);

    const stripClasses = (html: string) => html.replace(/ class="[^"]*"/g, '');
    const stripQualifierText = (html: string) => html.replace(/(data-testid="live-countdown-x-qualifier"[^>]*>)[^<]*(<)/, '$1$2');

    expect(stripQualifierText(stripClasses(clear))).toBe(stripQualifierText(stripClasses(muted)));
  });

  it('the number itself renders identically in both states', () => {
    expect(render(false)).toContain('2:00');
    expect(render(true)).toContain('2:00');
  });

  it('only border-style/colour utility classes differ between the two states', () => {
    const classOf = (html: string) => /data-testid="live-countdown-x" class="([^"]*)"/.exec(html)?.[1]?.split(' ') ?? [];
    const clearClasses = new Set(classOf(render(false)));
    const mutedClasses = new Set(classOf(render(true)));

    const onlyInClear = [...clearClasses].filter((token) => !mutedClasses.has(token));
    const onlyInMuted = [...mutedClasses].filter((token) => !clearClasses.has(token));

    expect(onlyInClear.sort()).toEqual(['border-transparent', 'text-ink']);
    expect(onlyInMuted.sort()).toEqual(['border-muted', 'text-muted']);
  });
});

describe('CountdownValue — the visually-hidden qualifier', () => {
  it('carries the qualifier text when muted', () => {
    const html = render(true);
    expect(html).toContain('class="sr-only"');
    expect(html).toContain('a qualifier');
  });

  it('carries no qualifier text when not muted', () => {
    const html = render(false);
    expect(html).not.toContain('a qualifier');
  });
});
