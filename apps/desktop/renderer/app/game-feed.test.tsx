import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameStatusInfo } from '@bombfarm/contracts';
import { en } from '../lib/copy/en';
import { sub } from '../lib/copy';

vi.mock('../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/copy')>();
  return { ...actual, useCopy: () => en };
});

const { GameFeed, gameWords, liveTabMark } = await import('./game-feed');

const at = (status: GameStatusInfo['status'], staleAgeMs?: number): GameStatusInfo => ({ status, updatedAt: 't', ...(staleAgeMs === undefined ? {} : { staleAgeMs }) });

function render(status: GameStatusInfo | null): string {
  return renderToStaticMarkup(createElement(GameFeed, { status }));
}

function tagOf(html: string, testId: string): string {
  return new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0] ?? '';
}

function textOf(html: string, testId: string): string {
  return new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>([^<]*)<`).exec(html)?.[1] ?? '';
}

describe('gameWords — the three states, as a word and as a sentence', () => {
  it('connected reads "Connected", with the streaming sentence for the tooltip', () => {
    expect(gameWords(at('connected'), en)).toEqual({ word: en.gameConnected, age: null, tip: en.liveStatusLiveLabel, tone: 'up' });
  });

  it('stale carries its age beside the word and in the sentence, in the warn tone', () => {
    const words = gameWords(at('stale', 3 * 60_000), en);
    expect(words.word).toBe(en.gameStale);
    expect(words.age).toBe(sub(en.ageShortMinutes, { n: 3 }));
    expect(words.tip).toBe(sub(en.gameFeedStaleTip, { age: sub(en.ageShortMinutes, { n: 3 }) }));
    expect(words.tone).toBe('warn');
  });

  it('stale with no age known says stale, and no figure it does not have', () => {
    expect(gameWords(at('stale'), en)).toEqual({ word: en.gameStale, age: null, tip: en.gameFeedStaleNoAgeTip, tone: 'warn' });
  });

  it('not running is muted, never amber — nothing is wrong, the game is simply closed', () => {
    expect(gameWords(at('not_running'), en)).toEqual({ word: en.gameNotRunning, age: null, tip: en.gameFeedNotRunningTip, tone: 'muted' });
  });

  it('before main has answered, "Connecting" with the loading sentence, and no tone for the tab to wear', () => {
    expect(gameWords(null, en)).toEqual({ word: en.gameConnecting, age: null, tip: en.shellLoadingLabel, tone: null });
    expect(liveTabMark(null, en)).toBeUndefined();
  });
});

describe("liveTabMark — the Live tab's corner dot says exactly what the strip's game cell says", () => {
  it.each<GameStatusInfo['status']>(['connected', 'stale', 'not_running'])("%s: same tone, and the cell's sentence as the label", (status) => {
    const words = gameWords(at(status, 60_000), en);
    expect(liveTabMark(at(status, 60_000), en)).toEqual({ tone: words.tone, label: words.tip });
  });
});

describe("GameFeed — a dot and a word at the strip's left", () => {
  it('is a status landmark: a pulsing green dot beside "Connected", and no chip', () => {
    const html = render(at('connected'));
    expect(tagOf(html, 'game-feed')).toContain('role="status"');
    expect(tagOf(html, 'game-feed')).toContain('data-game="connected"');
    expect(tagOf(html, 'game-feed-dot')).toContain('bg-up');
    expect(tagOf(html, 'game-feed-dot')).toContain('animate-pulse');
    expect(textOf(html, 'game-feed-value')).toBe(en.gameConnected);
    expect(html).not.toContain('chip');
  });

  it('stale is a steady amber dot with the age beside the word; not running a hollow dot and a muted word', () => {
    const stale = render(at('stale', 60_000));
    expect(tagOf(stale, 'game-feed-dot')).toContain('bg-warn');
    expect(tagOf(stale, 'game-feed-dot')).not.toContain('animate-pulse');
    expect(textOf(stale, 'game-feed-age')).toBe(sub(en.ageShortMinutes, { n: 1 }));
    const off = render(at('not_running'));
    expect(tagOf(off, 'game-feed-dot')).toContain('bg-transparent');
    expect(tagOf(off, 'game-feed-value')).toContain('text-muted');
    expect(off).not.toContain('data-testid="game-feed-age"');
  });

  it('says its sentence through the design-system tooltip, never the native attribute', () => {
    const html = render(at('not_running'));
    expect(html).not.toContain(' title=');
    expect(tagOf(html, 'game-feed')).toContain('data-slot="tooltip-trigger"');
  });
});
