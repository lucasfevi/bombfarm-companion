import { useLayoutEffect, type ReactNode } from 'react';
import type { Decorator } from '@storybook/react';
import { DM_Sans, IBM_Plex_Mono } from 'next/font/google';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

const fontVariableClasses = `${dmSans.variable} ${ibmPlexMono.variable}`;

/**
 * Apply next/font CSS variables on <html> (same as app `layout.tsx`) so
 * `:root { font-family: var(--font) }` and `font-sans` utilities resolve.
 * Canvas wrapper carries dark app tokens so the preview is not Storybook's
 * default brown chrome.
 */
function AppPreviewShell({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const tokens = fontVariableClasses.split(/\s+/).filter(Boolean);
    root.classList.add(...tokens);
    return () => {
      root.classList.remove(...tokens);
    };
  }, []);

  return (
    <div className={`${fontVariableClasses} min-h-[50vh] bg-bg p-4 font-sans text-ink antialiased`}>
      {children}
    </div>
  );
}

export const withAppPreview: Decorator = (Story) => (
  <AppPreviewShell>
    <Story />
  </AppPreviewShell>
);
