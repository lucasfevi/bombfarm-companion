export type MiniSectionKey = 'showEarnings' | 'showMap' | 'showHeroes';

export type MiniLiveAxis = 'vertical' | 'horizontal';

export interface MiniLiveLayout {
  readonly showEarnings: boolean;
  readonly showMap: boolean;
  readonly showHeroes: boolean;
  readonly axis: MiniLiveAxis;
}

/** What the desktop's compact window opens with: earnings and map on, heroes off, panels stacked. */
export const DEFAULT_MINI_LAYOUT: MiniLiveLayout = {
  showEarnings: true,
  showMap: true,
  showHeroes: false,
  axis: 'vertical',
};

export function enabledSectionCount(layout: MiniLiveLayout): number {
  return Number(layout.showEarnings) + Number(layout.showMap) + Number(layout.showHeroes);
}

export function isMiniSectionDisabled(layout: MiniLiveLayout, key: MiniSectionKey): boolean {
  return layout[key] && enabledSectionCount(layout) === 1;
}

export function withMiniSection(
  layout: MiniLiveLayout,
  key: MiniSectionKey,
  shown: boolean,
): MiniLiveLayout {
  return { ...layout, [key]: shown };
}
