import type { AppLocale } from '@bombfarm/contracts';

/**
 * The versioned first-run disclosure. One constant, five clauses, each individually
 * assertable — this module is data, not JSX, because the acceptance criteria are about *what the
 * player is told*, and that must be assertable in a plain Node unit test (this repo's Vitest has
 * no jsdom anywhere — see `apps/desktop/renderer/app/consent-modal.tsx`, which binds to this text
 * and holds no logic of its own).
 *
 * Bumping a locale's `body` without bumping `CONSENT_TEXT_VERSION` is a test failure (T1
 * Done-when) — a future change to what the player was told must not ride on an old agreement
 * (`shouldShowConsentModal`).
 */
export interface ConsentClause {
  readonly heading: string;
  readonly text: string;
}

export interface ConsentText {
  readonly version: number;
  readonly title: string;
  readonly body: readonly ConsentClause[];
  readonly acceptLabel: string;
  readonly declineLabel: string;
}

export const CONSENT_TEXT_VERSION = 2;

export const CONSENT_TEXT: Readonly<Record<AppLocale, ConsentText>> = {
  en: {
    version: CONSENT_TEXT_VERSION,
    title: 'What the companion does with your account and your game',
    body: [
      {
        heading: 'Reads your account.',
        text: "Two ways: it calls the game's own server with the session token the game already " +
          'saves on your machine, and it attaches to the running game client to read the traffic ' +
          'that client is already exchanging with that server.',
      },
      {
        heading: 'Never writes.',
        text: 'It only reads: it sends nothing of its own to the game or the server, and nothing ' +
          'in it can change your account, your game client, or your progress.',
      },
      {
        heading: 'Your token stays put.',
        text: 'It is sent only to api.bombfarm.net — never to us, never to anyone else, never ' +
          'into a log.',
      },
      {
        heading: 'Antivirus may flag or quarantine it.',
        text: 'Attaching to another running program is the technique behavior-based detection ' +
          'looks for, so a warning is expected — it is about the technique, not a virus.',
      },
      {
        heading: 'The risk is yours.',
        text: "Attaching is detectable in principle, and if the game's operator acts on it the " +
          'consequence falls on your account, not on us. You can turn it off at any time, which ' +
          'stops the reads and disconnects from the game.',
      },
    ],
    acceptLabel: 'Allow',
    declineLabel: 'Not now',
  },
  'pt-BR': {
    version: CONSENT_TEXT_VERSION,
    title: 'O que o companion faz com sua conta e com seu jogo',
    body: [
      {
        heading: 'Lê sua conta.',
        text: 'De duas formas: chamando o servidor do próprio jogo com o token de sessão que o ' +
          'jogo já salva no seu computador, e conectando-se ao cliente do jogo em execução para ' +
          'ler o tráfego que esse cliente já troca com esse servidor.',
      },
      {
        heading: 'Nunca escreve.',
        text: 'Ele apenas lê: não envia nada de si mesmo ao jogo nem ao servidor, e nada nele ' +
          'pode alterar sua conta, o cliente do jogo ou seu progresso.',
      },
      {
        heading: 'Seu token não sai do lugar.',
        text: 'É enviado apenas para api.bombfarm.net — nunca para nós, nunca para terceiros, ' +
          'nunca para um log.',
      },
      {
        heading: 'O antivírus pode sinalizar ou colocar em quarentena.',
        text: 'Conectar-se a outro programa em execução é a técnica que a detecção por ' +
          'comportamento procura, então um aviso é esperado — ele é sobre a técnica, não sobre ' +
          'um vírus.',
      },
      {
        heading: 'O risco é seu.',
        text: 'Isso é detectável em princípio, e se o operador do jogo agir sobre isso a ' +
          'consequência recai sobre a sua conta, não sobre nós. Você pode desativar quando ' +
          'quiser, o que interrompe as leituras e desconecta do jogo.',
      },
    ],
    acceptLabel: 'Permitir',
    declineLabel: 'Agora não',
  },
} as const;

export function consentTextFor(locale: AppLocale): ConsentText {
  return CONSENT_TEXT[locale];
}
