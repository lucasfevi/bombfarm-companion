import type { AccountSection } from '@bombfarm/contracts';
import type { PacingGate } from './pacing.js';
import type { HttpTransport } from './request.js';
import { ROUTES, readSection, type SectionOutcome } from './routes.js';
import type { ConsentedSession } from './session.js';

/**
 * The client (LAR-09 client half). Holds no per-section state at all: every call walks `ROUTES`
 * fresh and returns a brand-new outcome map. A change between two cycles is reflected because
 * there is nothing here that could serve a stale value — the only place "last known good" exists
 * in this product is F3's `commit()`.
 */
export interface GameApiClient {
  readAllSections(
    session: ConsentedSession,
    transport: HttpTransport,
    gate: PacingGate,
  ): Promise<Record<AccountSection, SectionOutcome>>;
}

export function createGameApiClient(): GameApiClient {
  return {
    async readAllSections(session, transport, gate) {
      const result = {} as Record<AccountSection, SectionOutcome>;
      // The pacing gate is already the single-flight serializer; reading in a plain `for` loop
      // keeps this order deterministic and matches the gate's own strict-serial contract rather
      // than racing five parallel calls against it.
      for (const route of ROUTES) {
        result[route.section] = await readSection(session, transport, gate, route);
      }
      return result;
    },
  };
}
