# 🔍 Diagnostic - Vérification des Données Envoyées à n8n

## Problème : L'analyse n8n ne reçoit qu'une seule ligne

Si votre analyse n8n dit "une seule entrée" alors que vous avez 200 joueurs, voici comment diagnostiquer le problème.

---

## ✅ Étape 1 : Vérifier les Logs Django

Quand vous exécutez une requête, regardez les logs Django. Vous devriez voir :

```
[query_nl] Envoi de 200 lignes à n8n pour analyse (dataset: player_stats_2024_2025_season)
[n8n] Analyse : envoi de 200 lignes sur 200 disponibles
```

**Si vous voyez** :
- `Envoi de 1 lignes` → Le problème est dans la requête SQL (elle ne renvoie qu'une ligne)
- `Envoi de 200 lignes` mais `envoi de 1 lignes sur 200 disponibles` → Le problème est dans `analyze_result()` (limite trop basse)

---

## ✅ Étape 2 : Vérifier la Requête SQL

Dans l'interface, regardez le SQL généré. Il devrait ressembler à :

```sql
SELECT player_name, MAX(Assists) AS max_assists 
FROM "player_stats_2024_2025_season" 
GROUP BY player_name
LIMIT 1000
```

**⚠️ Problème courant** : Si le SQL contient `GROUP BY` mais pas toutes les colonnes, vous n'obtiendrez qu'une seule ligne agrégée.

**Solution** : Le SQL devrait être :
```sql
SELECT player_name, Assists 
FROM "player_stats_2024_2025_season" 
WHERE Assists > 10
ORDER BY Assists DESC
LIMIT 1000
```

---

## ✅ Étape 3 : Vérifier le Workflow n8n `AnalyseDonnees`

**❌ NE PAS FAIRE** : Un appel HTTP séparé à `/preview` ou `/all`

**✅ À FAIRE** : Utiliser directement les résultats de la requête SQL

Le workflow `AnalyseDonnees` ne devrait PAS faire :
```
❌ GET /api/analytics/datasets/{{dataset}}/preview
❌ GET /api/analytics/datasets/{{dataset}}/all
```

Ces routes renvoient soit un échantillon, soit toutes les données du dataset (pas les résultats filtrés de votre requête SQL).

---

## ✅ Étape 4 : Vérifier le Payload Envoyé à `Analyse2`

Dans le workflow n8n `Analyse2`, vérifiez que vous recevez bien le champ `rows` avec toutes les données.

Le payload devrait contenir :
```json
{
  "question": "Renvoie la liste des joueurs avec leur nombre de buts...",
  "rows": [
    {"player_name": "Mohamed Salah", "Assists": 18},
    {"player_name": "Player 2", "Assists": 15},
    ...
    // 200 lignes au total
  ],
  "chart_spec": {...},
  "total_rows": 200
}
```

**Si `rows` ne contient qu'un seul élément**, le problème vient du workflow `AnalyseDonnees` qui n'envoie pas toutes les données.

---

## ✅ Étape 5 : Vérifier la Limite Configurée

Vérifiez votre fichier `Backend/.env` :

```bash
N8N_ANALYSE_MAX_ROWS=5000  # Doit être >= au nombre de lignes attendues
```

Si vous avez 200 joueurs mais que `N8N_ANALYSE_MAX_ROWS=200`, alors tout devrait fonctionner.

---

## 🔧 Solutions selon le Problème Identifié

### Problème 1 : La requête SQL ne renvoie qu'une ligne

**Cause** : Le SQL généré par n8n est incorrect (GROUP BY mal formé, etc.)

**Solution** : 
- Reformulez votre question pour être plus précise
- Vérifiez le SQL généré dans l'interface
- Utilisez l'intent approprié (ex: `top_total` au lieu de `auto`)

### Problème 2 : Le workflow `AnalyseDonnees` utilise `/preview`

**Cause** : Le workflow fait un appel HTTP à `/preview` qui ne renvoie qu'un échantillon

**Solution** : 
- Supprimez l'appel à `/preview` dans le workflow
- Utilisez directement les résultats de la requête SQL
- Ou utilisez `/all` si vous devez absolument faire un appel HTTP (mais ce n'est pas recommandé)

### Problème 3 : La limite est trop basse

**Cause** : `N8N_ANALYSE_MAX_ROWS` est inférieur au nombre de lignes

**Solution** :
```bash
# Dans Backend/.env
N8N_ANALYSE_MAX_ROWS=10000  # Augmentez selon vos besoins
```

Puis redémarrez Django.

### Problème 4 : Le workflow `Analyse2` ne reçoit pas les données

**Cause** : Le workflow `AnalyseDonnees` ne transmet pas correctement les données

**Solution** :
- Vérifiez que le workflow `AnalyseDonnees` inclut bien le champ `rows` dans sa réponse
- Vérifiez que le workflow `Analyse2` lit bien le champ `rows` du payload reçu

---

## 🎯 Test Rapide

Pour tester rapidement, faites une requête simple et vérifiez les logs :

1. **Question** : "Liste tous les joueurs"
2. **Regardez les logs Django** : Combien de lignes sont envoyées ?
3. **Regardez la réponse n8n** : Combien de lignes sont analysées ?

Si les logs disent "200 lignes" mais l'analyse dit "1 ligne", alors le problème est dans le workflow n8n qui ne transmet pas correctement les données.

---

## 📝 Note Importante

**Le workflow `AnalyseDonnees` ne devrait PAS faire d'appel HTTP supplémentaire.**

Le flux correct est :
1. Django appelle `n8n_nl_to_sql()` → génère le SQL
2. Django exécute le SQL → obtient `rows` (toutes les données filtrées)
3. Django appelle `analyze_result(question, rows, chart_spec)` → envoie les `rows` au workflow `Analyse2`
4. Le workflow `Analyse2` reçoit les `rows` et fait l'analyse

**Aucun appel HTTP supplémentaire n'est nécessaire !**

