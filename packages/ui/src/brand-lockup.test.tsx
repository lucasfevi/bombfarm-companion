// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { BrandLockup, type BrandLockupProps } from './brand-lockup';
import { mountDom, type DomMount } from './dom-test-harness';
import { siteHeaderBrandClass } from './site-header.recipe';

const MARK_CLASS = 'size-8.5 shrink-0';
const TITLE_CLASS = 'text-sm leading-1.1 font-bold text-ink';
const TAG_CLASS = 'text-[11px] tracking-[0.04em] text-muted uppercase';

let mount: DomMount | undefined;

afterEach(() => {
  mount?.unmount();
  mount = undefined;
});

function renderInLink(props: BrandLockupProps) {
  mount = mountDom();
  mount.render(
    <a href="#home" className={siteHeaderBrandClass}>
      <BrandLockup {...props} />
    </a>,
  );
  return mount.container.querySelector('a');
}

describe('BrandLockup', () => {
  it('renders the mark and then one div holding the title and the tag', () => {
    const link = renderInLink({ title: 'Acme', tag: 'Planner' });
    expect(link?.children).toHaveLength(2);
    expect(link?.children[0]?.tagName.toLowerCase()).toBe('svg');
    const text = link?.children[1];
    expect(text?.tagName).toBe('DIV');
    expect(text?.className).toBe('');
    expect(text?.children).toHaveLength(2);
    expect(text?.children[0]?.textContent).toBe('Acme');
    expect(text?.children[1]?.textContent).toBe('Planner');
  });

  it('sets the title, tag and mark classes', () => {
    const link = renderInLink({ title: 'Acme', tag: 'Planner' });
    expect(link?.children[0]?.getAttribute('class')).toBe(MARK_CLASS);
    expect(link?.children[1]?.children[0]?.className).toBe(TITLE_CLASS);
    expect(link?.children[1]?.children[1]?.className).toBe(TAG_CLASS);
  });

  it('draws the web-toned mark at 34px by default', () => {
    const mark = renderInLink({ title: 'Acme' })?.children[0];
    expect(mark?.getAttribute('width')).toBe('34');
    expect(mark?.getAttribute('height')).toBe('34');
    const fills = Array.from(mark?.children ?? []).map((shape) => shape.getAttribute('fill'));
    expect(fills).toEqual(['#17100c', '#e78a45', '#e78a45', '#17100c', '#efe6e1']);
  });

  it('replaces the default mark with the mark slot', () => {
    const link = renderInLink({ title: 'Acme', tag: 'Planner', mark: <img alt="" src="/logo.svg" className="size-8.5" /> });
    expect(link?.querySelector('svg')).toBeNull();
    expect(link?.children[0]?.tagName).toBe('IMG');
    expect(link?.children[0]?.getAttribute('class')).toBe('size-8.5');
    expect(link?.children).toHaveLength(2);
  });

  it('renders no tag div without a tag', () => {
    const link = renderInLink({ title: 'Acme' });
    expect(link?.children[1]?.children).toHaveLength(1);
    expect(link?.children[1]?.children[0]?.className).toBe(TITLE_CLASS);
  });

  it('adds no wrapper of its own around the link contents', () => {
    const link = renderInLink({ title: 'Acme', tag: 'Planner' });
    expect(link?.className).toBe('flex items-center gap-2.5 no-underline max-sm:order-1');
    expect(link?.parentElement).toBe(mount?.container);
  });
});
