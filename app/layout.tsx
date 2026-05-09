export const metadata = {
  title: 'Cadence',
  description: 'Personal LinkedIn publishing assistant'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        margin: 0, padding: 0,
        background: '#FAFAFA', color: '#111827', minHeight: '100vh'
      }}>
        {children}
      </body>
    </html>
  );
}
