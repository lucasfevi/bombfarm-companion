import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { STRINGS, sub } from '../../lib/copy';
import { FarmRefreshControl, farmRefreshAgeLine } from './farm-refresh-control';

const en = STRINGS.en;

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function render(props: Partial<Parameters<typeof FarmRefreshControl>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(FarmRefreshControl, {
      capturedAt: minutesAgo(0),
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

  it('states the age of the account the board was computed from, while the live account still agrees with it', () => {
    expect(render({ capturedAt: minutesAgo(5) })).toContain(sub(en.farmRefreshedAge, { age: en.ageMinutes.replace('{n}', '5') }));
  });

  it('reads as freshly read for the first minute rather than as a zero', () => {
    expect(render({ capturedAt: minutesAgo(0) })).toContain(sub(en.farmRefreshedAge, { age: en.ageJustNow }));
  });

  it('says the numbers are out of date instead of their age once the live account has moved past them', () => {
    const html = render({ stale: true, capturedAt: minutesAgo(5) });
    expect(html).toContain(en.farmRefreshStale);
    expect(html).not.toContain(en.farmRefreshedAge.replace('{age}', ''));
  });

  it('claims no age at all for an account that carries no readable capture time', () => {
    const html = render({ capturedAt: null });
    expect(html).toContain('data-testid="farm-refresh-age"');
    expect(html).not.toContain(en.farmRefreshedAge.replace('{age}', ''));
    expect(html).not.toContain(en.ageJustNow);
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

/**
 * The regression this control was rewritten for. The board recomputes from whatever account the
 * renderer holds, and when the app has lost its ability to re-read the game that account stops
 * moving — so pressing Refresh produced a brand-new calculation over hours-old numbers. Dating the
 * line by the calculation made every such press read "just now"; dating it by the account read
 * cannot, whatever the compute did.
 */
describe('the age line dates the account read, never the calculation', () => {
  const t = STRINGS.en;

  it('an account read three hours ago still reads as three hours old, however recently the board was computed', () => {
    const now = Date.now();
    const line = farmRefreshAgeLine(new Date(now - 3 * 3_600_000).toISOString(), false, t, now);
    expect(line).toBe(sub(t.farmRefreshedAge, { age: t.ageHours.replace('{n}', '3') }));
    expect(line).not.toContain(t.ageJustNow);
  });

  it('two computes a minute apart over the SAME account read report the same age, not two fresh ones', () => {
    const capturedAt = new Date(Date.now() - 40 * 60_000).toISOString();
    const firstComputeAt = Date.now();
    const secondComputeAt = firstComputeAt + 60_000;
    expect(farmRefreshAgeLine(capturedAt, false, t, firstComputeAt)).toBe(
      sub(t.farmRefreshedAge, { age: t.ageMinutes.replace('{n}', '40') }),
    );
    expect(farmRefreshAgeLine(capturedAt, false, t, secondComputeAt)).toBe(
      sub(t.farmRefreshedAge, { age: t.ageMinutes.replace('{n}', '41') }),
    );
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
