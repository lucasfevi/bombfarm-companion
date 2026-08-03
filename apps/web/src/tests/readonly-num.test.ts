import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReadonlyNum } from '@bombfarm/ui';

describe('ReadonlyNum', () => {
  it('rounds display only and never exposes an input', () => {
    const html = renderToStaticMarkup(
      createElement(ReadonlyNum, { value: 2.60988968151606, decimals: 3 }),
    );
    expect(html).toContain('data-readonly-num');
    expect(html).toContain('2.610');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('data-num');
  });
});
