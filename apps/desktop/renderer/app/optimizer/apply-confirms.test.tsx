import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { en } from '../../lib/copy/en';
import { equipConfirmCopy, forgeConfirmCopy } from './apply-confirms';

function descriptionHtml(node: React.ReactNode): string {
  return renderToStaticMarkup(createElement('div', null, node));
}

describe('equipConfirmCopy', () => {
  it('names the cost on the primary label, with the cancel label "Not now"', () => {
    const copy = equipConfirmCopy(4, false, en);
    expect(copy.title).toBe(en.applyConfirmEquipTitle);
    expect(copy.confirmLabel).toBe('Equip 4 items');
    expect(copy.cancelLabel).toBe(en.applyConfirmCancel);
  });

  it('carries the queue-pauses sentence only when the queue is running', () => {
    expect(descriptionHtml(equipConfirmCopy(1, false, en).description)).not.toContain(en.applyConfirmQueuePauses);
    expect(descriptionHtml(equipConfirmCopy(1, true, en).description)).toContain(en.applyConfirmQueuePauses);
  });
});

describe('forgeConfirmCopy', () => {
  it('adds to the queue with no gold suffix, and never carries the queue-pauses sentence', () => {
    const copy = forgeConfirmCopy(3, en);
    expect(copy.confirmLabel).toBe('Add 3 to queue');
    expect(copy.title).toBe(en.applyConfirmForgeTitle);
    expect(descriptionHtml(copy.description)).not.toContain(en.applyConfirmQueuePauses);
  });
});
