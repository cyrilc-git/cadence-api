# Cadence — bootstrap local Windows (PowerShell)
# Usage : .\scripts\setup.ps1

$ErrorActionPreference = "Stop"

Write-Host "→ Cadence setup local (Windows)" -ForegroundColor Cyan

# 1. Install deps
Write-Host "→ Install dependencies" -ForegroundColor Cyan
if (Test-Path "package-lock.json") {
  npm ci --silent
} else {
  npm install --silent
}

# 2. Pull env vars depuis Vercel
if (-not (Test-Path ".env.local")) {
  Write-Host "→ Récupération des env vars depuis Vercel" -ForegroundColor Cyan
  if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host "  ⚠  Vercel CLI absent. Installation globale :" -ForegroundColor Yellow
    npm install -g vercel
  }
  Write-Host "  → vercel login (suis le lien dans le navigateur)" -ForegroundColor Cyan
  vercel login
  Write-Host "  → vercel link (choisis le projet cadence-api dans cyrilc-gits-projects)" -ForegroundColor Cyan
  vercel link
  Write-Host "  → vercel env pull .env.local (récupère toutes les variables Development)" -ForegroundColor Cyan
  vercel env pull .env.local
  Write-Host "  ✓ .env.local créé depuis Vercel" -ForegroundColor Green
} else {
  Write-Host "  ✓ .env.local existe déjà" -ForegroundColor Green
}

# 3. Typecheck
Write-Host "→ Typecheck" -ForegroundColor Cyan
npx tsc --noEmit

# 4. Vérif fichiers critiques
Write-Host "→ Vérif fichiers critiques" -ForegroundColor Cyan
$critical = @(
  "CLAUDE.md",
  "app/page.tsx",
  "app/posts/new/client.tsx",
  "components/CadenceEditor.tsx",
  "lib/weekly-intelligent.ts"
)
foreach ($f in $critical) {
  if (Test-Path $f) {
    Write-Host "  ✓ $f" -ForegroundColor Green
  } else {
    Write-Host "  ✗ $f MANQUANT" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "✓ Setup terminé." -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines étapes :" -ForegroundColor Cyan
Write-Host "  1. npm run dev → http://localhost:3000"
Write-Host "  2. Si LinkedIn OAuth doit marcher en local, change LINKEDIN_REDIRECT_URI dans .env.local"
Write-Host "     en http://localhost:3000/api/auth/callback ET ajoute cette URL dans la console LinkedIn Developer"
Write-Host "  3. Lis CLAUDE.md pour les conventions du projet"
