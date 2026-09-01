import type { AppLocale } from '@bombfarm/contracts';

export interface TrayLabels {
  readonly show: string;
  readonly quit: string;
}

export const TRAY_TEXT: Readonly<Record<AppLocale, TrayLabels>> = {
  en: {
    show: 'Show',
    quit: 'Quit',
  },
  'pt-BR': {
    show: 'Mostrar',
    quit: 'Sair',
  },
} as const;

export function trayTextFor(locale: AppLocale): TrayLabels {
  return TRAY_TEXT[locale];
}
