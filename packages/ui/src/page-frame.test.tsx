// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountDom, type DomMount } from './dom-test-harness';
import { PageFrame, PageSection, type PageFrameProps, type PageSectionProps } from './page-frame';
import { workspaceClass } from './panel-field.recipe';

const FRAME_CLASS = 'flex min-h-screen flex-col';
const BODY_CLASS = 'relative flex-1';
const SECTION_CLASS = 'mx-auto grid max-w-app grid-cols-1 gap-3 px-4 pt-3';
const SETTINGS_SECTION_CLASS = 'mx-auto grid max-w-settings grid-cols-1 gap-3 px-4 pt-3';

let mount: DomMount | undefined;

afterEach(() => {
  mount?.unmount();
  mount = undefined;
});

function renderFrame(props: PageFrameProps) {
  mount = mountDom();
  mount.render(<PageFrame {...props} />);
  return mount.container.firstElementChild;
}

function renderSection(props: PageSectionProps) {
  mount = mountDom();
  mount.render(<PageSection {...props} />);
  return mount.container.firstElementChild;
}

const testId = (element: Element) => element.getAttribute('data-testid');

describe('PageFrame', () => {
  const full: PageFrameProps = {
    header: <header data-testid="header" />,
    notices: <aside data-testid="notice" />,
    children: <main data-testid="body" />,
    footer: <footer data-testid="footer" />,
    overlays: <output data-testid="overlay" />,
  };

  it('renders the full-height column with the companion classes', () => {
    expect(renderFrame(full)?.className).toBe(FRAME_CLASS);
  });

  it('places the header, notices, body, footer and overlays in that order', () => {
    const frame = renderFrame(full);
    expect(Array.from(frame?.children ?? []).map(testId)).toEqual(['header', 'notice', null, 'footer', 'overlay']);
  });

  it('wraps the children in a relative flex-1 body', () => {
    const body = renderFrame(full)?.children[2];
    expect(body?.className).toBe(BODY_CLASS);
    expect(body?.firstElementChild?.getAttribute('data-testid')).toBe('body');
  });

  it('keeps the flex-1 body when no other slot is given, so the footer stays at the bottom', () => {
    const frame = renderFrame({ children: <main /> });
    expect(frame?.children).toHaveLength(1);
    expect(frame?.firstElementChild?.className).toBe(BODY_CLASS);
  });

  it('adds no markup around several nodes passed in one slot', () => {
    const frame = renderFrame({
      notices: (
        <>
          <aside data-testid="banner" />
          <dialog data-testid="dialog" />
        </>
      ),
      footer: (
        <>
          <footer data-testid="footer" />
          <output data-testid="toast" />
        </>
      ),
    });
    expect(Array.from(frame?.children ?? []).map(testId)).toEqual(['banner', 'dialog', null, 'footer', 'toast']);
  });

  it('merges a caller className into the frame', () => {
    expect(renderFrame({ ...full, className: 'bg-bg' })?.className).toBe(`${FRAME_CLASS} bg-bg`);
  });
});

describe('PageSection', () => {
  it('renders the workspace measure by default', () => {
    expect(renderSection({})?.className).toBe(SECTION_CLASS);
    expect(workspaceClass).toBe(SECTION_CLASS);
  });

  it('renders exactly the workspace measure for measure="default"', () => {
    expect(renderSection({ measure: 'default' })?.className).toBe(SECTION_CLASS);
  });

  it('narrows to the settings measure for measure="settings"', () => {
    expect(renderSection({ measure: 'settings' })?.className).toBe(SETTINGS_SECTION_CLASS);
  });

  it('renders its children and passes other div attributes through', () => {
    const section = renderSection({ id: 'reports', children: <p data-testid="child" /> });
    expect(section?.id).toBe('reports');
    expect(section?.firstElementChild?.getAttribute('data-testid')).toBe('child');
  });

  it('merges a caller className after the measure', () => {
    expect(renderSection({ className: 'pb-6' })?.className).toBe(`${SECTION_CLASS} pb-6`);
  });
});
