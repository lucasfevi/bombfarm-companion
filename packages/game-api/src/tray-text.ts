import type { AppLocale } from '@bombfarm/contracts';

export interface TrayLabels {
  readonly show: string;
  readonly mini: string;
  readonly quit: string;
}

export const TRAY_TEXT: Readonly<Record<AppLocale, TrayLabels>> = {
  en: {
    show: 'Show',
    mini: 'Mini',
    quit: 'Quit',
  },
  'pt-BR': {
    show: 'Mostrar',
    mini: 'Mini',
    quit: 'Sair',
  },
} as const;

export function trayTextFor(locale: AppLocale): TrayLabels {
  return TRAY_TEXT[locale];
}
