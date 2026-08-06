import { gameIconRegistry } from './game-registry';
import { uiIconRegistry } from './ui-registry';

export const iconRegistry = { ...uiIconRegistry, ...gameIconRegistry };

export type IconName = keyof typeof iconRegistry;

const uiSources = Object.fromEntries(
  Object.keys(uiIconRegistry).map((name) => [name, 'ui']),
) as Record<keyof typeof uiIconRegistry, 'ui'>;

const gameSources = Object.fromEntries(
  Object.keys(gameIconRegistry).map((name) => [name, 'game']),
) as Record<keyof typeof gameIconRegistry, 'game'>;

export const iconSources: Record<IconName, 'ui' | 'game'> = {
  ...uiSources,
  ...gameSources,
};

export function isIconName(value: string): value is IconName {
  return Object.hasOwn(iconRegistry, value);
}
