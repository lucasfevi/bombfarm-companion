/**
 * The maintainer's in-game referral code, surfaced by both apps: the web planner's topbar chip,
 * footer line and first-run notice, and the desktop app's top bar and Settings.
 *
 * Both sides receive a reward once the invited player clears stage 151, so the copy states the
 * mutual benefit rather than presenting it as a one-way favour.
 *
 * It lives here, rather than once per app, because it is a value that changes: a code shown by one
 * surface after the other was updated is a dead code the player pastes and loses the reward on.
 * Update here — every surface in both apps reads this constant.
 */
export const REFERRAL_CODE = 'F-X7BTKJPP';
