/**
 * The versioned first-run disclosure (LAR-02). One constant, five clauses, each individually
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
  version: 1,
  title: 'Read your Bomb Farm account?',
  body: [
    'What: the companion uses the session token the game itself already saves on your machine — ' +
      'the same credential Bomb Farm uses when it talks to its own server.',
    'Where: that token is sent only to api.bombfarm.net, and nowhere else. It is never sent to us ' +
      'or anyone else, and it never appears in logs or diagnostics.',
    'Read-only: the companion only reads your account. It changes nothing.',
    'No surprises: no disruptive action is taken without your approval. Any future change to your ' +
      'account will be one you ask for.',
    'Reversible: you can turn this off later, at any time.',
  ],
  acceptLabel: 'Allow',
  declineLabel: 'Not now',
} as const;
