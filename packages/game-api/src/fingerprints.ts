import type { AccountSection } from '@bombfarm/contracts';

/**
 * Per-route schema fingerprints (LAR-18). Committed with the game build and capture date they
 * were taken from, and — per the calibration corpus — the required key sets below are the real
 * top-level keys of the 2026-08-12 capture (`bombfarm-bot/data/anchor-calibration-2026-08-12T13-15-38-t1c/api-bodies.json`,
 * scrubbed and copied into `src/__fixtures__/api-bodies.json`).
 *
 * `account_id` and `player_name` are deliberately absent from `/state`'s required set: they are
 * the two fields the scrub removes (matching F4's fixtures), and requiring them would make the
 * scrubbed fixture fail its own guard.
 */
export interface RouteFingerprint {
  readonly requiredKeys: readonly string[];
  readonly gameBuild: string;
  readonly capturedAt: string;
}

const GAME_BUILD = '0.1.0.0+2026-08-11T21:38:23Z';
const CAPTURED_AT = '2026-08-12T13:15:38.000Z';

export const ROUTE_FINGERPRINTS: Readonly<Record<AccountSection, RouteFingerprint>> = {
  account: {
    requiredKeys: ['gold', 'phase', 'max_phase', 'locked', 'chests', 'bag_tabs', 'bag_capacity', 'items_count'],
    gameBuild: GAME_BUILD,
    capturedAt: CAPTURED_AT,
  },
  heroes: {
    requiredKeys: ['heroes'],
    gameBuild: GAME_BUILD,
    capturedAt: CAPTURED_AT,
  },
  skills: {
    requiredKeys: ['levels', 'totals', 'gold', 'max_phase', 'refunds', 'field_slots'],
    gameBuild: GAME_BUILD,
    capturedAt: CAPTURED_AT,
  },
  casa: {
    requiredKeys: ['field_size', 'heroes', 'casa'],
    gameBuild: GAME_BUILD,
    capturedAt: CAPTURED_AT,
  },
  items: {
    requiredKeys: ['items', 'bag_tabs', 'bag_capacity', 'items_count'],
    gameBuild: GAME_BUILD,
    capturedAt: CAPTURED_AT,
  },
};
