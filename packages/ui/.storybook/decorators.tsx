import { type ReactNode } from 'react';
import type { Decorator } from '@storybook/react';

/**
 * Canvas shell — dark app tokens so the preview is not Storybook's default
 * brown chrome. Fonts are self-hosted via `@fontsource` and set as
 * `--font-dm-sans` / `--font-ibm-plex-mono` in `preview.css` (see ASM-03);
 * this decorator only needs to apply the token/font utility classes, same
 * as the old `next/font`-based shell did.
 */
function AppPreviewShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[50vh] bg-bg p-4 font-sans text-ink antialiased">{children}</div>
  );
}

export const withAppPreview: Decorator = (Story) => (
  <AppPreviewShell>
    <Story />
  </AppPreviewShell>
);
