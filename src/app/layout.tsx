import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import MobileBottomNav from '../components/MobileBottomNav';
import ScreenLockGuard from '../components/ScreenLockGuard';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ഇത്തിപൂരം POS | Restaurant Terminal',
  description: 'Unified Billing POS, Tables, Menu Stock & Daily Reports for Ithi Pooram, Vanchiyoor, Trivandrum',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ഇത്തിപൂരം POS',
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#FAF7F2',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable} min-h-screen bg-[#FAF7F2]`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={`${manrope.className} min-h-screen flex flex-col font-sans bg-[#FAF7F2] text-stone-900 antialiased selection:bg-zinc-800 selection:text-white`}>
        {children}
        <ScreenLockGuard />
        <MobileBottomNav />
      </body>
    </html>
  );
}
