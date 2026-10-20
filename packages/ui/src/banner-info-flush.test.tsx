import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Banner, type BannerProps } from './banner';
import { setupBannerEmbeddedClass, setupBannerRecipe } from './panel-field.recipe';

function render(props: BannerProps) {
  return renderToStaticMarkup(createElement(Banner, props));
}

function classesOf(html: string): string[] {
  return (/^<div[^>]*? class="([^"]*)"/.exec(html)?.[1] ?? '').split(' ');
}

describe('Banner info tone', () => {
  it('dresses a neutral card: line border, raised background, no status colour', () => {
    const html = render({ tone: 'info', children: 'Heads up' });
    const classes = classesOf(html);
    expect(classes).toEqual(expect.arrayContaining(['rounded-sm', 'border', 'border-line', 'bg-bg-2']));
    expect(html).not.toMatch(/var\(--(warn|down|up)\)/);
  });

  it('keeps the page margins of the other tones by default', () => {
    expect(setupBannerRecipe({ tone: 'info' })).toContain('mx-auto mt-2.5 max-w-app');
  });

  it('titles in ink with the bold 13px heading of the other tones', () => {
    const html = render({ tone: 'info', title: 'About this page', children: 'Details' });
    expect(html).toContain('<h2 class="mb-1 m-0 text-[13px] font-bold text-ink">About this page</h2>');
    expect(html).toMatch(/<p class="[^"]*">Details<\/p>/);
  });

  it('stays a status region', () => {
    expect(render({ tone: 'info', children: 'x' })).toContain('role="status"');
  });
});

describe('Banner flush layout', () => {
  it('drops every outer margin and the page width cap', () => {
    const classes = classesOf(render({ tone: 'warn', layout: 'flush', children: 'x' }));
    expect(classes).toEqual(expect.arrayContaining(['m-0', 'max-w-none', 'w-full']));
    expect(classes).not.toContain('mb-2.5');
    expect(classes).not.toContain('mx-auto');
    expect(classes).not.toContain('mt-2.5');
  });

  it('works with every tone', () => {
    for (const tone of ['warn', 'ok', 'danger', 'info'] as const) {
      const classes = classesOf(render({ tone, layout: 'flush', children: 'x' }));
      expect(classes).toContain('m-0');
      expect(classes).not.toContain('mx-auto');
    }
  });

  it('lets a caller class add a margin back', () => {
    const classes = classesOf(render({ layout: 'flush', className: 'mt-4', children: 'x' }));
    expect(classes.indexOf('mt-4')).toBeGreaterThan(classes.indexOf('m-0'));
  });

  it('leaves the embedded layout and its bottom margin as they were', () => {
    expect(setupBannerEmbeddedClass).toBe('mx-0 mt-0 mb-2.5 max-w-none w-full');
    const classes = classesOf(render({ layout: 'embedded', children: 'x' }));
    expect(classes).toContain('mb-2.5');
    expect(classes).not.toContain('m-0');
  });

  it('leaves the default page layout margins untouched', () => {
    const classes = classesOf(render({ children: 'x' }));
    expect(classes).toEqual(expect.arrayContaining(['mx-auto', 'mt-2.5', 'max-w-app']));
  });
});
