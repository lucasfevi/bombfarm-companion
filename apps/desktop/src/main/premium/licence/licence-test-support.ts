import { generateKeyPairSync, sign } from 'node:crypto';
import type { PremiumLicenceView } from '@bombfarm/contracts';
import {
  ACTIVE_STATUS_BODY,
  ME_BODY,
  SECRETS,
  createFakeSubjectStore,
  createFakeVault,
  createHarness,
  session,
  settle,
  type FakeSubjectStore,
  type Harness,
  type RecordedRequest,
  type StubReply,
} from '../premium-test-support.js';
import type { PremiumPath } from '../premium-transport.js';
import { createLeaseGate, type LeaseGate } from './lease-gate.js';
import type { LeaseKeyTable, LeasePayload } from './lease-verify.js';
import { createLicenceService, type LicenceService } from './licence-runner.js';
import {
  type CleanupRecord,
  type DeviceRecord,
  type LeaseRecord,
  type LicenceStore,
  type WriteOutcome,
} from './licence-store.js';
import type { MachineIdentity } from './machine-id.js';
import { createDefaultRemovalPort, type PremiumRemovalPort, type PremiumRemovalReason } from './removal-port.js';

export const USER = 'user-subject-marker-0001';
export const OTHER_USER = 'user-subject-marker-0002';
export const MACHINE_GUID = 'machine-guid-marker-7c1d4e';
export const COMPUTER_NAME = 'LUCAS-DESKTOP';
export const SALT = Buffer.alloc(32, 7).toString('base64url');
export const DEVICE_ID = 'device-marker-0001';
export const PAIR = { accountId: SECRETS.accountId, steamId64: SECRETS.steamId64 };
export const MINUTE = 60_000;

/** A value a test has already established is there; fails the test loudly when it is not. */
export function present<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('expected a value to be present');
  return value;
}

const LEASE_KEY_ID = 'testkey1';
const leaseKeyPair = generateKeyPairSync('ed25519');

export function testLeaseKeys(): LeaseKeyTable {
  return new Map([[LEASE_KEY_ID, leaseKeyPair.publicKey]]);
}

export interface LeaseSpec {
  deviceKeyId: string;
  user?: string;
  state?: LeasePayload['state'];
  playing?: LeasePayload['playing'];
  until?: string | null;
  issuedAtMs: number;
  lifetimeMs?: number;
  holderName?: string;
}

export function signedLease(spec: LeaseSpec): { lease: string; sig: string; keyId: string } {
  const payload = {
    v: 1,
    user: spec.user ?? USER,
    deviceKeyId: spec.deviceKeyId,
    state: spec.state ?? 'active',
    playing: spec.playing === undefined ? PAIR : spec.playing,
    until: spec.until === undefined ? '2026-12-01T00:00:00.000Z' : spec.until,
    issuedAt: new Date(spec.issuedAtMs).toISOString(),
    expiresAt: new Date(spec.issuedAtMs + (spec.lifetimeMs ?? 60 * MINUTE)).toISOString(),
    minSequence: 0,
    ...(spec.holderName === undefined ? {} : { holderName: spec.holderName }),
  };
  const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  return {
    lease: bytes.toString('base64url'),
    sig: sign(null, bytes, leaseKeyPair.privateKey).toString('base64url'),
    keyId: LEASE_KEY_ID,
  };
}

/** The device key id a device-signed request names in its `BFC-Device` header. */
export function keyIdOf(request: RecordedRequest): string {
  const keyId = request.device?.split('.')[0];
  if (keyId === undefined) throw new Error('the request carries no device header');
  return keyId;
}

/** The unix seconds a device-signed request was stamped with. */
export function stampOf(request: RecordedRequest): number {
  return Number(request.device?.split('.')[1]);
}

export interface MemoryLicenceStore extends LicenceStore {
  deviceWrites: DeviceRecord[];
  leaseWrites: LeaseRecord[];
  cleanupWrites: CleanupRecord[];
  clearedDevices: string[];
  clearedCleanups: string[];
  subjects(): string[];
}

export function createMemoryLicenceStore(): MemoryLicenceStore {
  const devices = new Map<string, DeviceRecord>();
  const leases = new Map<string, LeaseRecord>();
  const cleanups = new Map<string, CleanupRecord>();
  const store: MemoryLicenceStore = {
    deviceWrites: [],
    leaseWrites: [],
    cleanupWrites: [],
    clearedDevices: [],
    clearedCleanups: [],
    subjects: () => [...devices.keys()],
    readDevice: (subject) => devices.get(subject) ?? null,
    writeDevice(subject, record): WriteOutcome {
      store.deviceWrites.push(record);
      devices.set(subject, record);
      return 'written';
    },
    clearDevice(subject) {
      store.clearedDevices.push(subject);
      devices.delete(subject);
    },
    readLease: (subject) => leases.get(subject) ?? null,
    writeLease(subject, record): WriteOutcome {
      store.leaseWrites.push(record);
      leases.set(subject, record);
      return 'written';
    },
    clearLease: (subject) => {
      leases.delete(subject);
    },
    readCleanup: (subject) => cleanups.get(subject) ?? null,
    writeCleanup(subject, record): WriteOutcome {
      store.cleanupWrites.push(record);
      cleanups.set(subject, record);
      return 'written';
    },
    clearCleanup(subject) {
      store.clearedCleanups.push(subject);
      cleanups.delete(subject);
    },
  };
  return store;
}

export function createFakeIdentity(guid: string | null = MACHINE_GUID): MachineIdentity & { guid: string | null; reads: number } {
  const identity = {
    guid,
    reads: 0,
    machineGuid() {
      identity.reads += 1;
      return Promise.resolve(identity.guid);
    },
    computerName: () => COMPUTER_NAME,
  };
  return identity;
}

