# Cadence — Synchro LinkedIn automatique (API DMA Member Data Portability)

But : Cadence reste à jour **toute seule**, que tu publies via Cadence ou en
direct sur LinkedIn. Tu consens **une fois**, puis le cron quotidien récupère
tes nouveaux posts. Réservé aux membres **EEE + Suisse** (DMA) — tu es en France,
donc éligible. **Self-serve : aucune validation partenaire LinkedIn.**

Source officielle : <https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/member-data-portability-member/>

---

## Ce que tu fais une fois (~30 min)

### 1. Créer l'application LinkedIn dédiée DMA
- Va sur <https://www.linkedin.com/developers/apps/> → **Create app**.
- ⚠️ **Étape critique** : pour le champ *LinkedIn Page*, utilise **impérativement**
  la page spéciale **« Member Data Portability (Member) Default Company »**
  (<https://www.linkedin.com/company/member-data-portability-member-default-company>).
  **Ne crée pas** de nouvelle page et n'utilise **pas** la page Heelio — sinon le
  produit DMA n'apparaît pas dans l'app.
- (C'est une app SÉPARÉE de ton app de publication actuelle, qui reste sur Heelio.)

### 2. Demander l'accès au produit
- Onglet **Products** de l'app → **Request access** pour
  **« Member Data Portability API (Member) »** → accepte les CGU → accès accordé
  (immédiat, self-serve).

### 3. Générer le token
- Menu **Docs and tools** → **OAuth Token Tools** → **Create token**.
- Sélectionne l'app DMA → coche le scope **`r_dma_portability_self_serve`**
  → **Request access token** → connecte-toi et **Allow**.
- Copie le **access token** généré.

### 4. Le donner à Cadence (active la synchro)
Colle le token dans Cadence via cette commande (remplace `<TOKEN>` et, si défini,
`<COCKPIT_SECRET>`) :

```bash
curl -s -X POST https://cadence-api-ruddy.vercel.app/api/sources/linkedin/dma \
  -H "content-type: application/json" \
  -H "x-cockpit-secret: <COCKPIT_SECRET>" \
  -d '{"access_token":"<TOKEN>"}'
# -> {"ok":true,"connected":true}
```

### 5. Lancer le backfill historique (une fois)
```bash
curl -s "https://cadence-api-ruddy.vercel.app/api/cron/linkedin-sync?snapshot=1" \
  -H "x-cron-secret: <CRON_SECRET>"
```
Cela rapatrie tout ton historique via le **Snapshot API**. Ensuite, le **cron
quotidien** (06:15 UTC, déjà configuré) capte chaque nouveau post via le
**Changelog API** (fenêtre 28 jours) — tu n'as plus rien à faire.

---

## Ce qu'il me reste à confirmer (côté code) sur ta 1re vraie réponse

Le code (`lib/linkedin-dma.ts`) est prêt mais **3 détails de la doc doivent être
validés contre une réponse réelle** (ils ont des valeurs par défaut + plusieurs
chemins de secours, et sont surchargeables par variables d'env) :

| # | Inconnue | Défaut | Variable d'env de secours |
|---|---|---|---|
| 1 | Nom du domaine Snapshot des posts | `MEMBER_SHARE_INFO` | `LINKEDIN_DMA_POSTS_DOMAIN` |
| 2 | `resourceName` d'un post créé (Changelog) | `ugcPosts,posts,shares` | `LINKEDIN_DMA_POST_RESOURCES` |
| 3 | Chemin du texte du post dans `processedActivity` | plusieurs chemins testés | — |

Dès que tu as le token, un appel à `?snapshot=1` me montre la vraie forme des
données → j'ajuste ces 3 valeurs en 5 minutes si besoin. La liste des domaines
Snapshot : <https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/shared/snapshot-domain>

---

## Variables d'environnement (Vercel)
- `CRON_SECRET` (optionnel) : protège le cron. Si absent, le cron est ouvert.
- `COCKPIT_SECRET` (déjà utilisé ailleurs) : protège le POST du token.
- `LINKEDIN_DMA_VERSION` (optionnel, défaut `202312`).
- `LINKEDIN_DMA_POSTS_DOMAIN` / `LINKEDIN_DMA_POST_RESOURCES` (optionnels, cf. tableau).

## Rappel : pourquoi pas l'autre API
`r_member_social` (Community Management / Posts API) permettrait aussi de lire
tes posts, mais c'est une permission **fermée** : LinkedIn n'accepte plus de
demandes. La voie DMA est la seule self-serve aujourd'hui.
