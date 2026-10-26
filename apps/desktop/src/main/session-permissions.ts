import type { Session, WebContents } from 'electron';
import { trustedOriginKeyOf } from './ipc-sender-policy.js';
import type { LogPort } from './storage/index.js';

/** Everything the renderer is allowed to ask the browser for. Anything not named here is refused,
 *  so a permission a new feature needs is a line added here and a test that proves the feature. */
export const GRANTED_PERMISSIONS: ReadonlySet<string> = new Set<string>(['clipboard-sanitized-write']);

export interface PermissionQuery {
  readonly permission: string;
  readonly requestingUrl: string;
  readonly isMainFrame: boolean | undefined;
}

export function decidePermission(query: PermissionQuery, trustedOrigins: ReadonlySet<string>): boolean {
  if (query.isMainFrame === false || !GRANTED_PERMISSIONS.has(query.permission)) {
    return false;
  }
  const origin = trustedOriginKeyOf(query.requestingUrl);
  return origin !== null && trustedOrigins.has(origin);
}

export interface SessionPermissionDeps {
  trustedOrigins: ReadonlySet<string>;
  log: LogPort;
}

function logDenied(log: LogPort, query: PermissionQuery, via: string): void {
  log.warn({
    scope: 'main',
    event: 'permission.denied',
    via,
    permission: query.permission,
    origin: trustedOriginKeyOf(query.requestingUrl) ?? 'untrusted',
  });
}

const CANCEL_SELECTION = '';

export function applySessionPermissionPolicy(session: Session, deps: SessionPermissionDeps): void {
  const { trustedOrigins, log } = deps;

  session.setPermissionRequestHandler((_contents, permission, callback, details) => {
    const query = { permission, requestingUrl: details.requestingUrl, isMainFrame: details.isMainFrame };
    const granted = decidePermission(query, trustedOrigins);
    if (!granted) {
      logDenied(log, query, 'request');
    }
    callback(granted);
  });

  session.setPermissionCheckHandler((_contents, permission, requestingOrigin, details) => {
    const query = { permission, requestingUrl: requestingOrigin, isMainFrame: details.isMainFrame };
    const granted = decidePermission(query, trustedOrigins);
    if (!granted) {
      logDenied(log, query, 'check');
    }
    return granted;
  });

  session.setDevicePermissionHandler(() => false);
  session.setBluetoothPairingHandler((_details, callback) => {
    callback({ confirmed: false });
  });
  session.on('select-hid-device', (event, _details, callback) => {
    event.preventDefault();
    callback(null);
  });
  session.on('select-usb-device', (event, _details, callback) => {
    event.preventDefault();
    callback();
  });
  session.on('select-serial-port', (event, _ports, _contents, callback) => {
    event.preventDefault();
    callback(CANCEL_SELECTION);
  });
}

/** `select-bluetooth-device` is raised on the page's `WebContents`, not on its session, so it is
 *  attached to each one as it is created. */
export function cancelBluetoothSelection(contents: Pick<WebContents, 'on'>): void {
  contents.on('select-bluetooth-device', (event, _devices, callback) => {
    event.preventDefault();
    callback(CANCEL_SELECTION);
  });
}
