import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FactCell } from './fact-cell';

function render(warning: string | null): string {
  return renderToStaticMarkup(
    createElement(FactCell, { label: 'Phase', value: 'Normal 1-1', note: 'About 17 s per clear.', warning, testId: 'card' }),
  );
}

describe('FactCell', () => {
  it('announces a warning under the note, in the warning tone', () => {
    const html = render('Clears take 82 s here.');
    expect(html).toMatch(/<p[^>]*text-warn[^>]*role="status"[^>]*data-testid="card-warning"[^>]*>Clears take 82 s here\.<\/p>/);
    expect(html.indexOf('About 17 s per clear.')).toBeLessThan(html.indexOf('Clears take 82 s here.'));
  });

  it('renders no warning line without one', () => {
    expect(render(null)).not.toContain('card-warning');
  });
});
