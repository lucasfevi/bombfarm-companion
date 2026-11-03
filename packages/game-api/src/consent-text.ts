import type { AppLocale } from '@bombfarm/contracts';

/**
 * The versioned first-run disclosure. One constant, six clauses, each individually
 * assertable — this module is data, not JSX, because the acceptance criteria are about *what the
 * player is told*, and that must be assertable in a plain Node unit test (this repo's Vitest has
 * no jsdom anywhere — see `apps/desktop/renderer/app/consent-modal.tsx`, which binds to this text
 * and holds no logic of its own).
 *
 * Bumping a locale's `body` without bumping `CONSENT_TEXT_VERSION` is a test failure — a future change to what the player was told must not ride on an old agreement
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

export const CONSENT_TEXT_VERSION = 7;

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
        heading: 'Writes only when you tell it to.',
        text: 'Everything it shows is read. The writes it can make are a forge roll, equipping or ' +
          "unequipping an item, refunding and re-placing a hero's stat points, and burning items " +
          'for Forge Essence — from the Forge tab (its Deconstruct page included), the forge ' +
          'queue, and the Optimizer\'s Apply steps, only after you turn on "Let the app forge, ' +
          'equip and reset points" in Settings, and only after you confirm each run. Nothing ' +
          'else in it can change your account, your game client, or your progress.',
      },
      {
        heading: 'Your token stays put.',
        text: 'It is sent only to app.bombfarm.net — never to us, never to anyone else, never ' +
          'into a log.',
      },
      {
        heading: 'Keeps running in the background.',
        text: 'It starts with Windows and keeps running after you close its window, so your Live ' +
          'tab and your account stay current while you play. Look for its icon in the ' +
          'notification area: right-click it to quit, and turn off starting with Windows in ' +
          'Settings whenever you like. With "Restart Bomb Farm if it exits" turned on in ' +
          'Settings, it also asks Steam to start the game again when the game closes while the ' +
          'companion is running — so, left alone, it starts itself when you log in and brings ' +
          'your game back if it exits.',
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
          'stops the reads and disconnects from the game; to stop the companion entirely, quit ' +
          'it from its notification-area icon.',
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
        heading: 'Escreve só quando você manda.',
        text: 'Tudo o que ele mostra é leitura. As escritas que ele pode fazer são uma rolagem de ' +
          'forja, equipar ou desequipar um item, reembolsar e redistribuir os pontos de status ' +
          'de um herói, e queimar itens para obter Essência de Forja — pela aba Forja (inclusive ' +
          'a página Desconstruir), pela fila de forja e pelas etapas de Aplicar do Otimizador, só ' +
          'depois que você ligar "Deixar o app forjar, equipar e redistribuir pontos" nas ' +
          'Configurações, e só depois de confirmar cada execução. Nada mais nele pode alterar ' +
          'sua conta, o cliente do jogo ou seu progresso.',
      },
      {
        heading: 'Seu token não sai do lugar.',
        text: 'É enviado apenas para app.bombfarm.net — nunca para nós, nunca para terceiros, ' +
          'nunca para um log.',
      },
      {
        heading: 'Continua rodando em segundo plano.',
        text: 'Ele inicia junto com o Windows e continua rodando depois que você fecha a janela, ' +
          'para manter a aba Ao vivo e sua conta atualizadas enquanto você joga. Procure o ícone ' +
          'dele na área de notificação: clique com o botão direito para sair, e desative o início ' +
          'junto com o Windows nas Configurações quando quiser. Com "Reiniciar o Bomb Farm se ele ' +
          'fechar" ligado nas Configurações, ele também pede ao Steam para abrir o jogo de novo ' +
          'quando o jogo fecha enquanto o companion está rodando — ou seja, deixado sozinho, ele ' +
          'se inicia quando você entra no Windows e traz seu jogo de volta se ele fechar.',
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
          'quiser, o que interrompe as leituras e desconecta do jogo; para encerrar o companion ' +
          'por completo, saia pelo ícone na área de notificação.',
      },
    ],
    acceptLabel: 'Permitir',
    declineLabel: 'Agora não',
  },
} as const;

export function consentTextFor(locale: AppLocale): ConsentText {
  return CONSENT_TEXT[locale];
}
