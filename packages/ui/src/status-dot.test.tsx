import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatusDot } from './status-dot';

const DOT = 'size-2 flex-none rounded-full';

describe('StatusDot', () => {
  it('renders a hidden live dot with a glow ring beside a tabular label', () => {
    expect(renderToStaticMarkup(<StatusDot tone="live" label="Online" />)).toBe(
      '<span class="flex items-center gap-3">' +
        `<span class="${DOT} bg-up shadow-[0_0_0_3px_color-mix(in_oklch,var(--up)_22%,transparent)]" aria-hidden="true"></span>` +
        '<span class="tabular-nums">Online</span></span>',
    );
  });

  it('colours the warn, down and muted tones', () => {
    expect(renderToStaticMarkup(<StatusDot tone="warn" label="Slow" />)).toContain(`<span class="${DOT} bg-warn"`);
    expect(renderToStaticMarkup(<StatusDot tone="down" label="Off" />)).toContain(`<span class="${DOT} bg-down"`);
    expect(renderToStaticMarkup(<StatusDot tone="muted" label="Idle" />)).toContain(`<span class="${DOT} bg-muted"`);
  });

  it('adds a polite live region only when asked', () => {
    expect(renderToStaticMarkup(<StatusDot tone="live" label="Online" live />)).toMatch(
      /^<span class="flex items-center gap-3" aria-live="polite">/,
    );
    expect(renderToStaticMarkup(<StatusDot tone="live" label="Online" />)).not.toContain('aria-live');
  });
});
