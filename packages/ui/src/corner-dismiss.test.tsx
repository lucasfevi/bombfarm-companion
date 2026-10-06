import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CornerDismiss } from './corner-dismiss';

function render(props: Parameters<typeof CornerDismiss>[0]) {
  return renderToStaticMarkup(createElement(CornerDismiss, props));
}

describe('CornerDismiss', () => {
  it('takes its accessible name from the caller and draws no text of its own', () => {
    const html = render({ label: 'Remove this range' });
    expect(html).toContain('aria-label="Remove this range"');
    expect(html.replace(/<[^>]*>/g, '')).toBe('');
  });

  it('is anchored to the top-right corner with no background', () => {
    const html = render({ label: 'x' });
    expect(html).toContain('absolute');
    expect(html).toContain('-top-1');
    expect(html).toContain('-right-1');
    expect(html).toContain('bg-transparent');
    expect(html).toContain('hover:bg-transparent');
  });

  it('is never a submit button and passes the caller attributes through', () => {
    const html = render({ label: 'x', 'data-testid': 'dismiss' } as Parameters<typeof CornerDismiss>[0]);
    expect(html).toContain('type="button"');
    expect(html).toContain('data-testid="dismiss"');
  });
});
