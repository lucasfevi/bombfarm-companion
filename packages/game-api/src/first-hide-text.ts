import type { AppLocale } from '@bombfarm/contracts';

export interface FirstHideText {
  readonly title: string;
  readonly body: string;
}

export const FIRST_HIDE_TEXT: Readonly<Record<AppLocale, FirstHideText>> = {
  en: {
    title: 'Bomb Farm Companion is still running',
    body: 'Closing the window keeps the companion running in the background. Look for its icon in the notification area to open it again or quit.',
  },
  'pt-BR': {
    title: 'O Bomb Farm Companion continua em execução',
    body: 'Fechar a janela mantém o companion em execução em segundo plano. Procure o ícone dele na área de notificação para abrir de novo ou sair.',
  },
} as const;

export function firstHideTextFor(locale: AppLocale): FirstHideText {
  return FIRST_HIDE_TEXT[locale];
}
