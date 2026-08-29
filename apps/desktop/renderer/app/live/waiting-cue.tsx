function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A restrained "still working" cue for the Live tab's waiting state. `pending` says whether
 * anything is actually in progress — a gap the app is retrying on its own, or the first account
 * read — as opposed to a state stalled on the player (consent missing), where motion would claim
 * progress that isn't happening. The outer box is always rendered so the dot appearing or
 * animating never shifts the text around it. Swapping in a real sprite loop later means
 * replacing this component with `SpriteLoop` at its one call site, in never-read-empty-state.tsx.
 */
export function WaitingCue({ pending }: { pending: boolean }) {
  const animate = pending && !prefersReducedMotion();

  return (
    <div className="flex h-4 items-center justify-center" aria-hidden="true">
      {pending && animate ? <span className="size-1.5 rounded-full bg-accent animate-pulse" /> : null}
      {pending && !animate ? <span className="size-1.5 rounded-full bg-accent" /> : null}
    </div>
  );
}
