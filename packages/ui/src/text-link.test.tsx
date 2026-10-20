import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TextLink } from './text-link';

const RouterLink = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<'a'> & { to: string }>(
  function RouterLink({ to, ...props }, ref) {
    return <a ref={ref} href={to} data-router="1" {...props} />;
  },
);

describe('TextLink', () => {
  it('renders an anchor in accent ink that underlines on hover', () => {
    const html = renderToStaticMarkup(<TextLink href="/help">Help</TextLink>);
    expect(html).toBe('<a class="text-accent underline-offset-2 hover:underline" href="/help">Help</a>');
  });

  it('forwards native anchor props', () => {
    const html = renderToStaticMarkup(
      <TextLink href="https://example.com" target="_blank" rel="noreferrer" data-testid="out">
        Out
      </TextLink>,
    );
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
    expect(html).toContain('data-testid="out"');
  });

  it('lets a caller class win a conflicting utility', () => {
    const html = renderToStaticMarkup(
      <TextLink href="/" className="text-ink font-semibold">
        x
      </TextLink>,
    );
    const classes = (/class="([^"]*)"/.exec(html)?.[1] ?? '').split(' ');
    expect(classes).toContain('text-ink');
    expect(classes).toContain('font-semibold');
    expect(classes).not.toContain('text-accent');
  });

  it('renders through a consumer link component, passing the class and props along', () => {
    const html = renderToStaticMarkup(
      <TextLink as={RouterLink} to="/settings" aria-label="Settings">
        Settings
      </TextLink>,
    );
    expect(html).toBe(
      '<a href="/settings" data-router="1" class="text-accent underline-offset-2 hover:underline" aria-label="Settings">Settings</a>',
    );
  });

  it('wears a muted tone for quiet footer links', () => {
    const html = renderToStaticMarkup(
      <TextLink href="/terms" tone="muted">
        Terms
      </TextLink>,
    );
    expect(html).toBe('<a class="text-xs text-muted underline" href="/terms">Terms</a>');
  });
});
