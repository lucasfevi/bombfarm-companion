'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * `/phases` redirect stub (`AD-PFRC-01`). Lives OUTSIDE the `(app)` route group deliberately:
 * a stub inside the group would mount `ClientAppShell` -> `ClientMountGate` ->
 * `hydratePlannerStore()` -> the `@planner` slot for a URL the user leaves in the same tick.
 *
 * `output: 'export'` means `next.config.ts`'s `redirects()` never runs and a server
 * `redirect()` cannot be prerendered — a client page is the only static-export-safe option
 * (design.md TD-1). `router.replace`, never `push`: a pushed history entry makes Back land on
 * `/phases` again, which redirects again (the classic redirect trap) — `R-C2`.
 *
 * The planner needs JS to do anything at all (`ClientMountGate`, `localStorage`), so a no-JS
 * visitor has no working app to be redirected to regardless — the `<noscript>` meta-refresh
 * below costs nothing and is included anyway.
 */
export default function PhasesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/farm');
  }, [router]);

  return (
    <>
      <noscript>
        <meta httpEquiv="refresh" content="0; url=/farm" />
      </noscript>
      <a href="/farm">Farm</a>
    </>
  );
}
