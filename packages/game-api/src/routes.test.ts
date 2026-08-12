import { describe, expect, it } from 'vitest';
import type { AccountSection } from '@bombfarm/contracts';
import type { GrantedConsent } from './consent.js';
import { createPacingGate, type PacingClock } from './pacing.js';
import type { HttpResponse, HttpTransport } from './request.js';
import { ROUTES, readSection, type RouteDescriptor, type SectionFailureReason } from './routes.js';
import { SessionToken, grantSession } from './session.js';
import { loadFixtureJson, required } from './test-fixtures.js';

const bodies = loadFixtureJson('api-bodies.json');

function bodyFor(path: string): Record<string, unknown> {
  return required(bodies[path], `no fixture body for ${path}`);
}

function routeFor(path: RouteDescriptor['path']): RouteDescriptor {
  return required(
    ROUTES.find((r) => r.path === path),
    `no route descriptor for ${path}`,
  );
}

const GRANTED: GrantedConsent = { decision: 'granted', grantedAt: '2026-08-12T13:15:38.000Z', textVersion: 1 };
const session = grantSession(GRANTED, { accountId: '486', token: SessionToken.create('sentinel-routes-test') });

function createTestClock(): PacingClock {
  let time = 0;
  return {
    now: () => time,
    sleep: (ms: number) => {
      time += ms;
      return Promise.resolve();
    },
  };
}

function fixtureTransport(): HttpTransport {
  return (req) => {
    const body = bodies[req.path];
    return Promise.resolve({ status: 200, body: JSON.stringify(body ?? {}) });
  };
}

function fixedResponseTransport(response: HttpResponse): HttpTransport {
  return () => Promise.resolve(response);
}

function throwingTransport(message: string): HttpTransport {
  return () => Promise.reject(new Error(message));
}

describe('ROUTES — total, injective mapping over the five AccountSections', () => {
  it('has exactly five descriptors', () => {
    expect(ROUTES).toHaveLength(5);
  });

  it('covers every AccountSection exactly once — no section unserved, no route duplicated', () => {
    const expectedSections: AccountSection[] = ['account', 'heroes', 'skills', 'casa', 'items'];
    const actualSections = ROUTES.map((r) => r.section).sort();
    expect(actualSections).toEqual([...expectedSections].sort());

    const paths = ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('ROUTES — projections over the committed body (LAR-07 route half)', () => {
  it('/state (account) projects the whole body', () => {
    const body = bodyFor('/state');
    const projected = routeFor('/state').project(body);
    expect(projected).toBe(body);
  });

  it('/roster (heroes) projects .heroes', () => {
    const body = bodyFor('/roster');
    const projected = routeFor('/roster').project(body);
    expect(projected).toBe(body.heroes);
  });

  it('/skill/state (skills) projects the whole body', () => {
    const body = bodyFor('/skill/state');
    const projected = routeFor('/skill/state').project(body);
    expect(projected).toBe(body);
  });

  it('/rotation (casa) projects .casa', () => {
    const body = bodyFor('/rotation');
    const projected = routeFor('/rotation').project(body);
    expect(projected).toBe(body.casa);
  });

  it('/inventory (items) projects .items', () => {
    const body = bodyFor('/inventory');
    const projected = routeFor('/inventory').project(body);
    expect(projected).toBe(body.items);
  });
});

describe('readSection — the happy path, per route, over the committed fixture', () => {
  for (const route of ROUTES) {
    it(`${route.path} resolves ok with the projected body`, async () => {
      const gate = createPacingGate(createTestClock());
      const outcome = await readSection(session, fixtureTransport(), gate, route);
      expect(outcome.kind).toBe('ok');
    });
  }
});

describe('readSection — /roster with zero heroes is empty_roster, not an empty-but-valid section (spec edge case)', () => {
  it('produces failed/empty_roster', async () => {
    const rosterRoute = routeFor('/roster');
    const gate = createPacingGate(createTestClock());
    const transport = fixedResponseTransport({ status: 200, body: '{"heroes":[]}' });

    const outcome = await readSection(session, transport, gate, rosterRoute);

    expect(outcome).toEqual({ kind: 'failed', reason: 'empty_roster' });
  });
});

describe('readSection — every SectionFailureReason producible from routes.ts is reached by at least one path (LAR-25)', () => {
  const stateRoute = routeFor('/state');

  const cases: ReadonlyArray<{
    readonly label: string;
    readonly transport: HttpTransport;
    readonly expectedReason: SectionFailureReason;
  }> = [
    { label: '401', transport: fixedResponseTransport({ status: 401, body: '{}' }), expectedReason: 'unauthorized' },
    { label: '429', transport: fixedResponseTransport({ status: 429, body: '{}' }), expectedReason: 'cooldown' },
    { label: '404', transport: fixedResponseTransport({ status: 404, body: '{}' }), expectedReason: 'http_error' },
    { label: 'non-JSON 200', transport: fixedResponseTransport({ status: 200, body: 'not json' }), expectedReason: 'malformed_json' },
    {
      label: 'oversize body',
      transport: fixedResponseTransport({ status: 200, body: 'x'.repeat(2_100_000) }),
      expectedReason: 'too_large',
    },
    { label: 'a throwing transport', transport: throwingTransport('ECONNREFUSED'), expectedReason: 'transport_error' },
  ];

  for (const { label, transport, expectedReason } of cases) {
    it(`${label} -> failed/${expectedReason}`, async () => {
      const gate = createPacingGate(createTestClock());
      const outcome = await readSection(session, transport, gate, stateRoute);
      expect(outcome).toEqual({ kind: 'failed', reason: expectedReason });
    });
  }

  it('a shape-drifted 200 (missing a required key) -> drift, not failed', async () => {
    const gate = createPacingGate(createTestClock());
    const corrupted = Object.fromEntries(Object.entries(bodyFor('/state')).filter(([key]) => key !== 'gold'));
    const transport = fixedResponseTransport({ status: 200, body: JSON.stringify(corrupted) });

    const outcome = await readSection(session, transport, gate, stateRoute);

    expect(outcome.kind).toBe('drift');
    if (outcome.kind === 'drift') {
      expect(outcome.missingKeys).toContain('gold');
    }
  });

  it('empty_roster is reached via /roster with zero heroes (covered above); the 7th reachable reason', async () => {
    const rosterRoute = routeFor('/roster');
    const gate = createPacingGate(createTestClock());
    const outcome = await readSection(session, fixedResponseTransport({ status: 200, body: '{"heroes":[]}' }), gate, rosterRoute);
    expect(outcome).toEqual({ kind: 'failed', reason: 'empty_roster' });
  });

  it(
    'the remaining three SectionFailureReason members — not_consented, token_unavailable, aborted — are ' +
      'desktop-produced (apps/desktop/src/main/game-api/account-refresh.ts, session-token-file.ts, T8) and ' +
      'covered by T8s suite; they describe states that never reach a route, so routes.ts cannot be their producer',
    () => {
      const desktopProducedReasons: SectionFailureReason[] = ['not_consented', 'token_unavailable', 'aborted'];
      // Type-only proof these are still valid members of the union this module defines.
      for (const reason of desktopProducedReasons) {
        const outcome: { kind: 'failed'; reason: SectionFailureReason } = { kind: 'failed', reason };
        expect(outcome.reason).toBe(reason);
      }
    },
  );
});
