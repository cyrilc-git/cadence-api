#!/usr/bin/env bash
# À exécuter UNE FOIS après régénération du PAT GitHub avec scope `workflow`.
# Déplace les workflows en attente dans .github/workflows/ puis push.
set -e

if [ ! -d _github-workflows-to-install ]; then
  echo "Aucun workflow en attente. Rien à faire."
  exit 0
fi

mkdir -p .github/workflows
mv _github-workflows-to-install/qa.yml .github/workflows/qa.yml
mv _github-workflows-to-install/smoke.yml .github/workflows/smoke.yml
mv _github-workflows-to-install/INSTALL.md .github/workflows/README.md
rmdir _github-workflows-to-install 2>/dev/null || true

git add -A
git commit -m "ci: enable QA + smoke workflows (PAT now has workflow scope)"
git push

echo "✓ Workflows activés. Visite https://github.com/cyrilc-git/cadence-api/actions"
