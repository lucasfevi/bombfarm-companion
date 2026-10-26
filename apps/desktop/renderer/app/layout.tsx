import { CSPProvider } from '@base-ui/react/csp-provider';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bomb Farm Companion',
  description: 'Desktop companion for Bomb Farm',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <CSPProvider disableStyleElements>{children}</CSPProvider>
      </body>
    </html>
  );
}
