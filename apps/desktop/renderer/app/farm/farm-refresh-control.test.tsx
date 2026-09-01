import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { STRINGS, sub } from '../../lib/copy';
import { FarmRefreshControl } from './farm-refresh-control';

const en = STRINGS.en;

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function render(props: Partial<Parameters<typeof FarmRefreshControl>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(FarmRefreshControl, {
      computedAt: minutesAgo(0),
      stale: false,
      busy: false,
      onRefresh: () => {},
      ...props,
    }),
  );
}

describe('FarmRefreshControl — one control, always present, two states', () => {
  it('offers the refresh whether or not the snapshot has gone out of date', () => {
    expect(render({ stale: false })).toContain('data-testid="farm-refresh"');
    expect(render({ stale: true })).toContain('data-testid="farm-refresh"');
  });

  it('states the age of the board on screen while the live account still agrees with it', () => {
    expect(render({ computedAt: minutesAgo(5) })).toContain(sub(en.farmRefreshedAge, { age: en.ageMinutes.replace('{n}', '5') }));
  });

  it('reads as freshly worked out for the first minute rather than as a zero', () => {
    expect(render({ computedAt: minutesAgo(0) })).toContain(sub(en.farmRefreshedAge, { age: en.ageJustNow }));
  });

  it('says the numbers are out of date instead of their age once the live account has moved past them', () => {
    const html = render({ stale: true, computedAt: minutesAgo(5) });
    expect(html).toContain(en.farmRefreshStale);
    expect(html).not.toContain(en.farmRefreshedAge.replace('{age}', ''));
  });

  it('says it is working and refuses a second press while a recompute is in flight', () => {
    const html = render({ busy: true });
    expect(html).toContain(en.farmRefreshBusy);
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
  });

  it('is pressable again once the recompute has settled', () => {
    const html = render({ busy: false });
    expect(html).toContain(en.farmRefresh);
    expect(html).not.toContain('disabled=""');
  });
});

describe('the Farm screen mounts the control unconditionally, over the board heading line', () => {
  const source = readFileSync(path.join(__dirname, 'farm-view.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  it('the scan reads a real file', () => {
    expect(source).toMatch(/export function FarmView/);
  });

  it('hands the control to the board as its header slot, with no staleness gate around it', () => {
    expect(source).toContain('headerOverlay: (');
    expect(source).toContain('<FarmRefreshControl');
    expect(source).not.toMatch(/\{stale \?/);
  });

  it('refreshes through the screen\'s one recompute path, never a second call into the store', () => {
    const refreshCalls = source.match(/\brefresh\(/g) ?? [];
    expect(refreshCalls).toHaveLength(1);
  });
});
