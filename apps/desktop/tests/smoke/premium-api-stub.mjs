/**
 * A local stand-in for the whole Premium API, as the app consumes it, that remembers every
 * request it receives. Pointed at through `BFC_PREMIUM_API_ORIGIN`, so a spec can drive sign-in,
 * rotation, status, the game-account report, the hand-off and sign-out without any real host.
 *
 * The stub is stateful on purpose: a token stops working once it has been rotated, so a request
 * that still carries the old one is answered 401 and the app would sign out - a spec that
 * passes therefore proves the app switched to the rotated token.
 *
 * Given a `licence` option it also plays the licence and bundle routes: the fingerprint salt,
 * activation, renewal, the cleanup report, the manifest and each bundle file. Leases are signed
 * with the public test Lease key the dev flavour trusts, and every device-signed request has its
 * signature checked the way the API checks it, so a spec can show the app signed what it sent.
 */
import crypto from 'node:crypto';
import http from 'node:http';
import { TEST_LEASE_KEYPAIR } from '../fixtures/premium/keys.mjs';

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
  licence: '/v1/premium/licence',
  licenceActivate: '/v1/premium/licence/activate',
  lease: '/v1/premium/lease',
  licenceCleanup: '/v1/premium/licence/cleanup',
  bundle: '/v1/premium/bundle',
};

export const STUB_PATHS = PATHS;

/** The routes that exist only when the stub plays the licence. */
const LICENCE_ROUTES = ['licence', 'licenceActivate', 'lease', 'licenceCleanup', 'bundle'];
const BUNDLE_FILE = /^\/v1\/premium\/bundle\/(\d+)\/files\/(.+)$/;

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const FINGERPRINT_SALT = Buffer.alloc(32, 9).toString('base64url');

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

export function activeStatusBody() {
  return {
    active: true,
    kinds: ['subscription'],
    until: new Date(Date.now() + 30 * DAY_MS).toISOString(),
    entitlements: [],
    states: NO_STATES,
  };
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

/** The Lease key the app trusts in its dev flavour only. */
const leaseKey = crypto.createPrivateKey({
  key: { kty: 'OKP', crv: 'Ed25519', x: TEST_LEASE_KEYPAIR.x, d: TEST_LEASE_KEYPAIR.d },
  format: 'jwk',
});

/** The public half of a device key, from the raw base64url the app sends at activation. */
function devicePublicKey(raw) {
  return crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: raw }, format: 'jwk' });
}

function safeDeviceKey(raw) {
  try {
    return typeof raw === 'string' ? devicePublicKey(raw) : null;
  } catch {
    return null;
  }
}

function deviceKeyIdOf(request) {
  return String(request.headers['bfc-device'] ?? '').split('.')[0];
}

/**
 * @param {object} [options]
 * @param {{ userId: string, playing: { accountId: string, steamId64: string } | null }} [options.licence]
 *   When given, `/v1/me` names the user and the licence and bundle routes are served. Without it
 *   those paths are unknown, as they were before the licence existed.
 */
