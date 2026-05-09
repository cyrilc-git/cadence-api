export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: '80px auto', padding: '0 24px' }}>
      <div style={{
        background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
        width: 80, height: 80, borderRadius: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24
      }}>
        <span style={{ color: 'white', fontSize: 32, fontWeight: 700 }}>↗</span>
      </div>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Cadence</h1>
      <p style={{ color: '#6B7280', marginBottom: 32, lineHeight: 1.6 }}>
        Personal LinkedIn publishing assistant — outil perso de Cyril Coulange pour automatiser
        la publication, l'analyse, et la programmation de posts depuis le cockpit Cowork.
      </p>
      <a href="/api/auth/linkedin"
         style={{
           display: 'inline-block',
           background: '#6366F1', color: 'white',
           padding: '12px 24px', borderRadius: 10,
           textDecoration: 'none', fontWeight: 600
         }}>
        🔗 Connect LinkedIn
      </a>
      <div style={{ marginTop: 48, fontSize: 13, color: '#9CA3AF' }}>
        Status :{' '}
        <a href="/api/auth/status" style={{ color: '#6366F1' }}>
          vérifier la connexion
        </a>
      </div>
    </main>
  );
}
