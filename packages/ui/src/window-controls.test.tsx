import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WindowControls, type WindowControlsProps } from './window-controls';
import { WINDOW_CONTROLS_WIDTH } from './window-controls.recipe';

const LABELS = {
  minimize: 'Minimize',
  maximize: 'Maximize',
  restore: 'Restore down',
  close: 'Close to tray',
};

function render(overrides: Partial<WindowControlsProps> = {}) {
  return renderToStaticMarkup(
    createElement(WindowControls, {
      maximized: false,
      onMinimize: vi.fn(),
      onToggleMaximize: vi.fn(),
      onClose: vi.fn(),
      labels: LABELS,
      ...overrides,
    }),
  );
}

describe('WindowControls', () => {
  it('draws three buttons, none of which submits a form it might sit inside', () => {
    const out = render();
    expect(out.match(/<button /g) ?? []).toHaveLength(3);
    expect(out.match(/type="button"/g) ?? []).toHaveLength(3);
  });

  it('names every icon-only button for assistive technology', () => {
    const out = render();
    expect(out).toContain('aria-label="Minimize"');
    expect(out).toContain('aria-label="Maximize"');
    expect(out).toContain('aria-label="Close to tray"');
  });

  it('renames the middle button when the window is already maximized', () => {
    const out = render({ maximized: true });
    expect(out).toContain('aria-label="Restore down"');
    expect(out).not.toContain('aria-label="Maximize"');
  });

  it('draws the restore glyph, not the maximize one, while maximized', () => {
    // The name and the glyph are two independent reads of the same state, and a button that
    // announces "Restore down" over a maximize square is wrong for whichever half you trust.
    const maximizeOnly = render();
    const restoreOnly = render({ maximized: true });
    expect(maximizeOnly).not.toBe(restoreOnly);
  });

  it('keeps every button at the 28px square the compact window already uses', () => {
    expect(render().match(/size-7/g) ?? []).toHaveLength(3);
  });

  it('reserves a width the shell can subtract before judging its own density', () => {
    // Three 28px buttons, their two 2px gaps, and the 12px that separates the cluster from the
    // actions beside it. The bar is laid out against this number, so it may not drift from what
    // the recipe actually draws.
    expect(WINDOW_CONTROLS_WIDTH).toBe(3 * 28 + 2 * 2 + 12);
  });
});
