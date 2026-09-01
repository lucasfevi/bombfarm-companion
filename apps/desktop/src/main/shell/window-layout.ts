export const WINDOW_LAYOUT_META_KEY = 'window_layout_v1';
export const DEFAULT_MAIN_WIDTH = 1280;
export const DEFAULT_MAIN_HEIGHT = 800;
export const MIN_MAIN_WIDTH = 960;
export const MIN_MAIN_HEIGHT = 640;

export interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MainWindowLayout {
  displayId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

export type MiniLiveGrowthAxis = 'vertical' | 'horizontal';

export interface MiniLiveBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  displayId: number;
}

export interface MiniLiveLayoutStored {
  bounds: MiniLiveBounds;
  showEarnings: boolean;
  showMap: boolean;
  showHeroes: boolean;
  axis: MiniLiveGrowthAxis;
  wasOpen: boolean;
}

export interface WindowLayoutDocument {
  schemaVersion: 1;
  main: MainWindowLayout;
  mini?: MiniLiveLayoutStored;
}

function fitSize(
  width: number,
  height: number,
  workArea: WorkArea,
  minWidth: number,
  minHeight: number,
): { width: number; height: number } {
  return {
    width: Math.min(Math.max(minWidth, width), workArea.width),
    height: Math.min(Math.max(minHeight, height), workArea.height),
  };
}

function clampPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  workArea: WorkArea,
): { x: number; y: number } {
  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;
  return {
    x: Math.max(workArea.x, Math.min(x, maxX)),
    y: Math.max(workArea.y, Math.min(y, maxY)),
  };
}

function centeredBounds(
  width: number,
  height: number,
  workArea: WorkArea,
): WorkArea {
  return {
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height,
  };
}

export function clampToWorkArea(input: {
  stored: MainWindowLayout | null;
  displays: readonly { id: number; workArea: WorkArea }[];
  primaryWorkArea: WorkArea;
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
}): { bounds: WorkArea; isMaximized: boolean; displayMissing: boolean } {
  if (!input.stored) {
    const { width, height } = fitSize(
      input.defaultWidth,
      input.defaultHeight,
      input.primaryWorkArea,
      input.minWidth,
      input.minHeight,
    );
    return {
      bounds: centeredBounds(width, height, input.primaryWorkArea),
      isMaximized: false,
      displayMissing: false,
    };
  }

  const matchedDisplay = input.displays.find((display) => display.id === input.stored!.displayId);
  const displayMissing = matchedDisplay === undefined;
  const workArea = matchedDisplay?.workArea ?? input.primaryWorkArea;
  const { width, height } = fitSize(
    input.stored.width,
    input.stored.height,
    workArea,
    input.minWidth,
    input.minHeight,
  );
  const absoluteX = workArea.x + input.stored.x;
  const absoluteY = workArea.y + input.stored.y;
  const position = clampPosition(absoluteX, absoluteY, width, height, workArea);

  return {
    bounds: { ...position, width, height },
    isMaximized: input.stored.isMaximized,
    displayMissing,
  };
}

export function clampMiniToWorkArea(input: {
  stored: MiniLiveBounds | null;
  displays: readonly { id: number; workArea: WorkArea }[];
  primaryWorkArea: WorkArea;
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
}): { bounds: WorkArea; displayId: number; displayMissing: boolean } {
  if (!input.stored) {
    const { width, height } = fitSize(
      input.defaultWidth,
      input.defaultHeight,
      input.primaryWorkArea,
      input.minWidth,
      input.minHeight,
    );
    return {
      bounds: centeredBounds(width, height, input.primaryWorkArea),
      displayId: input.displays[0]?.id ?? 0,
      displayMissing: false,
    };
  }

  const matchedDisplay = input.displays.find((display) => display.id === input.stored!.displayId);
  const displayMissing = matchedDisplay === undefined;
  const workArea = matchedDisplay?.workArea ?? input.primaryWorkArea;
  const { width, height } = fitSize(
    input.stored.width,
    input.stored.height,
    workArea,
    input.minWidth,
    input.minHeight,
  );
  const absoluteX = workArea.x + input.stored.x;
  const absoluteY = workArea.y + input.stored.y;
  const position = clampPosition(absoluteX, absoluteY, width, height, workArea);

  return {
    bounds: { ...position, width, height },
    displayId: matchedDisplay?.id ?? input.displays[0]?.id ?? input.stored.displayId,
    displayMissing,
  };
}
