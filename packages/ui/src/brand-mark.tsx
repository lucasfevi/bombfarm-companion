export interface BrandMarkProps {
  /** Pixel size — square, matches the web's own header mark (`apps/web/public/favicon.svg`, 34px). */
  size?: number;
  className?: string;
}

/**
 * The five shapes of `apps/web/public/favicon.svg`, inlined rather than shipped as a file: a
 * binary asset here would need its own copy step into the desktop bundle and a place it could
 * fail to load. One component both apps can import instead has neither problem.
 */
export function BrandMark({ size = 34, className }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
    >
      <rect width="32" height="32" rx="7" fill="#1a1814" />
      <rect x="0" y="0" width="3" height="32" rx="1" fill="#b96b17" />
      <circle cx="17" cy="17" r="8.5" fill="#b96b17" />
      <circle cx="17" cy="17" r="4.2" fill="#1a1814" />
      <rect x="15.2" y="5.5" width="3.6" height="5" rx="1.2" fill="#c4b8a4" />
    </svg>
  );
}
