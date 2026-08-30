'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * The panel carries a heading, a tip, the layout toggle, the totals and a three-row toolbar before
 * a single item shows — around 310px of chrome. Below this the list would be squeezed to a couple
 * of rows, which is worse than letting the page scroll, so on a short window it does.
 */
const MIN_HEIGHT = 520;

/**
 * Everything laid out after `element`: its later siblings at every level, plus the bottom padding
 * of each ancestor it sits inside.
 *
 * Measured this way rather than as `body.scrollHeight - elementBottom`, which looks equivalent and
 * is not: that figure contains the element's own height, so feeding it back into a height makes
 * the equation degenerate — every value satisfies it, and the result sticks at whatever it reached
 * first. Observed doing exactly that: dismissing the banner freed 163px and the panel stayed put.
 */
function outerHeight(element: Element): number {
  const style = getComputedStyle(element);
  // `getBoundingClientRect` is the border box, so a footer's own margins are not in it.
  const margins =
    (Number.parseFloat(style.marginTop) || 0) + (Number.parseFloat(style.marginBottom) || 0);
  return element.getBoundingClientRect().height + margins;
}

function spaceBelow(element: HTMLElement): number {
  let total = 0;
  for (let node: HTMLElement = element; node.parentElement != null; node = node.parentElement) {
    for (let next = node.nextElementSibling; next != null; next = next.nextElementSibling) {
      total += outerHeight(next);
    }
    total += Number.parseFloat(getComputedStyle(node.parentElement).paddingBottom) || 0;
  }
  return total;
}

/**
 * The height that makes an element end exactly where the page does, so it scrolls its own content
 * instead of the window scrolling everything.
 *
 * Measured rather than written as `calc(100dvh - <constant>)`, because neither side is a constant.
 * Above sits an app shell in ordinary document flow — header, a dismissible referral notice, a
 * missing-fields banner, an optional guide section — and below sits a footer and the shell's own
 * padding. A constant read 144px against a real 223px on the first window it met, and would have
 * gone wrong again the moment a banner was dismissed.
 *
 * Null until measured: the route prerenders to static HTML, where there is no layout to ask.
 */
export function useFillsViewport(ref: RefObject<HTMLElement | null>): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (element == null) return;

    const measure = () => {
      const top = element.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(MIN_HEIGHT, window.innerHeight - top - spaceBelow(element)));
    };

    measure();
    window.addEventListener('resize', measure);
    // The banners above this element appear and disappear on their own, and each one moves it.
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);

    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, [ref]);

  return height;
}
