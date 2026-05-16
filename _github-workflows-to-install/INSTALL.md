# CI à installer manuellement

Le PAT utilisé par Claude n'a pas le scope `workflow`, donc je ne peux pas pousser les workflows. Tu dois soit :

**Option A — Le plus simple (en local)**
```bash
mkdir -p .github/workflows
mv _github-workflows-to-install/qa.yml .github/workflows/
mv _github-workflows-to-install/smoke.yml .github/workflows/
mv _github-workflows-to-install/INSTALL.md .github/workflows/README.md
rm -r _github-workflows-to-install
git add -A && git commit -m "ci: enable QA + smoke workflows" && git push
```

**Option B — Donner le scope workflow au PAT**
GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → édit le token utilisé, ajouter scope `workflow`. Puis je peux pousser direct la prochaine fois.

## Contenu

- `qa.yml` — sur chaque push : install + typecheck + build + scan mojibake + vérif fichiers critiques
- `smoke.yml` — toutes les 6h : ping routes prod, fail si 5xx
