/**
 * A local stand-in for the whole Premium API, as the app consumes it, that remembers every
 * request it receives. Pointed at through `BFC_PREMIUM_API_ORIGIN`, so a spec can drive sign-in,
 * rotation, status, the game-account report, the hand-off and sign-out without any real host.
 *
 * The stub is stateful on purpose: a token stops working once it has been rotated, so a request
 * that still carries the old one is answered 401 and the app would sign out - a spec that
 * passes therefore proves the app switched to the rotated token.
 */
import crypto from 'node:crypto';
import http from 'node:http';

export const STUB_APPROVAL_URL = 'https://premium-stub.invalid/approve?request=stub-request';
export const STUB_HAND_OFF_URL = 'https://premium-stub.invalid/premium?handoff=stub-handoff';

const PATHS = {
  signInRequest: '/v1/auth/desktop/requests',
  token: '/v1/auth/desktop/token',
  rotate: '/v1/sessions/rotate',
  signOut: '/v1/sessions/sign-out',
  me: '/v1/me',
  report: '/v1/me/game-account',
  handOff: '/v1/auth/handoff',
  status: '/v1/premium/status',
  visibility: '/v1/premium/visibility',
};

export const STUB_PATHS = PATHS;

const DAY_MS = 86_400_000;

const NO_STATES = {
  awaitingPayment: null,
  grace: null,
  cancellationScheduled: null,
  paymentFailed: false,
  pendingFirstPayment: false,
  disputeHold: false,
  purchaseBlocked: false,
  regionBlocked: false,
};

export function inactiveStatusBody() {
  return { active: false, kinds: [], until: null, entitlements: [], states: NO_STATES };
}

export function graceStatusBody() {
  const now = Date.now();
  return {
    active: true,
    kinds: ['subscription'],
    until: new Date(now + 30 * DAY_MS).toISOString(),
    entitlements: [],
    states: { ...NO_STATES, grace: { until: new Date(now + 5 * DAY_MS).toISOString() } },
  };
}

function base64url(buffer) {
  return buffer.toString('base64url');
}

export async function startPremiumApiStub() {
  const requests = [];
  const unknown = [];
  const state = {
    visible: false,
    status: inactiveStatusBody(),
    code: 'stub-callback-code',
    firstToken: 'stub-session-token-first',
    rotatedToken: 'stub-session-token-rotated',
    validTokens: new Set(),
    challenge: null,
    firstRotateAfterInThePast: true,
  };

  function json(response, status, body) {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(body === undefined ? undefined : JSON.stringify(body));
  }

  function bearerOf(request) {
    const header = request.headers.authorization ?? '';
    return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  }

  function handle(request, response, text) {
    const url = new URL(request.url, 'http://127.0.0.1');
    let body = null;
    try {
      body = text === '' ? null : JSON.parse(text);
    } catch {
      body = null;
    }
    const bearer = bearerOf(request);
    const record = {
      method: request.method,
      path: url.pathname,
      bearer,
      text,
      body,
      host: request.headers.host,
      extra: {},
    };
    requests.push(record);

    const known = Object.values(PATHS).includes(url.pathname);
    if (!known) {
      unknown.push(`${request.method} ${url.pathname}`);
      json(response, 404, { reason: 'not_found' });
      return;
    }

    const needsBearer = [PATHS.rotate, PATHS.signOut, PATHS.me, PATHS.report, PATHS.handOff, PATHS.status];
    if (needsBearer.includes(url.pathname) && (bearer === null || !state.validTokens.has(bearer))) {
      json(response, 401, { reason: 'unauthorized' });
      return;
    }

    if (url.pathname === PATHS.visibility) {
      json(response, 200, { visible: state.visible });
    } else if (url.pathname === PATHS.signInRequest) {
      state.challenge = body?.codeChallenge ?? null;
      record.extra.method = body?.codeChallengeMethod;
      json(response, 201, {
        approvalUrl: STUB_APPROVAL_URL,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      });
    } else if (url.pathname === PATHS.token) {
      const verifierHash = base64url(crypto.createHash('sha256').update(String(body?.codeVerifier ?? '')).digest());
      record.extra.verifierMatchesChallenge = state.challenge !== null && verifierHash === state.challenge;
      if (body?.code !== state.code || !record.extra.verifierMatchesChallenge) {
        json(response, 400, { reason: 'invalid_grant' });
        return;
      }
      state.validTokens.add(state.firstToken);
      const rotateAfter = state.firstRotateAfterInThePast
        ? new Date(Date.now() - 60_000)
        : new Date(Date.now() + DAY_MS);
      json(response, 200, {
        token: state.firstToken,
        expiresAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
        rotateAfter: rotateAfter.toISOString(),
      });
    } else if (url.pathname === PATHS.rotate) {
      state.validTokens.delete(bearer);
      state.validTokens.add(state.rotatedToken);
      json(response, 200, {
        token: state.rotatedToken,
        expiresAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
        rotateAfter: new Date(Date.now() + 7 * DAY_MS).toISOString(),
      });
    } else if (url.pathname === PATHS.me) {
      json(response, 200, {
        v: 1,
        signInMethods: ['discord', 'steam'],
        steamVerified: true,
        gameAccountLinked: true,
        admitted: false,
      });
    } else if (url.pathname === PATHS.report) {
      json(response, 200, { outcome: 'linked' });
    } else if (url.pathname === PATHS.handOff) {
      json(response, 200, { url: STUB_HAND_OFF_URL, expiresAt: new Date(Date.now() + 60_000).toISOString() });
    } else if (url.pathname === PATHS.status) {
      json(response, 200, state.status);
    } else if (url.pathname === PATHS.signOut) {
      state.validTokens.delete(bearer);
      response.writeHead(204);
      response.end();
    }
  }

  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => handle(request, response, Buffer.concat(chunks).toString('utf8')));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    origin: `http://127.0.0.1:${port}`,
    state,
    requests,
    unknown,
    at: (pathname) => requests.filter((entry) => entry.path === pathname),
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
