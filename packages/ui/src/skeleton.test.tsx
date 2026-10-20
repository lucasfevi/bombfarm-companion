import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './skeleton';

const BONE = 'motion-safe:animate-pulse rounded-md border border-line/55 bg-surface';

describe('Skeleton', () => {
  it('renders a decorative line by default', () => {
    expect(renderToStaticMarkup(<Skeleton />)).toBe(
      `<div class="h-3 w-full ${BONE}" aria-hidden="true"></div>`,
    );
  });

  it('renders a taller block', () => {
    expect(renderToStaticMarkup(<Skeleton shape="block" />)).toBe(
      `<div class="h-24 w-full ${BONE}" aria-hidden="true"></div>`,
    );
  });

  it('renders the requested number of table rows in one hidden stack', () => {
    const html = renderToStaticMarkup(<Skeleton shape="rows" rows={3} />);
    expect(html.startsWith('<div class="flex flex-col gap-2" aria-hidden="true">')).toBe(true);
    expect(html.split(`<div class="h-8 w-full ${BONE}"></div>`)).toHaveLength(4);
  });

  it('defaults to five rows', () => {
    const html = renderToStaticMarkup(<Skeleton shape="rows" />);
    expect(html.split('h-8 w-full')).toHaveLength(6);
  });

  it('pulses only when motion is allowed', () => {
    for (const shape of ['line', 'block', 'rows'] as const) {
      const html = renderToStaticMarkup(<Skeleton shape={shape} />);
      expect(html).toContain('motion-safe:animate-pulse');
      expect(html.replaceAll('motion-safe:animate-pulse', '')).not.toContain('animate-pulse');
    }
  });

  it('lets a caller class win a conflicting utility', () => {
    const html = renderToStaticMarkup(<Skeleton className="h-6 w-1/2" />);
    const classes = (/class="([^"]*)"/.exec(html)?.[1] ?? '').split(' ');
    expect(classes).toContain('h-6');
    expect(classes).toContain('w-1/2');
    expect(classes).not.toContain('h-3');
    expect(classes).not.toContain('w-full');
  });

  it('names a busy region when given a label, keeping the bones hidden', () => {
    const html = renderToStaticMarkup(<Skeleton label="Loading entries" shape="block" />);
    expect(html).toBe(
      `<div role="status" aria-busy="true" aria-label="Loading entries"><div class="h-24 w-full ${BONE}" aria-hidden="true"></div></div>`,
    );
  });

  it('adds no wrapper and no status role without a label', () => {
    const html = renderToStaticMarkup(<Skeleton shape="rows" rows={2} />);
    expect(html).not.toContain('role=');
    expect(html).not.toContain('aria-busy');
  });
});
