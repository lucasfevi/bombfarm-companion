import type { Metadata } from 'next';
import { DM_Sans, IBM_Plex_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { ClarityAnalytics } from '@/app/_shell/clarity';
import {
  SITE_NAME,
  SITE_THEME_COLOR,
  SITE_URL,
  sectionMetadata,
} from '@/shared/lib/site-metadata';
import './globals.css';

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

/**
 * Site-wide chrome plus the planner's own preview: `/` has no layout of its own, so this is
 * where the planner's title, description and share card come from. Every other section overrides
 * all three from its own layout.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...sectionMetadata('planner'),
  applicationName: SITE_NAME,
  keywords: [
    'Bomb Farm',
    'companion',
    'hero planner',
    'farm ranking',
    'gold per hour',
    'DPS',
    'gear',
    'skill points',
    'build planner',
    'fan tool',
  ],
  authors: [{ name: 'Bomb Farm Companion contributors' }],
  creator: 'Bomb Farm Companion contributors',
  robots: { index: true, follow: true },
  icons: {
    icon: '/favicon.svg',
  },
};

export const viewport = {
  themeColor: SITE_THEME_COLOR,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${ibmPlexMono.variable}`}>
      <body>
        {children}
        <ClarityAnalytics />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
