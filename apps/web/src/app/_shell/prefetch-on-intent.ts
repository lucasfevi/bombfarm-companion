import type { useRouter } from "next/navigation";

type AppRouter = ReturnType<typeof useRouter>;

/**
 * Handler props for a `<Link prefetch={false}>` so it prefetches its route on
 * navigation intent (hover, touch, focus) instead of on entering the viewport.
 * The shell header is always in view, so a viewport-prefetching `Link` there
 * fetches every sibling route's payload on every page view; this fetches only
 * the route the visitor reaches for.
 */
export function prefetchOnIntent(router: AppRouter, href: string) {
  const prefetch = () => router.prefetch(href);
  return { onMouseEnter: prefetch, onTouchStart: prefetch, onFocus: prefetch };
}