export interface StubRemovalPort extends PremiumRemovalPort {
  requests: PremiumRemovalReason[];
  sequence: number | null;
  /** Every value handed over by noteLatestSequence, in order. */
  latest: (number | null)[];
  /** The premium host answers that its folder is gone. */
  answerGone(): void;
}

/** A port whose "gone" answer the test gives by hand. */
export function createStubRemovalPort(): StubRemovalPort {
  let noteFolderGone: (() => void) | null = null;
  const port: StubRemovalPort = {
    requests: [],
    sequence: null,
    latest: [],
    requestPremiumRemoval(reason) {
      port.requests.push(reason);
    },
    runningSequence: () => port.sequence,
    noteLatestSequence(sequence) {
      port.latest.push(sequence);
    },
    attach(next) {
      noteFolderGone = next;
    },
    answerGone() {
      noteFolderGone?.();
    },
  };
  return port;
}

export interface LicenceHarnessOptions {
  /** The subject sealed beside the session before the run starts (a restart). Default: none. */
  sealedSubject?: string | null;
  removal?: 'stub' | 'default';
  guid?: string | null;
  /** The Premium surface is on for the flavour. Default: true. */
  enabled?: boolean;
}

export interface LicenceHarness {
  premium: Harness;
  store: MemoryLicenceStore;
  subjects: FakeSubjectStore;
  gate: LeaseGate;
  identity: ReturnType<typeof createFakeIdentity>;
  removal: StubRemovalPort | PremiumRemovalPort;
  stubRemoval: StubRemovalPort | null;
  secure: { value: boolean };
  views: PremiumLicenceView[];
  licence: LicenceService;
  /** Every request to a licence route, in order. */
  licenceRequests(): RecordedRequest[];
  /** A signed Lease for the device that sent `request`, issued now. */
  lease(request: RecordedRequest, spec?: Partial<LeaseSpec>): StubReply;
  /** The Lease answer for `request` on the activation route, which also carries the device id. */
  activation(request: RecordedRequest, spec?: Partial<LeaseSpec>, latestSequence?: number | null): StubReply;
  /** Answers every licence route as a healthy, active holder would. */
  scriptHolder(): void;
  /** Starts the Premium service, then the licence service, and lets both settle. */
  boot(): Promise<void>;
  /** Replaces the licence service with a new one over the same sealed records, as a restart does. */
  restart(): Promise<void>;
  gateHistory: Array<[boolean, string]>;
}

export const LICENCE_PATHS: readonly PremiumPath[] = ['licence', 'licenceActivate', 'lease', 'licenceCleanup'];

export function createLicenceHarness(options: LicenceHarnessOptions = {}): LicenceHarness {
  const subjects = createFakeSubjectStore(options.sealedSubject ?? null);
  const premium = createHarness({ vault: createFakeVault(session(SECRETS.token)), subjects });
  const store = createMemoryLicenceStore();
  const identity = createFakeIdentity(options.guid === undefined ? MACHINE_GUID : options.guid);
  const secure = { value: true };
  const views: PremiumLicenceView[] = [];
  const gateHistory: Array<[boolean, string]> = [];
  const stubRemoval = options.removal === 'default' ? null : createStubRemovalPort();
  const removal: StubRemovalPort | PremiumRemovalPort = stubRemoval ?? createDefaultRemovalPort();
  let gate = createLeaseGate();

  function build(): LicenceService {
    gate = createLeaseGate();
    gate.subscribe((allows, state) => gateHistory.push([allows, state]));
    return createLicenceService({
      host: premium.service.host,
      api: premium.api,
      store,
      secureStorage: () => secure.value,
      identity,
      removal,
      account: premium.playing,
      now: () => premium.clock.now(),
      mono: () => premium.clock.mono(),
      scheduler: premium.clock.scheduler,
      log: premium.log,
      appVersion: '9.9.9',
      flavor: 'dev',
      enabled: options.enabled ?? true,
      onChanged: (view) => {
        views.push(view);
      },
      gate,
      keys: testLeaseKeys(),
    });
  }

  const harness: LicenceHarness = {
    premium,
    store,
    subjects,
    get gate() {
      return gate;
    },
    identity,
    removal,
    stubRemoval,
    secure,
    views,
    gateHistory,
    licence: build(),
    licenceRequests: () => premium.stub.requests.filter((request) => LICENCE_PATHS.includes(request.path)),
    lease(request, spec = {}) {
      return {
        status: 200,
        body: signedLease({ deviceKeyId: keyIdOf(request), issuedAtMs: premium.clock.now(), ...spec }),
      };
    },
    activation(request, spec = {}, latestSequence = null) {
      const reply = harness.lease(request, spec);
      return { ...reply, body: { ...(reply.body as object), deviceId: DEVICE_ID, bundle: { latestSequence } } };
    },
    scriptHolder() {
      premium.stub.on('status', { status: 200, body: ACTIVE_STATUS_BODY });
      premium.stub.on('me', { status: 200, body: { ...ME_BODY, userId: USER } });
      premium.stub.on('licence', { status: 200, body: { fingerprintSalt: SALT } });
      premium.stub.on('licenceActivate', (request) => harness.activation(request));
      premium.stub.on('lease', (request) => harness.lease(request));
      premium.stub.on('licenceCleanup', { status: 200, body: { cleanup: 'confirmed' } });
    },
    async boot() {
      premium.service.start();
      harness.licence.start();
      await settle();
    },
    async restart() {
      harness.licence.stop();
      harness.licence = build();
      harness.licence.start();
      await settle();
    },
  };
  return harness;
}
