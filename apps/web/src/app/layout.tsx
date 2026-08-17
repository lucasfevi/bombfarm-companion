import type { Metadata } from 'next';
import { DM_Sans, IBM_Plex_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { ClarityAnalytics } from '@/app/_shell/clarity';
import './globals.css';

const SITE_URL = 'https://bombfarm-companion.vercel.app';
const SITE_TITLE = 'Bomb Farm Companion';
const SITE_DESCRIPTION =
  'Unofficial Bomb Farm companion — recreate your sheet, gear, skill points and buffs, then get next-point DPS advice. Runs entirely in the browser.';

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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_TITLE,
  keywords: [
    'Bomb Farm',
    'companion',
    'hero planner',
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
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Bomb Farm Companion — plan gear, skill points and DPS in the browser',
      },
    ],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og.png'],
  },
};

export const viewport = {
  themeColor: '#b96b17',
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
