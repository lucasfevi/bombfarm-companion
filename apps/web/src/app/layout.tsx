import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
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

/**
 * The sans face carries the app's figures, so it has to be one whose digits are all one width.
 * Every live reading re-flowed under a proportional face, and `tabular-nums` could not fix it:
 * a face without tabular figures has no such feature to switch on. IBM Plex Sans needs no
 * feature — its digits are equal-width by default — and it is the mono face's own superfamily.
 *
 * Weights are explicit because Google serves this family as statics, not a variable axis. It
 * tops out at 700, so `font-extrabold` and `font-black` render at 700; nothing is gained by
 * requesting weights the family does not have.
 */
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
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
    <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      <body>
        {children}
        <ClarityAnalytics />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
