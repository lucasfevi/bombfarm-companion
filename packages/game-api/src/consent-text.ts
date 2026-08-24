import type { AppLocale } from '@bombfarm/contracts';

/**
 * The versioned first-run disclosure. One constant, seven clauses, each individually
 * assertable — this module is data, not JSX, because the acceptance criteria are about *what the
 * player is told*, and that must be assertable in a plain Node unit test (this repo's Vitest has
 * no jsdom anywhere — see `apps/desktop/renderer/app/consent-modal.tsx`, which binds to this text
 * and holds no logic of its own).
 *
 * Bumping a locale's `body` without bumping `CONSENT_TEXT_VERSION` is a test failure (T1
 * Done-when) — a future change to what the player was told must not ride on an old agreement
 * (`shouldShowConsentModal`).
 */
export interface ConsentText {
  readonly version: number;
  readonly title: string;
  readonly body: readonly string[];
  readonly acceptLabel: string;
  readonly declineLabel: string;
}

export const CONSENT_TEXT_VERSION = 2;

export const CONSENT_TEXT: Readonly<Record<AppLocale, ConsentText>> = {
  en: {
    version: CONSENT_TEXT_VERSION,
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
  },
  'pt-BR': {
    version: CONSENT_TEXT_VERSION,
    title: 'Ler sua conta do Bomb Farm e conectar ao jogo?',
    body: [
      'O que: o companion lê sua conta de duas formas. Ele chama o servidor do próprio jogo usando ' +
        'o token de sessão que o próprio jogo já salva no seu computador, e se conecta ao programa ' +
        'do jogo em execução para observar os dados que esse programa já troca com esse servidor.',
      'Para onde: esse token é enviado somente para api.bombfarm.net, e para mais nenhum lugar. Ele ' +
        'nunca é enviado para nós nem para terceiros, e nunca aparece em logs ou diagnósticos.',
      'Conexão ao jogo: o companion observa o tráfego que o programa do jogo já envia e recebe. Ele ' +
        'não envia nada por conta própria ao jogo nem ao servidor, não modifica o programa do jogo ' +
        'e não modifica o estado da sua partida.',
      'Somente leitura: o companion apenas lê sua conta. Ele não altera nada, e não existe nenhum ' +
        'caminho no código que escreva na sua conta.',
      'Antivírus: seu antivírus pode sinalizar ou colocar o companion em quarentena, porque ' +
        'conectar-se a outro programa em execução é justamente a técnica que a detecção por ' +
        'comportamento procura. O aviso é sobre essa técnica, não sobre um vírus.',
      'Risco para a conta: essa conexão é detectável em princípio. Se o operador do jogo agir sobre ' +
        'isso, a consequência recai sobre a sua conta, não sobre nós. Permita apenas se você ' +
        'estiver disposto a assumir esse risco.',
      'Reversível: você pode desativar isso depois, a qualquer momento. Ao desativar, as leituras ' +
        'param e a conexão com o programa do jogo é encerrada.',
    ],
    acceptLabel: 'Permitir',
    declineLabel: 'Agora não',
  },
} as const;

export function consentTextFor(locale: AppLocale): ConsentText {
  return CONSENT_TEXT[locale];
}
