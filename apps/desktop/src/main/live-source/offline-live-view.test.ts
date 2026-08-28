import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AccountPayload, AccountView } from '@bombfarm/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveSource } from './live-source.js';
import { createReplayTapFactory, REPLAY_FRAME_INTERVAL_MS } from './replay-tap.js';

/** `__dirname`, not `import.meta.url`: `tsconfig.main.json` builds this tree to CommonJS. */
const HERE = __dirname;
const CAPTURE = resolve(HERE, 'fixtures', 'live-capture.bfcc');
const OFFLINE_ACCOUNT = resolve(HERE, '..', '..', '..', 'tests', 'fixtures', 'account-offline.json');

function offlineAccountView(): AccountView {
  const payload = JSON.parse(readFileSync(OFFLINE_ACCOUNT, 'utf8')) as AccountPayload;
  return {
    payload,
    gameRunning: true,
    store: { status: 'ok', reason: null, binding: null },
  };
}

function offlineLiveSource(): LiveSource {
  return new LiveSource({
    consent: () => true,
    userDataDir: HERE,
    createTap: createReplayTapFactory({ capturePath: CAPTURE, consent: () => true }),
  });
}

/**
 * The failure this guards against is silent: frames decode correctly and arrive on schedule, and
 * the screen is still blank, because the fold they land in has no roster to fold onto. Asserting
 * that ticks were emitted is exactly the assertion that stayed green while the Live screen showed
 * nothing — so every case here reads the folded view instead.
 */
describe('offline mode produces a Live view with something in it', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('has no field entries from replayed frames alone — the rotation is what carries the roster', async () => {
    const source = offlineLiveSource();
    source.start();
    vi.advanceTimersByTime(REPLAY_FRAME_INTERVAL_MS * 60);

    expect(source.getView().rotation).toBeNull();
    expect(source.getView().field).toEqual([]);
    await source.teardown();
  });

  it('carries a rotation, a roster and live countdowns once the fixture account is ingested', async () => {
    const source = offlineLiveSource();
    source.ingestRotation(offlineAccountView());
    source.start();
    vi.advanceTimersByTime(REPLAY_FRAME_INTERVAL_MS * 60);

    const view = source.getView();
    expect(view.rotation).not.toBeNull();
    expect(view.rotation?.heroes.length).toBe(13);
    expect(view.recovery.length).toBeGreaterThan(0);
    await source.teardown();
  });

  /**
   * The account bodies and the capture come from different accounts, so the fixture generator
   * re-keys the roster onto the capture's hero ids. Without that the field header counts the
   * capture's heroes while the list below it stays empty, because the roster join finds none of
   * them — a screen that looks broken rather than empty.
   */
  it('measures field countdowns from the replayed frames, so the roster join actually lands', async () => {
    const source = offlineLiveSource();
    source.ingestRotation(offlineAccountView());
    source.start();
    vi.advanceTimersByTime(REPLAY_FRAME_INTERVAL_MS * 60);

    const view = source.getView();
    expect(view.field.length).toBeGreaterThan(0);

    const rosterIds = new Set(view.rotation?.heroes.map((hero) => hero.id) ?? []);
    const measured = view.field.filter((entry) => rosterIds.has(entry.heroId));
    expect(measured.length).toBe(view.field.length);
    await source.teardown();
  });

  /**
   * The flicker this pins down: an `ingestRotation` whose staleness guard does not hold replaces
   * the field with a REST tick built from the rotation's OWN on-field set, and the fixture ticker
   * re-commits several times a minute. When the rotation disagreed with the capture about who was
   * fighting — one hero against nine — the list visibly alternated between the two answers.
   *
   * It holds still because the generator makes the two agree. `index.ts` additionally ingests only
   * a CHANGED rotation, so this stays true even for a rotation that does disagree.
   */
  it('keeps the same field membership when the same rotation is ingested again mid-replay', async () => {
    const source = offlineLiveSource();
    source.ingestRotation(offlineAccountView());
    source.start();
    vi.advanceTimersByTime(REPLAY_FRAME_INTERVAL_MS * 60);

    const before = source.getView();
    expect(before.field.length).toBeGreaterThan(0);
    const idsBefore = before.field.map((entry) => entry.heroId).sort();

    source.ingestRotation(offlineAccountView());

    const after = source.getView();
    expect(after.field.map((entry) => entry.heroId).sort()).toEqual(idsBefore);
    expect(after.onFieldHeroIds).toEqual(before.onFieldHeroIds);
    await source.teardown();
  });

  it('reports the stream as connected rather than as a gap', async () => {
    const source = offlineLiveSource();
    source.ingestRotation(offlineAccountView());
    source.start();
    vi.advanceTimersByTime(REPLAY_FRAME_INTERVAL_MS * 60);

    expect(source.getView().currency.kind).toBe('live');
    await source.teardown();
  });
});

/**
 * The offline fixture is generated rather than written, so this pins the one property the
 * generator exists to preserve: `/rotation` projects its whole body into `casa`, and a fixture
 * carrying only the inner `casa` child would leave `normalizeRotation` with no heroes.
 */
describe('the committed offline account fixture', () => {
  it('carries the whole /rotation body in its casa section, not just the house child', () => {
    const payload = JSON.parse(readFileSync(OFFLINE_ACCOUNT, 'utf8')) as AccountPayload;
    const casa = payload.casa;

    expect(casa).toBeDefined();
    expect(Object.keys(casa ?? {}).sort()).toEqual(['casa', 'field_size', 'heroes']);
    expect(Array.isArray(casa?.heroes) ? casa.heroes.length : 0).toBe(13);
  });

  it('resolves all five sections, so no screen reads as missing data', () => {
    const payload = JSON.parse(readFileSync(OFFLINE_ACCOUNT, 'utf8')) as AccountPayload;
    const fidelity = payload.fidelity;
    expect(fidelity).toBeDefined();

    const sections = ['account', 'heroes', 'skills', 'casa', 'items'] as const;
    for (const section of sections) {
      expect(fidelity?.[section].status).toBe('resolved');
    }
  });
});
