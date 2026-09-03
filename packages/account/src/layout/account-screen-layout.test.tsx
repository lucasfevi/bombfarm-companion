import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountScreenLayout, type AccountScreenLayoutProps } from './account-screen-layout.js';

function region(name: string) {
  return <p data-testid={`region-${name}`}>{name}</p>;
}

function render(overrides: Partial<AccountScreenLayoutProps> = {}): string {
  return renderToStaticMarkup(
    <AccountScreenLayout
      holdings={region('holdings')}
      identity={region('identity')}
      house={region('house')}
      tree={region('tree')}
      {...overrides}
    />,
  );
}

/** The `class` attribute of the element carrying that `data-testid`. */
function classOf(html: string, testId: string): string {
  const opening = new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0] ?? '';
  return /class="([^"]*)"/.exec(opening)?.[1] ?? '';
}

function at(html: string, testId: string): number {
  return html.indexOf(`data-testid="${testId}"`);
}

/** The markup between one region marker and the next, so a region's own extent can be read. */
function between(html: string, from: string, to: string): string {
  return html.slice(at(html, from), at(html, to));
}

describe('AccountScreenLayout — where the four regions sit', () => {
  it('draws all four regions the host hands it', () => {
    const html = render();

    for (const name of ['holdings', 'identity', 'house', 'tree']) {
      expect(at(html, `region-${name}`)).toBeGreaterThan(-1);
    }
  });

  it('puts holdings and identity in one row, under a grid of two tracks', () => {
    const html = render();

    expect(classOf(html, 'account-screen-summary')).toMatch(
      /min-\[\d+px\]:grid-cols-\[minmax\([^\]]+\)_minmax\([^\]]+\)\]/,
    );
    expect(between(html, 'account-screen-summary', 'account-screen-panels')).toContain(
      'data-testid="region-identity"',
    );
  });

  it('gives holdings the flexible track and identity the bounded one, so three columns survive', () => {
    const tracks = /grid-cols-\[minmax\(0,1fr\)_minmax\(([\d.]+)rem,([\d.]+)rem\)\]/.exec(
      classOf(render(), 'account-screen-summary'),
    );

    expect(
      tracks,
      'identity no longer holds a bounded track beside a holdings track that takes the rest',
    ).not.toBeNull();
    expect(Number(tracks?.[2])).toBeGreaterThan(Number(tracks?.[1]));
  });

  it('stretches both halves of the summary row to one height, panel included', () => {
    const html = render();
    const row = classOf(html, 'account-screen-summary');

    // A panel that stops short of its neighbour reads as unfinished rather than as brief.
    expect(row, 'the row pins its cells to their own height again').not.toContain('items-start');
    expect(row).toContain('items-stretch');

    // The grid cell filling the row is not enough on its own: the panel inside carries the border,
    // so it is the thing that has to grow. Both slots pass the stretch down, so the rule holds
    // whichever side turns out to be taller.
    expect(classOf(html, 'account-screen-identity')).toContain('flex-1');
    expect(classOf(html, 'account-screen-holdings')).toContain('flex-1');
  });

  it('collapses both rows to a stack before the width is there for them', () => {
    const html = render();

    expect(classOf(html, 'account-screen-summary')).toContain('grid-cols-1');
    expect(classOf(html, 'account-screen-panels')).toContain('grid-cols-1');
  });

  it('leaves House and tree paired in a row of their own, below the two above', () => {
    const html = render();

    expect(classOf(html, 'account-screen-panels')).toMatch(/min-\[\d+px\]:grid-cols-2/);
    expect(between(html, 'account-screen-panels', 'region-tree')).toContain(
      'data-testid="region-house"',
    );
    expect(at(html, 'account-screen-panels')).toBeGreaterThan(at(html, 'region-identity'));
  });

  it('keeps House and tree out of the row holdings and identity share', () => {
    const summary = between(render(), 'account-screen-summary', 'account-screen-panels');

    expect(summary).not.toContain('data-testid="region-house"');
    expect(summary).not.toContain('data-testid="region-tree"');
  });

  it('draws the regions a host withheld as nothing, rather than as a hole for them', () => {
    const html = render({ identity: null, house: null });

    expect(at(html, 'region-holdings')).toBeGreaterThan(-1);
    expect(at(html, 'region-tree')).toBeGreaterThan(-1);
    expect(at(html, 'region-identity')).toBe(-1);
    expect(at(html, 'region-house')).toBe(-1);
  });

  it('takes the host class on the outside, leaving the two rows theirs', () => {
    expect(classOf(render({ className: 'host-supplied' }), 'account-screen')).toContain(
      'host-supplied',
    );
  });
});
