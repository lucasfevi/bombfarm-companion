import { uiIconRegistry } from './ui-registry';

export const iconRegistry = { ...uiIconRegistry };

export type IconName = keyof typeof iconRegistry;

export const iconSources = Object.fromEntries(
  Object.keys(uiIconRegistry).map((name) => [name, 'ui' as const]),
) as Record<IconName, 'ui'>;

export function isIconName(value: string): value is IconName {
  return Object.hasOwn(iconRegistry, value);
}
