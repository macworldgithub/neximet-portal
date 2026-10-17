import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { ChatProvider } from '../context/ChatContext';
import { MailProvider } from '../context/MailContext';
import { PwaProvider } from '../components/pwa/PwaProvider';
import AppShell from '../components/layout/AppShell';

export const viewport: Viewport = {
  themeColor: '#0B0F19',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
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
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
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
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full bg-[#0B0F19] text-gray-100 antialiased font-sans" suppressHydrationWarning>
        <AuthProvider>
          <ChatProvider>
            <MailProvider>
              <PwaProvider>
                <AppShell>{children}</AppShell>
              </PwaProvider>
            </MailProvider>
          </ChatProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
