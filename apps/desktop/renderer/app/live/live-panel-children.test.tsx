// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LiveFastModel, LiveSlowModel } from '../../lib/live/live-model';
import { LivePanel } from './live-panel';

const slow: LiveSlowModel = {
  onField: [],
  recovering: [],
  queued: [],
  benched: [],
  unclassifiedCount: 2,
  fieldExitPendingCount: 1,
  occupancy: { occupied: 0, fieldSize: 6 },
  house: {},
};
const fast: LiveFastModel = { field: {}, recovery: {}, energy: {} };

function render(children?: ReturnType<typeof createElement>): Document {
  const html = renderToStaticMarkup(createElement(LivePanel, { freshness: { kind: 'live' }, slow, fast }, children));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('LivePanel children', () => {
  it('sit inside the panel grid, full width, after the Heroes panel and before the footnotes', () => {
    const doc = render(createElement('i', { 'data-testid': 'tail' }));
    const tail = doc.querySelector('[data-testid="tail"]');
    const slot = tail?.parentElement;
    const heroes = doc.querySelector('[data-testid="live-heroes"]');
    expect(slot?.getAttribute('data-testid')).toBe('live-extension-slot');
    expect(slot?.className).toContain('col-span-2');
    expect(slot?.parentElement).toBe(heroes?.parentElement);
    expect(slot?.previousElementSibling).toBe(heroes);
    const footnote = doc.querySelector('[data-testid="live-unclassified-count"]');
    expect(slot?.compareDocumentPosition(footnote as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(footnote?.parentElement).toBe(doc.querySelector('[data-testid="live-panel"]'));
  });

  it('open no slot when there are none', () => {
    const doc = render();
    expect(doc.querySelector('[data-testid="live-extension-slot"]')).toBeNull();
    expect(doc.querySelector('[data-testid="live-heroes"]')?.nextElementSibling).toBeNull();
  });
});
