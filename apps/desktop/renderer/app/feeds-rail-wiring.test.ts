import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The refresh press is drawn ONCE, in the status strip's rail, and never by a screen. A screen
 * whose numbers come from a copy of its own — the board, the bag, the snapshot, the standing —
 * hands the rail its refresh through the registry instead, so the press is in one place on every
 * tab and still does what that screen needs.
 */
function stripped(...segments: string[]): string {
  return segments
    .map((segment) => readFileSync(path.join(__dirname, segment), 'utf8'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('the shell draws the press once, in its status strip', () => {
  const page = stripped('page.tsx');
  const rail = stripped('feeds-rail.tsx');

  it('the scan reads real files', () => {
    expect(page).toMatch(/export default function HomePage/);
    expect(rail).toMatch(/export function FeedsRail/);
  });

  it('no screen draws a refresh control of its own any more', () => {
    for (const screen of ['farm/farm-view.tsx', 'forge/forge-view.tsx', 'optimizer/optimizer-view.tsx', 'optimizer/optimizer-screen.tsx', 'pvp/pvp-view.tsx', 'pvp/standing-panel.tsx']) {
      expect(stripped(screen), screen).not.toContain('AccountRefreshControl');
      expect(stripped(screen), screen).not.toContain('account-refresh');
    }
  });

  it('the game is the zeroth feed at the strip\'s left, and the Live tab wears its state as a dot', () => {
    expect(page).toContain('status={<GameFeed status={status} />}');
    expect(page).toContain("item.id === 'live' ? { ...item, mark: liveMark } : item");
    expect(page).not.toContain('StatusChip');
  });

  it("the shell mounts the rail at the strip's right, beside the version, fed by the feeds hook keyed on the tab on show", () => {
    expect(page).toContain('useFeeds({ activeTabId: activeNavId, updateStatus, onUpdateCheck })');
    expect(page).toContain('<FeedsRail {...feeds} activeTabId={activeNavId} />');
    expect(page.indexOf('<FeedsRail')).toBeLessThan(page.indexOf('data-testid="app-version"'));
  });
});

describe('the Farm screen hands the bar its refresh, with no staleness gate around it', () => {
  const source = stripped('farm/farm-view.tsx');

  it('the scan reads a real file', () => {
    expect(source).toMatch(/export function FarmView/);
  });

  it("registers under its own tab id, dating the line by the settled board's account read", () => {
    expect(source).toContain("useScreenRefreshRegistration('farm', { capturedAt: settled?.capturedAt ?? null, stale, busy, readState, onRefresh })");
    expect(source).not.toMatch(/\{stale \?/);
  });

  it("refreshes through the screen's one recompute path, never a second call into the store", () => {
    const refreshCalls = source.match(/\brefresh\(/g) ?? [];
    expect(refreshCalls).toHaveLength(1);
  });

  it('asks the app to go and read the account, not only to re-solve from the one in hand', () => {
    expect(source).toContain('useAccountReadRequest(adoptLive)');
  });
});

describe('the Forge screen hands the bar its refresh, not a refresh of its own', () => {
  const source = stripped('forge/forge-view.tsx');

  it('the scan reads a real file', () => {
    expect(source).toMatch(/export function ForgeView/);
  });

  it("registers under its own tab id, dating the line by the pinned bag's account read", () => {
    expect(source).toContain("useScreenRefreshRegistration('forge', { capturedAt, stale, busy: false, readState: refreshState, onRefresh: refresh })");
    expect(source).not.toContain('ForgeRefresh');
  });

  it('asks the app to go and read the account, not only to re-pin the one in hand', () => {
    expect(source).toContain('useAccountReadRequest(adoptLive)');
  });
});

describe('the Optimizer screen hands the bar its refresh, with no staleness gate around it', () => {
  const source = stripped('optimizer/optimizer-view.tsx', 'optimizer/optimizer-screen.tsx');

  it('the scan reads real files', () => {
    expect(source).toMatch(/export function OptimizerView/);
    expect(source).toMatch(/export function OptimizerScreen/);
  });

  it("registers under its own tab id, dating the line by the settled snapshot's account read", () => {
    expect(source).toContain("useScreenRefreshRegistration('optimizer', { capturedAt: settled?.capturedAt ?? null, stale, busy, readState, onRefresh })");
    expect(source).not.toMatch(/\{stale \?/);
  });

  it("refreshes through the screen's one recompute path, never a second call into the store", () => {
    const refreshCalls = source.match(/\brefresh\(\)/g) ?? [];
    expect(refreshCalls).toHaveLength(1);
  });

  it('asks the app to go and read the account, not only to re-solve from the one in hand', () => {
    expect(source).toContain('useAccountReadRequest(adoptLive)');
  });
});

describe("the PVP screen hands the bar the standing's own read, dated by the standing", () => {
  const source = stripped('pvp/pvp-view.tsx');

  it('the scan reads a real file', () => {
    expect(source).toMatch(/export function PvpView/);
  });

  it("registers the standing read under its own tab id, with the standing's line", () => {
    expect(source).toContain("useScreenRefreshRegistration('pvp', {");
    expect(source).toContain('capturedAt: history?.standing?.capturedAt ?? null');
    expect(source).toContain('onRefresh: refresh.request');
    expect(source).toContain('ageLine: standingAge');
    expect(source).toContain('sub(t.pvpStandingAge, { age })');
  });

  it('asks main for the standing, never the account', () => {
    expect(source).toContain('usePvpRefresh()');
    expect(source).not.toContain('useAccountReadRequest');
  });
});
