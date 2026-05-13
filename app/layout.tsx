import './globals.css';
import type { Metadata } from 'next';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Cadence — LinkedIn publishing',
  description: 'Préparez, validez et publiez vos posts LinkedIn depuis une seule app.',
  icons: { icon: '/icon.svg', apple: '/apple-icon.svg' }
};

export const viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="antialiased">
      <head>
        <link rel="preconnect" href="https://rsms.me/" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body className="font-sans min-h-screen text-ink-900">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 lg:pl-64">
            <div className="px-5 py-7 lg:px-10 lg:py-9 max-w-6xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
