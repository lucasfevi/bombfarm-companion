import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { en } from '../../lib/copy/en';
import { MiniChrome } from './mini-chrome';

vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return { ...actual, useCopy: () => en };
});

describe('MiniChrome', () => {
  it('renders chrome testids and native title on the close control', () => {
    const html = renderToStaticMarkup(
      createElement(MiniChrome, {
        onClose: () => undefined,
        gear: createElement('span', { 'data-testid': 'gear-slot' }),
      }),
    );
    expect(html).toContain('data-testid="mini-live-chrome"');
    expect(html).toContain('data-testid="mini-live-close"');
    expect(html).toContain(`title="${en.miniLiveCloseTitle}"`);
    expect(html).toContain(`aria-label="${en.miniLiveCloseTitle}"`);
  });
});