export async function startPremiumApiStub(options = {}) {
  const licence = options.licence ?? null;
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
    /** Report answers by the SteamID reported; any other SteamID is answered linked. */
    reportReplies: {},
    /** The Lease state handed out from now on: active, moved, released or ended. */
    leaseState: 'active',
    /** The Lease floor handed out from now on. */
    minSequence: 0,
    /** Signed fixtures by sequence, and the sequence the manifest route offers. */
    bundles: new Map(),
    offered: null,
    /** Called when a cleanup report arrives; its answer is kept on the request record as `extra.probe`. */
    cleanupProbe: null,
    /** Device public keys by key id, learned at activation. */
    devices: new Map(),
  };

  /** Makes this signed fixture the newest bundle on offer; returns its sequence. */
  function publishBundle(signed) {
    const { sequence } = JSON.parse(Buffer.from(signed.manifestBytes).toString('utf8'));
    state.bundles.set(sequence, signed);
    state.offered = sequence;
    return sequence;
  }

  function json(response, status, body) {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(body === undefined ? undefined : JSON.stringify(body));
  }

  function bearerOf(request) {
    const header = request.headers.authorization ?? '';
    return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  }

  /** True when `BFC-Device` is `<keyId>.<unix s>.<signature>` over the request as the API rebuilds it. */
  function verifyDevice(request, pathname, text, body) {
    const [keyId, stamp, signature] = String(request.headers['bfc-device'] ?? '').split('.');
    if (!keyId || !stamp || !signature) return false;
    const key = pathname === PATHS.licenceActivate ? safeDeviceKey(body?.publicKey) : state.devices.get(keyId);
    if (!key) return false;
    const digest = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
    const message = `${request.method}\n${pathname}\n${stamp}\n${digest}`;
    return crypto.verify(null, Buffer.from(message, 'utf8'), key, Buffer.from(signature, 'base64url'));
  }

  /** A Lease for the device that asked, signed with the test Lease key, as the app verifies it. */
  function leaseFor(request, body) {
    const issuedAt = Date.now();
    const payload = {
      v: 1,
      user: licence.userId,
      deviceKeyId: deviceKeyIdOf(request),
      state: state.leaseState,
      playing: body?.playing ?? licence.playing ?? null,
      until: new Date(issuedAt + 30 * DAY_MS).toISOString(),
      issuedAt: new Date(issuedAt).toISOString(),
      expiresAt: new Date(issuedAt + 60 * MINUTE_MS).toISOString(),
      minSequence: state.minSequence,
      ...(state.leaseState === 'moved' ? { holderName: 'OTHER-PC' } : {}),
    };
    const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
    return {
      lease: base64url(bytes),
      sig: base64url(crypto.sign(null, bytes, leaseKey)),
      keyId: TEST_LEASE_KEYPAIR.keyId,
    };
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
      device: request.headers['bfc-device'] ?? null,
      /** True when the request carried a device signature that verified. */
      deviceSigned: false,
      extra: {},
    };
    requests.push(record);

    const fileMatch = licence === null ? null : BUNDLE_FILE.exec(url.pathname);
    const known =
      fileMatch !== null ||
      Object.entries(PATHS).some(
        ([name, path]) => path === url.pathname && (licence !== null || !LICENCE_ROUTES.includes(name)),
      );
    if (!known) {
      unknown.push(`${request.method} ${url.pathname}`);
      json(response, 404, { reason: 'not_found' });
      return;
    }

    const needsBearer = [
      PATHS.rotate,
      PATHS.signOut,
      PATHS.me,
      PATHS.report,
      PATHS.handOff,
      PATHS.status,
      ...LICENCE_ROUTES.map((name) => PATHS[name]),
    ];
    if ((needsBearer.includes(url.pathname) || fileMatch !== null) && (bearer === null || !state.validTokens.has(bearer))) {
      json(response, 401, { reason: 'unauthorized' });
      return;
    }

    const deviceSigned = [PATHS.licenceActivate, PATHS.lease, PATHS.licenceCleanup, PATHS.bundle].includes(url.pathname);
    if (licence !== null && (deviceSigned || fileMatch !== null)) {
      record.deviceSigned = verifyDevice(request, url.pathname, text, body);
      if (!record.deviceSigned) {
        json(response, 401, { reason: 'device_signature' });
        return;
      }
    }

    if (url.pathname === PATHS.licence) {
      json(response, 200, { premiumActive: true, holder: null, fingerprintSalt: FINGERPRINT_SALT });
    } else if (url.pathname === PATHS.licenceActivate) {
      state.devices.set(deviceKeyIdOf(request), devicePublicKey(body.publicKey));
      json(response, 200, {
        ...leaseFor(request, body),
        deviceId: 'stub-device-0001',
        bundle: { latestSequence: state.offered },
      });
    } else if (url.pathname === PATHS.lease) {
      json(response, 200, { ...leaseFor(request, body), bundle: { latestSequence: state.offered } });
    } else if (url.pathname === PATHS.licenceCleanup) {
      // What the spec wants to know at the moment the report arrives (is the folder already gone?).
      record.extra.probe = state.cleanupProbe === null ? null : state.cleanupProbe();
      json(response, 200, { cleanup: 'confirmed' });
    } else if (url.pathname === PATHS.bundle) {
      const signed = state.offered === null ? undefined : state.bundles.get(state.offered);
      if (signed === undefined) {
        json(response, 404, { reason: 'none' });
        return;
      }
      json(response, 200, {
        sequence: state.offered,
        manifest: Buffer.from(signed.manifestBytes).toString('base64'),
        signature: base64url(Buffer.from(signed.sig)),
        files: [],
      });
    } else if (fileMatch !== null) {
      const bytes = state.bundles.get(Number(fileMatch[1]))?.files.get(fileMatch[2]);
      if (bytes === undefined) {
        json(response, 404, { reason: 'not_found' });
        return;
      }
      response.writeHead(200, { 'content-type': 'application/octet-stream' });
      response.end(Buffer.from(bytes));
    } else if (url.pathname === PATHS.visibility) {
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
        ...(licence === null ? {} : { userId: licence.userId }),
      });
    } else if (url.pathname === PATHS.report) {
      const reply = state.reportReplies[body?.steam_id64];
      if (reply === undefined) json(response, 200, { outcome: 'linked' });
      else json(response, reply.status, reply.body);
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
    publishBundle,
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
