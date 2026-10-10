import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { PwaProvider } from '../components/pwa/PwaProvider';
import AppShell from '../components/layout/AppShell';

export const viewport: Viewport = {
  themeColor: '#0B0F19',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Neximet Portal - Multi-Team Enterprise Operations',
  description: 'AI-Powered Digital Transformation Portal for Software Development, Digital Marketing (SEO), Graphics Designing, and WordPress Teams.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Neximet Portal',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Neximet',
  },
  formatDetection: {
    telephone: true,
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#0B0F19" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Neximet" />
      </head>
      <body className="min-h-full bg-[#0B0F19] text-gray-100 antialiased font-sans" suppressHydrationWarning>
        <AuthProvider>
          <PwaProvider>
            <AppShell>{children}</AppShell>
          </PwaProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
