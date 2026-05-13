import './globals.css';
import type { Metadata } from 'next';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Cadence — LinkedIn publishing',
  description: 'Préparez, validez et publiez vos posts LinkedIn depuis une seule app.',
  icons: { icon: '/icon.svg', apple: '/apple-icon.svg' }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="font-sans min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 lg:pl-64">
            <div className="px-6 py-8 lg:px-12 lg:py-10 max-w-6xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
