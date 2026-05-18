#!/usr/bin/env bash
# Cadence — bootstrap local après clone
set -e

echo "→ Cadence setup local"

# 1. Install deps
echo "→ Install dependencies"
if [ -f package-lock.json ]; then npm ci --silent; else npm install --silent; fi

# 2. Pull env vars depuis Vercel (officiel, gère les Sensitive)
if [ ! -f .env.local ]; then
  echo
  echo "→ Récupération des env vars depuis Vercel"
  if ! command -v vercel &> /dev/null; then
    echo "  ⚠  Vercel CLI absent. Installation globale :"
    npm install -g vercel
  fi
  echo "  → vercel login (suis le lien dans le navigateur)"
  vercel login
  echo "  → vercel link (choisis le projet cadence-api dans cyrilc-gits-projects)"
  vercel link
  echo "  → vercel env pull (récupère toutes les variables Development)"
  vercel env pull .env.local
  echo "  ✓ .env.local créé depuis Vercel"
else
  echo "  ✓ .env.local existe déjà"
fi

# 3. Typecheck
echo "→ Typecheck"
npx tsc --noEmit

# 4. Vérif fichiers critiques
echo "→ Vérif fichiers critiques"
for f in CLAUDE.md app/page.tsx app/posts/new/client.tsx components/CadenceEditor.tsx lib/weekly-intelligent.ts; do
  [ -f "$f" ] && echo "  ✓ $f" || echo "  ✗ $f MANQUANT"
done

echo
echo "✓ Setup terminé."
echo
echo "Prochaines étapes :"
echo "  1. npm run dev → http://localhost:3000"
echo "  2. Si LinkedIn OAuth doit marcher en local, change LINKEDIN_REDIRECT_URI dans .env.local"
echo "     en http://localhost:3000/api/auth/callback ET ajoute cette URL dans la console LinkedIn Developer"
echo "  3. Lis CLAUDE.md pour les conventions du projet"
