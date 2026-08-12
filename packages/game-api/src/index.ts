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
export { ROUTE_FINGERPRINTS } from './fingerprints.js';
export type { RouteFingerprint } from './fingerprints.js';
export { checkShape } from './shape.js';
export type { ShapeCheckResult } from './shape.js';
export { ROUTES, readSection } from './routes.js';
export type { RouteDescriptor, SectionFailureReason, SectionOutcome } from './routes.js';
export { createGameApiClient } from './client.js';
export type { GameApiClient } from './client.js';
export { assembleAccountPayload } from './assemble.js';

