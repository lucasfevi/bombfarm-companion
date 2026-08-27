/**
 * First-run flag for the referral notice. Chrome state, so it uses the `bf_` namespace of
 * `bf_guide_hidden` / `bf_lang` rather than the `bf-hp-*` one that holds planner data.
 *
 * A store that cannot be read counts as hidden: a dismissal could not be persisted there
 * either, and a notice that returns on every single load is worse than one never shown.
 */
export const REFERRAL_NOTICE_HIDDEN_KEY = 'bf_referral_notice_hidden';

export function readReferralNoticeHidden(): boolean {
  try {
    return localStorage.getItem(REFERRAL_NOTICE_HIDDEN_KEY) === '1';
  } catch {
    return true;
  }
}

export function writeReferralNoticeHidden(): void {
  try {
    localStorage.setItem(REFERRAL_NOTICE_HIDDEN_KEY, '1');
  } catch {
    /* private mode */
  }
}
