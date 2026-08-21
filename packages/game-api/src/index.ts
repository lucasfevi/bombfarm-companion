export { CONSENT_TEXT } from './consent-text.js';
export type { ConsentText } from './consent-text.js';
export {
  initialConsent,
  isGranted,
  reduceConsent,
  shouldShowConsentModal,
} from './consent.js';
export type { ConsentDecision, ConsentEvent, ConsentRecord, GrantedConsent } from './consent.js';
export { ConsentRequiredError, ConsentedSessionRequiredError, SessionToken, grantSession } from './session.js';
export type { ConsentedSession } from './session.js';
export { parseSessionCfg } from './session-cfg.js';
export type { SessionCfgParseReason, SessionCfgParseResult } from './session-cfg.js';
export { requestGet } from './request.js';
export type { HttpRequest, HttpResponse, HttpTransport, RequestOptions, RequestOutcome } from './request.js';
export { PacingHaltedError, PacingRefusedError, READ_PACING, createPacingGate } from './pacing.js';
export type { PacingClock, PacingGate, PacingState } from './pacing.js';
export { ROUTE_FINGERPRINTS, SECTION_FINGERPRINTS, checkSectionShape } from './fingerprints.js';
export type { RouteFingerprint, SectionFingerprint } from './fingerprints.js';
export { checkShape } from './shape.js';
export type { ShapeCheckResult } from './shape.js';
export { ROUTES, readSection } from './routes.js';
export type { RouteDescriptor, SectionFailureReason, SectionOutcome } from './routes.js';
export { createGameApiClient } from './client.js';
export type { GameApiClient } from './client.js';
export { assembleAccountPayload } from './assemble.js';
export {
  PORTUGUESE_WIRE_TOKENS,
  ROTATION_WIRE_LEXICON,
  renderWireGlossary,
  stateSymbolForToken,
  wireKey,
} from './rotation/lexicon.js';
export type { RotationStateSymbol, RotationWireSymbol, WireLexiconEntry, WireVocabularyKind, WireVocabularyOrigin } from './rotation/lexicon.js';
export { normalizeRotation } from './rotation/normalize.js';
// vocabulary-guard.ts is not re-exported here: nothing outside this package needs it — only its
// own test does, and that test imports it directly by relative path (see
// rotation/vocabulary-guard.test.ts). It no longer reaches `node:fs`; the filesystem walk that
// used to live here now lives in that test file instead.

