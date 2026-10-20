// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountDom, type DomMount } from './dom-test-harness';
import { SiteFooter, type SiteFooterProps } from './site-footer';

const FRAME_CLASS = 'mx-auto mt-5 max-w-app px-4';
const ROW_CLASS = 'flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line py-3';
const LEGAL_CLASS = 'm-0 flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-normal text-muted';
const TRAILING_CLASS = 'flex max-w-full shrink-0 flex-wrap items-center gap-x-3 gap-y-2';

let mount: DomMount | undefined;

afterEach(() => {
  mount?.unmount();
  mount = undefined;
});

function render(props: SiteFooterProps) {
  mount = mountDom();
  mount.render(<SiteFooter {...props} />);
  const footer = mount.container.querySelector('footer');
  const row = footer?.firstElementChild;
  return { footer, row };
}

describe('SiteFooter', () => {
  it('renders the footer frame with the top rule row inside it', () => {
    const { footer, row } = render({ legal: <span>(c) Acme</span>, trailing: <a href="#a">Terms</a> });
    expect(footer?.className).toBe(FRAME_CLASS);
    expect(footer?.children).toHaveLength(1);
    expect(row?.className).toBe(ROW_CLASS);
  });

  it('puts the legal slot first, in a paragraph, and the trailing slot after it', () => {
    const { row } = render({
      legal: <span data-testid="legal">(c) Acme</span>,
      trailing: <a data-testid="trailing" href="#a">Terms</a>,
    });
    expect(row?.children).toHaveLength(2);
    const [legal, trailing] = Array.from(row?.children ?? []);
    expect(legal?.tagName).toBe('P');
    expect(legal?.className).toBe(LEGAL_CLASS);
    expect(legal?.firstElementChild?.getAttribute('data-testid')).toBe('legal');
    expect(trailing?.tagName).toBe('DIV');
    expect(trailing?.className).toBe(TRAILING_CLASS);
    expect(trailing?.firstElementChild?.getAttribute('data-testid')).toBe('trailing');
  });

  it('renders no trailing wrapper when there is no trailing slot', () => {
    const { row } = render({ legal: <span>(c) Acme</span> });
    expect(row?.children).toHaveLength(1);
    expect(row?.firstElementChild?.tagName).toBe('P');
  });

  it('renders no legal wrapper when there is no legal slot, and keeps the trailing slot at the right', () => {
    const { row } = render({ trailing: <a href="#a">Terms</a> });
    expect(row?.children).toHaveLength(1);
    expect(row?.firstElementChild?.tagName).toBe('DIV');
    expect(row?.firstElementChild?.className).toBe(`${TRAILING_CLASS} ml-auto`);
  });

  it('renders the bare frame and row when both slots are missing', () => {
    const { footer, row } = render({});
    expect(footer?.className).toBe(FRAME_CLASS);
    expect(row?.className).toBe(ROW_CLASS);
    expect(row?.children).toHaveLength(0);
  });

  it('merges a caller className into the frame', () => {
    const { footer } = render({ className: 'mb-4' });
    expect(footer?.className).toBe(`${FRAME_CLASS} mb-4`);
  });
});
