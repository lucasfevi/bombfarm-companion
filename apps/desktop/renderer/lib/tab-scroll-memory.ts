/**
 * The shell draws one tab at a time in a single scrolling `<main>`, so leaving a tab swaps its
 * content out from under the scroller and the offset is clamped to whatever the next tab is
 * tall enough for. This remembers each tab's offset at the moment it is left, so returning can
 * put it back. A tab never left reads as the top.
 */
export interface TabScrollMemory {
  readonly leave: (tabId: string, scrollTop: number) => void;
  readonly enter: (tabId: string) => number;
}

export function createTabScrollMemory(): TabScrollMemory {
  const offsets = new Map<string, number>();
  return {
    leave: (tabId, scrollTop) => {
      offsets.set(tabId, scrollTop);
    },
    enter: (tabId) => offsets.get(tabId) ?? 0,
  };
}
