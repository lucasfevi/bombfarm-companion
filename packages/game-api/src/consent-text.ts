/**
 * The versioned first-run disclosure. One constant, seven clauses, each individually
 * assertable — this module is data, not JSX, because the acceptance criteria are about *what the
 * player is told*, and that must be assertable in a plain Node unit test (this repo's Vitest has
 * no jsdom anywhere — see `apps/desktop/renderer/app/consent-modal.tsx`, which binds to this text
 * and holds no logic of its own).
 *
 * Bumping `body` without bumping `version` is a test failure (T1 Done-when) — a future change to
 * what the player was told must not ride on an old agreement (`shouldShowConsentModal`).
 */
export interface ConsentText {
  readonly version: number;
  readonly title: string;
  readonly body: readonly string[];
  readonly acceptLabel: string;
  readonly declineLabel: string;
}

export const CONSENT_TEXT: ConsentText = {
  version: 2,
  title: 'Read your Bomb Farm account and attach to the game?',
  body: [
    "What: the companion reads your account two ways. It calls the game's own server using the " +
      'session token the game itself already saves on your machine, and it attaches to the ' +
      'running game client to observe the data that client is already exchanging with that server.',
    'Where: that token is sent only to api.bombfarm.net, and nowhere else. It is never sent to us ' +
      'or anyone else, and it never appears in logs or diagnostics.',
    'Attaching: the companion observes the traffic the game client is already sending and ' +
      'receiving. It sends nothing of its own to the game or the server, it does not modify the ' +
      'game client, and it does not modify your game state.',
    'Read-only: the companion only reads your account. It changes nothing, and it has no code ' +
      'path that writes to your account at all.',
    'Antivirus: your antivirus may flag or quarantine the companion, because attaching to another ' +
      'running program is the technique behavior-based detection is built to look for. The ' +
      'warning is about that technique, not about a virus.',
    "Account risk: attaching is detectable in principle. If the game's operator ever acts on it, " +
      'the consequence lands on your account rather than on us. Allow this only if you are ' +
      'willing to carry that risk.',
    'Reversible: you can turn this off later, at any time. Turning it off stops the reads and ' +
      'detaches from the game client.',
  ],
  acceptLabel: 'Allow',
  declineLabel: 'Not now',
} as const;
