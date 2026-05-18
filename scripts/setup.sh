#!/usr/bin/env bash
# Cadence — bootstrap local après clone
set -e

echo "→ Cadence setup local"

if [ ! -f .env.local ]; then
  if [ -f .env.example ]; then
    cp .env.example .env.local
    echo "  ✓ .env.local créé depuis .env.example"
    echo "  ⚠  À éditer : remplis les 6 variables marquées 'remplir_depuis_vercel'"
    echo "     → Vercel Dashboard → cadence-api → Settings → Environment Variables"
  else
    echo "  ✗ .env.example introuvable"
    exit 1
  fi
else
  echo "  ✓ .env.local existe déjà"
fi

echo "→ Install dependencies (npm ci si lockfile, sinon npm install)"
if [ -f package-lock.json ]; then npm ci --silent; else npm install --silent; fi

echo "→ Typecheck"
npx tsc --noEmit

echo "→ Vérif fichiers critiques"
for f in CLAUDE.md app/page.tsx app/posts/new/client.tsx components/CadenceEditor.tsx lib/weekly-intelligent.ts; do
  [ -f "$f" ] && echo "  ✓ $f" || echo "  ✗ $f MANQUANT"
done

echo
echo "✓ Setup terminé."
echo
echo "Prochaines étapes :"
echo "  1. Édite .env.local avec les 6 valeurs depuis Vercel"
echo "  2. npm run dev → http://localhost:3000"
echo "  3. Lis CLAUDE.md pour les conventions du projet"
