export type MiniLiveFitAxis = 'vertical' | 'horizontal';

export function sizeMiniLiveFit(input: {
  chromeHeight: number;
  axis: MiniLiveFitAxis;
  paddingX: number;
  paddingY: number;
  gap: number;
  children: readonly { width: number; height: number }[];
}): { width: number; height: number } {
  const gaps = input.children.length > 1 ? input.gap * (input.children.length - 1) : 0;
  if (input.axis === 'horizontal') {
    const width = input.paddingX + gaps + input.children.reduce((sum, child) => sum + child.width, 0);
    const height =
      input.chromeHeight +
      input.paddingY +
      (input.children.length === 0 ? 0 : Math.max(...input.children.map((child) => child.height)));
    return { width, height };
  }

  const width =
    input.paddingX +
    (input.children.length === 0 ? 0 : Math.max(...input.children.map((child) => child.width)));
  const height =
    input.chromeHeight +
    input.paddingY +
    gaps +
    input.children.reduce((sum, child) => sum + child.height, 0);
  return { width, height };
}

export function readMiniLiveFitSize(
  root: HTMLElement,
  content: HTMLElement,
  axis: MiniLiveFitAxis,
): { width: number; height: number } {
  const chrome = root.querySelector('[data-testid="mini-live-chrome"]');
  const chromeHeight = chrome instanceof HTMLElement ? chrome.offsetHeight : 0;
  const style = getComputedStyle(content);
  const children = Array.from(content.children).flatMap((node) =>
    node instanceof HTMLElement ? [{ width: node.scrollWidth, height: node.scrollHeight }] : [],
  );
  return sizeMiniLiveFit({
    chromeHeight,
    axis,
    paddingX: Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight),
    paddingY: Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom),
    gap: Number.parseFloat(style.rowGap || style.columnGap || style.gap) || 0,
    children,
  });
}
