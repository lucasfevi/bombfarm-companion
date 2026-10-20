// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountDom, type DomMount } from './dom-test-harness';
import { SiteHeader, type SiteHeaderProps } from './site-header';

const HEADER_CLASS =
  'sticky top-0 z-30 min-h-top border-b border-line bg-[color-mix(in_oklch,var(--surface)_92%,transparent)] px-4 py-2.5 backdrop-blur-[14px]';
const ROW_CLASS = 'mx-auto flex max-w-app flex-wrap items-center justify-between gap-x-3 gap-y-2';
const LEAD_CLASS = 'flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 max-sm:contents';
const STRIP_CLASS = 'max-sm:order-3 max-sm:w-full max-sm:overflow-x-auto max-sm:[scrollbar-width:none]';
const WIDE_CLASS =
  'flex flex-nowrap items-center justify-end gap-1.5 max-sm:order-2 max-[720px]:flex-wrap max-[720px]:justify-start';
const PHONE_CLASS = 'order-2 ml-auto';

let mount: DomMount | undefined;

afterEach(() => {
  mount?.unmount();
  mount = undefined;
});

function render(props: Partial<SiteHeaderProps> = {}) {
  mount = mountDom();
  mount.render(
    <SiteHeader
      brand={<span data-testid="brand">Acme</span>}
      nav={<nav data-testid="nav" aria-label="Sections" />}
      actions={<button data-testid="wide">Invite</button>}
      {...props}
    />,
  );
  const root = mount.container;
  const wrapperOf = (testId: string) => root.querySelector(`[data-testid="${testId}"]`)?.parentElement;
  return { root, wrapperOf };
}

describe('SiteHeader', () => {
  it('renders the sticky bar, the inner row and the left group with the companion classes', () => {
    const { root } = render();
    const header = root.querySelector('header');
    expect(header?.className).toBe(HEADER_CLASS);
    const row = header?.firstElementChild;
    expect(row?.className).toBe(ROW_CLASS);
    expect(row?.firstElementChild?.className).toBe(LEAD_CLASS);
  });

  it('puts the brand first and the nav strip right after it, with the actions at the right', () => {
    const { root } = render();
    const lead = root.querySelector('header > div > div');
    expect(lead?.children[0]?.getAttribute('data-testid')).toBe('brand');
    expect(lead?.children[1]?.className).toBe(STRIP_CLASS);
    expect(lead?.children[1]?.firstElementChild?.getAttribute('data-testid')).toBe('nav');
    const row = root.querySelector('header > div');
    expect(row?.lastElementChild?.className).toBe(WIDE_CLASS);
    expect(row?.lastElementChild?.firstElementChild?.getAttribute('data-testid')).toBe('wide');
  });

  describe('without a compact prop', () => {
    it('renders both action branches and lets CSS hide one at each width', () => {
      const { wrapperOf } = render({ compactActions: <button data-testid="phone">Menu</button> });
      expect(wrapperOf('wide')?.className).toBe(`${WIDE_CLASS} max-sm:hidden`);
      expect(wrapperOf('phone')?.className).toBe(`${PHONE_CLASS} sm:hidden`);
    });

    it('keeps the actions visible below sm when there are no compact actions', () => {
      const { root, wrapperOf } = render();
      expect(wrapperOf('wide')?.className).toBe(WIDE_CLASS);
      expect(root.querySelectorAll('.sm\\:hidden')).toHaveLength(0);
    });
  });

  describe('with a compact prop', () => {
    const compactActions = <button data-testid="phone">Menu</button>;

    it('renders only the phone wrapper, with no hiding class, when compact is true', () => {
      const { root, wrapperOf } = render({ compact: true, compactActions });
      expect(wrapperOf('phone')?.className).toBe(PHONE_CLASS);
      expect(root.querySelector('[data-testid="wide"]')).toBeNull();
    });

    it('renders only the wide cluster, with no hiding class, when compact is false', () => {
      const { root, wrapperOf } = render({ compact: false, compactActions });
      expect(wrapperOf('wide')?.className).toBe(WIDE_CLASS);
      expect(root.querySelector('[data-testid="phone"]')).toBeNull();
    });

    it('falls back to the actions when compact is true and there are no compact actions', () => {
      const { wrapperOf } = render({ compact: true });
      expect(wrapperOf('wide')?.className).toBe(WIDE_CLASS);
    });
  });

  it('renders no nav strip when there is no nav', () => {
    const { root } = render({ nav: undefined });
    const lead = root.querySelector('header > div > div');
    expect(lead?.children).toHaveLength(1);
    expect(root.querySelector('[class*="max-sm:order-3"]')).toBeNull();
  });

  it('renders no action wrapper when there are no actions', () => {
    const { root } = render({ actions: undefined });
    expect(root.querySelector('header > div')?.children).toHaveLength(1);
  });

  it('centres the active nav item in its strip on mount and when the key changes', () => {
    mount = mountDom();
    const draw = (key: string) =>
      mount?.render(
        <SiteHeader
          brand="Acme"
          navRecenterKey={key}
          nav={
            <nav>
              <a aria-current="page" data-testid="active" href="#a">
                A
              </a>
            </nav>
          }
        />,
      );
    draw('one');
    const strip = mount.container.querySelector<HTMLElement>(`[class="${STRIP_CLASS}"]`);
    const active = mount.container.querySelector<HTMLElement>('[data-testid="active"]');
    if (!strip || !active) throw new Error('strip not rendered');
    Object.defineProperty(strip, 'clientWidth', { value: 300, configurable: true });
    Object.defineProperty(active, 'offsetWidth', { value: 100, configurable: true });
    Object.defineProperty(active, 'offsetLeft', { value: 500, configurable: true });
    draw('two');
    expect(strip.scrollLeft).toBe(400);
  });
});
