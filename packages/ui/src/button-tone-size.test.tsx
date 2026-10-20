// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Button } from './button';
import { buttonRecipe } from './button.recipe';
import { mountDom, stubMatchMedia, type DomMount } from './dom-test-harness';

let dom: DomMount;

beforeEach(() => {
  stubMatchMedia(false);
  dom = mountDom();
});

afterEach(() => {
  dom.unmount();
});

function renderedClasses(node: React.ReactNode): string[] {
  dom.render(node);
  const button = dom.container.querySelector('button');
  if (!button) throw new Error('no button rendered');
  return (button.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

const DEFAULT_CLASS =
  'cursor-pointer rounded-sm border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 motion-safe:transition-[border-color,background-color] motion-safe:duration-[120ms] motion-safe:ease-out border-line bg-bg-2 hover:border-accent';

describe('buttonRecipe tone and size', () => {
  it('leaves every variant untouched when neither axis is set', () => {
    expect(buttonRecipe({ variant: 'default' })).toBe(DEFAULT_CLASS);
    expect(buttonRecipe()).toBe(DEFAULT_CLASS);
    expect(buttonRecipe({ variant: 'coffee' })).toBe('btn coffee');
    expect(buttonRecipe({ variant: 'text' })).not.toMatch(/down|px-3/);
  });

  it('draws a solid danger primary', () => {
    const classes = renderedClasses(
      <Button variant="primary" tone="danger">
        Delete
      </Button>,
    );
    expect(classes).toEqual(expect.arrayContaining(['border-down', 'bg-down', 'text-accent-ink']));
    expect(classes).not.toContain('bg-accent');
    expect(classes).not.toContain('border-accent');
    expect(classes).not.toContain('hover:border-accent');
  });

  it.each(['default', 'ghost'] as const)('draws an outlined danger %s', (variant) => {
    const classes = renderedClasses(
      <Button variant={variant} tone="danger">
        Delete
      </Button>,
    );
    expect(classes).toEqual(
      expect.arrayContaining([
        'border-[color-mix(in_oklch,var(--down)_60%,var(--line))]',
        'bg-transparent',
        'text-down',
        'hover:border-down',
      ]),
    );
    expect(classes).not.toContain('border-line');
    expect(classes).not.toContain('bg-bg-2');
    expect(classes).not.toContain('hover:border-accent');
  });

  it('ignores the danger tone on variants it has no definition for', () => {
    for (const variant of ['help', 'help-on', 'text', 'icon', 'icon-action', 'referral', 'coffee', 'coffee-full'] as const) {
      expect(buttonRecipe({ variant, tone: 'danger' }), variant).toBe(buttonRecipe({ variant }));
    }
  });

  it('lets the medium size win over the base padding and text size', () => {
    const classes = renderedClasses(<Button size="md">Save</Button>);
    expect(classes).toEqual(expect.arrayContaining(['px-3', 'py-2', 'text-sm']));
    expect(classes).not.toContain('px-2.5');
    expect(classes).not.toContain('py-1.5');
    expect(classes).not.toContain('text-xs');
  });

  it('keeps the small size when none is given', () => {
    const classes = renderedClasses(<Button>Save</Button>);
    expect(classes).toEqual(expect.arrayContaining(['px-2.5', 'py-1.5', 'text-xs']));
  });

  it('ignores the medium size on variants whose geometry is their own', () => {
    for (const variant of ['help', 'help-on', 'text', 'icon', 'icon-action', 'coffee', 'coffee-full'] as const) {
      expect(buttonRecipe({ variant, size: 'md' }), variant).toBe(buttonRecipe({ variant }));
    }
  });

  it('combines tone and size and still honours a caller className', () => {
    const classes = renderedClasses(
      <Button variant="primary" tone="danger" size="md" className="w-full">
        Delete account
      </Button>,
    );
    expect(classes).toEqual(expect.arrayContaining(['bg-down', 'px-3', 'py-2', 'text-sm', 'w-full']));
  });
});
