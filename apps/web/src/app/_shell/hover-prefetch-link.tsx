'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';

type HoverPrefetchLinkProps = Omit<ComponentProps<typeof Link>, 'href' | 'prefetch'> & {
  href: string;
};

/**
 * A `Link` that prefetches its route on navigation intent (hover, touch, focus)
 * rather than on entering the viewport. The shell header is always in view, so
 * a viewport-prefetching `Link` there fetches every sibling route's payload on
 * every page view; this fetches only the route the visitor reaches for.
 */
export function HoverPrefetchLink({
  href,
  onMouseEnter,
  onTouchStart,
  onFocus,
  ...rest
}: HoverPrefetchLinkProps) {
  const router = useRouter();
  const prefetch = () => router.prefetch(href);

  return (
    <Link
      {...rest}
      href={href}
      prefetch={false}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        prefetch();
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event);
        prefetch();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        prefetch();
      }}
    />
  );
}
