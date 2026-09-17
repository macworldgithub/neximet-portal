import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import AppShell from '../components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Neximet Portal - Multi-Team Enterprise Operations',
  description: 'AI-Powered Digital Transformation Portal for Software Development, Digital Marketing (SEO), Graphics Designing, and WordPress Teams.',
  icons: {
    icon: '/neximet-logo.avif',
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
        <link rel="icon" href="/neximet-logo.avif" type="image/avif" />
      </head>
      <body className="min-h-full bg-[#0B0F19] text-gray-100 antialiased font-sans" suppressHydrationWarning>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
