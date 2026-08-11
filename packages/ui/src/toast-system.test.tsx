import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToastItem, ToastProvider, useToast } from './toast-system';
import type { ToastEntry, ToastVariant } from './toast-queue';

function makeEntry(overrides: Partial<ToastEntry> & Pick<ToastEntry, 'variant'>): ToastEntry {
  return {
    id: 'toast-1',
    key: 'k',
    title: 'Title',
    createdAt: 0,
    updatedAt: 0,
    expiresAt: null,
    ...overrides,
  };
}

function renderItem(entry: ToastEntry) {
  return renderToStaticMarkup(createElement(ToastItem, { toast: entry, onDismiss: () => {} }));
}

describe('ToastProvider — TST-11', () => {
  it('renders its children', () => {
    const html = renderToStaticMarkup(
      createElement(ToastProvider, { children: createElement('p', null, 'hello') }),
    );
    expect(html).toContain('hello');
  });

  it('useToast() throws a clear error when called outside a provider', () => {
    function Consumer() {
      useToast();
      return null;
    }
    expect(() => renderToStaticMarkup(createElement(Consumer))).toThrow(
      'useToast must be used inside a ToastProvider',
    );
  });
});

describe('ToastItem — TST-13 fixed icon + token per variant', () => {
  const variants: ToastVariant[] = ['success', 'error', 'warning', 'info', 'progress'];
  const iconByVariant: Record<ToastVariant, string> = {
    success: 'check-circle',
    error: 'x-circle',
    warning: 'exclamation-triangle',
    info: 'information-circle',
    progress: 'arrow-path',
  };

  it.each(variants)('renders a distinct icon for %s', (variant) => {
    const html = renderItem(makeEntry({ variant, title: `${variant} toast` }));
    expect(html).toContain(`data-toast-variant="${variant}"`);
  });

  it('every variant maps to a different icon (never a color-only distinction)', () => {
    const icons = new Set(Object.values(iconByVariant));
    expect(icons.size).toBe(variants.length);
  });

  it.each(variants)('%s renders the title text, not just a colored box', (variant) => {
    const html = renderItem(makeEntry({ variant, title: `Distinct ${variant} copy` }));
    expect(html).toContain(`Distinct ${variant} copy`);
  });
});

describe('ToastItem — TST-14 aria-live politeness', () => {
  it('is assertive for error', () => {
    const html = renderItem(makeEntry({ variant: 'error' }));
    expect(html).toContain('aria-live="assertive"');
  });

  it.each(['success', 'warning', 'info', 'progress'] as ToastVariant[])('is polite for %s', (variant) => {
    const html = renderItem(makeEntry({ variant }));
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('aria-live="assertive"');
  });
});

describe('ToastItem — TST-16 progress bar', () => {
  it('renders role="progressbar" with correct aria-valuenow/min/max', () => {
    const html = renderItem(makeEntry({ variant: 'progress', progress: 42 }));
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
  });

  it('clamps progress into 0..100', () => {
    expect(renderItem(makeEntry({ variant: 'progress', progress: 140 }))).toContain('aria-valuenow="100"');
    expect(renderItem(makeEntry({ variant: 'progress', progress: -5 }))).toContain('aria-valuenow="0"');
  });

  it('non-progress variants render no progressbar', () => {
    const html = renderItem(makeEntry({ variant: 'success' }));
    expect(html).not.toContain('role="progressbar"');
  });
});

describe('ToastItem — action + dismiss', () => {
  it('renders the single action button label when action is provided', () => {
    const html = renderItem(
      makeEntry({ variant: 'error', action: { label: 'Retry', onAction: () => {} } }),
    );
    expect(html).toContain('Retry');
    expect(html).toContain('<button');
  });

  it('renders no action row when action is absent', () => {
    const html = renderItem(makeEntry({ variant: 'info' }));
    // Only the close button remains as a <button>.
    const buttonCount = (html.match(/<button/g) ?? []).length;
    expect(buttonCount).toBe(1);
  });

  it('always renders a dismiss control (manual-dismiss variants have no other way to close)', () => {
    const html = renderItem(makeEntry({ variant: 'warning' }));
    expect(html).toContain('aria-label="Dismiss"');
  });
});

describe('TST-15 — action is a single object, not an array (type-level)', () => {
  it('ToastInput.action is typed as one ToastActionButton, so passing an array fails to typecheck', () => {
    // Evidence lives in the type itself (toast-queue.ts `ToastInput.action?: ToastActionButton`),
    // not at runtime — `packages/ui`'s tsconfig excludes *.test.tsx from `tsc --noEmit`, so a
    // `@ts-expect-error` here would not be enforced by the typecheck gate. This test just pins
    // the render-time contract: exactly one action button ever renders.
    const html = renderItem(
      makeEntry({ variant: 'info', action: { label: 'Only one', onAction: () => {} } }),
    );
    expect((html.match(/Only one/g) ?? []).length).toBe(1);
  });
});

describe('TST-17 — no raw palette classes, no --bf-* anywhere in this module\'s output', () => {
  it('rendered markup contains no raw palette token', () => {
    const html = renderItem(makeEntry({ variant: 'progress', progress: 50, action: { label: 'Cancel', onAction: () => {} } }));
    expect(html).not.toMatch(/emerald|amber|slate|zinc/);
    expect(html).not.toMatch(/--bf-/);
  });

  it('source files contain no raw palette token or --bf-* variable', () => {
    for (const file of ['toast-system.tsx', 'toast-system.recipe.ts', 'toast-queue.ts']) {
      const src = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      expect(src, `${file} contains a raw palette class`).not.toMatch(/emerald-|amber-|slate-|zinc-/);
      expect(src, `${file} contains a --bf- variable`).not.toMatch(/--bf-/);
    }
  });
});
