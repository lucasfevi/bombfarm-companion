import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Panel } from './panel';

describe('Panel overflow', () => {
  it('keeps the narrow-screen scroll clip when unset', () => {
    expect(renderToStaticMarkup(<Panel>Body</Panel>)).toBe(
      '<section class="border border-line bg-surface px-3.5 py-3 max-[720px]:overflow-x-auto">Body</section>',
    );
  });

  it('swaps the clip for visible overflow', () => {
    expect(renderToStaticMarkup(<Panel overflow="visible">Body</Panel>)).toBe(
      '<section class="border border-line bg-surface px-3.5 py-3 max-[720px]:overflow-visible">Body</section>',
    );
  });

  it('composes with the other variants and a class name', () => {
    expect(renderToStaticMarkup(<Panel overflow="visible" aligned className="mt-2">Body</Panel>)).toContain(
      'max-[720px]:overflow-visible',
    );
    expect(renderToStaticMarkup(<Panel overflow="visible" aligned className="mt-2">Body</Panel>)).not.toContain(
      'overflow-x-auto',
    );
  });
});
