# 🔍 Diagnostic - Pourquoi la Requête SQL Ne Renvoie Qu'1 Ligne

## ❌ Problème Identifié

Le webhook `Analyse2` reçoit seulement **1 ligne** dans `rows` :
```json
{
  "rows": [
    {"player_name": "Joachim Kayi-Sanda", "total_passes": 15}
  ],
  "total_rows": 1
}
```

Cela signifie que la **requête SQL générée ne renvoie qu'une seule ligne**.

## 🔍 Causes Possibles

### Cause 1 : GROUP BY Mal Formé

Le SQL généré par `AnalyseDonnees` contient probablement :
```sql
SELECT player_name, MAX(Assists) AS max_assists 
FROM "player_stats_2024_2025_season"
-- ❌ Pas de GROUP BY player_name
```

**Résultat** : Une seule ligne agrégée au lieu de toutes les lignes.

**Solution** : Le SQL devrait être :
```sql
SELECT player_name, Assists 
FROM "player_stats_2024_2025_season"
WHERE Assists > 10
ORDER BY Assists DESC
LIMIT 1000
```

### Cause 2 : Utilisation de MAX/MIN/SUM Sans GROUP BY

Si le workflow `AnalyseDonnees` génère :
```sql
SELECT MAX(Assists) AS max_assists
FROM "player_stats_2024_2025_season"
```

Cela renvoie **une seule ligne** (la valeur maximale).

**Solution** : Pour avoir tous les joueurs, il faut :
```sql
SELECT player_name, Assists
FROM "player_stats_2024_2025_season"
ORDER BY Assists DESC
LIMIT 1000
```

### Cause 3 : Le Workflow AnalyseDonnees Fait un Appel à /preview

Si le workflow `AnalyseDonnees` fait :
```
GET /api/analytics/datasets/{dataset}/preview
```

Alors il ne récupère qu'un échantillon (10-20 lignes), et si cet échantillon ne contient qu'un joueur, vous n'aurez qu'une ligne.

**Solution** : Le workflow `AnalyseDonnees` ne doit PAS faire d'appel HTTP supplémentaire. Il doit utiliser directement les résultats de la requête SQL.

## ✅ Solution : Corriger le Workflow AnalyseDonnees

### Option 1 : Vérifier le SQL Généré

Dans le workflow `AnalyseDonnees`, après la génération du SQL, ajoutez un nœud de log :

```javascript
// Nœud Code pour vérifier le SQL
const sql = $json.sql || $json.body?.sql || "";
console.log("SQL généré:", sql);

// Vérifier si le SQL contient GROUP BY sans toutes les colonnes
if (sql.includes("GROUP BY") && sql.includes("MAX") || sql.includes("MIN")) {
  console.warn("⚠️ ATTENTION : SQL avec GROUP BY et agrégation - peut renvoyer peu de lignes");
}

return $json;
```

### Option 2 : Exécuter le SQL et Vérifier les Résultats

Dans le workflow `AnalyseDonnees`, après avoir généré le SQL, exécutez-le via :

```
POST http://127.0.0.1:8000/api/analytics/query/sql
Body: {
  "sql": "{{$json.sql}}"
}
```

Puis vérifiez combien de lignes sont retournées.

### Option 3 : Modifier le Prompt du LLM dans AnalyseDonnees

Le prompt pour générer le SQL doit être clair :

```
Pour la question : "qui est le meilleur passeurs"

Génère un SQL qui renvoie TOUS les joueurs avec leur nombre de passes, 
ordonnés par nombre de passes décroissant.

Ne pas utiliser MAX() sans GROUP BY si tu veux tous les joueurs.
Utilise plutôt : SELECT player_name, Assists FROM table ORDER BY Assists DESC
```

## 🔍 Vérification dans Django

Regardez les logs Django quand vous faites une requête. Vous devriez voir :

```
[query_nl] Envoi de 200 lignes à n8n pour analyse
```

**Si vous voyez `Envoi de 1 lignes`** → Le problème est dans le SQL généré qui ne renvoie qu'une ligne.

**Si vous voyez `Envoi de 200 lignes`** → Le problème est dans la transmission entre workflows n8n.

## 🎯 Action Immédiate

1. **Vérifiez le SQL généré** dans le workflow `AnalyseDonnees`
2. **Testez ce SQL directement** dans Django :
   ```bash
   curl -X POST http://127.0.0.1:8000/api/analytics/query/sql \
     -H "Content-Type: application/json" \
     -d '{"sql": "VOTRE_SQL_ICI"}'
   ```
3. **Comptez les lignes retournées** - si c'est 1, le problème est dans le SQL
4. **Corrigez le prompt du LLM** dans `AnalyseDonnees` pour qu'il génère un SQL qui renvoie toutes les lignes

## 📝 Exemple de SQL Correct vs Incorrect

### ❌ INCORRECT (renvoie 1 ligne)
```sql
SELECT player_name, MAX(Assists) AS max_assists
FROM "player_stats_2024_2025_season"
-- Pas de GROUP BY → 1 seule ligne agrégée
```

### ✅ CORRECT (renvoie toutes les lignes)
```sql
SELECT player_name, Assists
FROM "player_stats_2024_2025_season"
WHERE Assists > 10
ORDER BY Assists DESC
LIMIT 1000
```

### ✅ CORRECT avec GROUP BY (si nécessaire)
```sql
SELECT player_name, MAX(Assists) AS max_assists
FROM "player_stats_2024_2025_season"
GROUP BY player_name
ORDER BY max_assists DESC
LIMIT 1000
```

