export { CONSENT_TEXT } from './consent-text.js';
export type { ConsentText } from './consent-text.js';
export {
  initialConsent,
  isGranted,
  reduceConsent,
  shouldShowConsentModal,
} from './consent.js';
export type { ConsentDecision, ConsentEvent, ConsentRecord, GrantedConsent } from './consent.js';
export { ConsentRequiredError, SessionToken, grantSession } from './session.js';
export type { ConsentedSession } from './session.js';
export { parseSessionCfg } from './session-cfg.js';
export type { SessionCfgParseReason, SessionCfgParseResult } from './session-cfg.js';
