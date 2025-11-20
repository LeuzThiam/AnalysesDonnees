# 🔧 Correction du Workflow AnalyseDonnees - SQL Qui Ne Renvoie Qu'1 Ligne

## ❌ Problème Identifié

Le workflow `AnalyseDonnees` génère un SQL qui ne renvoie qu'**1 ligne** au lieu de toutes les lignes.

**Résultat** : Le webhook `Analyse2` reçoit seulement 1 joueur au lieu de tous les joueurs.

## 🔍 Diagnostic

### Vérifier le SQL Généré

Dans le workflow `AnalyseDonnees`, après la génération du SQL, ajoutez un nœud de log :

```javascript
// Nœud Code pour vérifier le SQL
const sql = $json.sql || $json.body?.sql || "";
console.log("SQL généré:", sql);

// Vérifier les problèmes courants
if (sql.includes("MAX(") && !sql.includes("GROUP BY")) {
  console.error("❌ PROBLÈME : MAX() sans GROUP BY → renvoie 1 ligne");
}

if (sql.includes("MIN(") && !sql.includes("GROUP BY")) {
  console.error("❌ PROBLÈME : MIN() sans GROUP BY → renvoie 1 ligne");
}

if (sql.includes("SELECT") && !sql.includes("FROM")) {
  console.error("❌ PROBLÈME : SQL invalide");
}

return $json;
```

## ✅ Solutions selon le Type de Question

### Question : "qui est le meilleur passeurs"

**❌ SQL INCORRECT** (renvoie 1 ligne) :
```sql
SELECT player_name, MAX(Assists) AS max_assists
FROM "player_stats_2024_2025_season"
-- Pas de GROUP BY → 1 seule ligne agrégée
```

**✅ SQL CORRECT** (renvoie toutes les lignes) :
```sql
SELECT player_name, Assists
FROM "player_stats_2024_2025_season"
WHERE Assists > 0
ORDER BY Assists DESC
LIMIT 1000
```

### Question : "liste des joueurs avec leur nombre de buts"

**❌ SQL INCORRECT** :
```sql
SELECT COUNT(*) AS total
FROM "player_stats_2024_2025_season"
-- Renvoie 1 ligne (le total)
```

**✅ SQL CORRECT** :
```sql
SELECT player_name, Goals
FROM "player_stats_2024_2025_season"
WHERE Goals > 0
ORDER BY Goals DESC
LIMIT 1000
```

## 🎯 Correction du Prompt dans AnalyseDonnees

### Prompt Actuel (Probablement)

```
Génère un SQL pour la question : "qui est le meilleur passeurs"
```

### Prompt Corrigé

```
Pour la question : "qui est le meilleur passeurs"

Génère un SQL qui renvoie TOUS les joueurs avec leur nombre de passes, 
ordonnés par nombre de passes décroissant.

IMPORTANT :
- Ne pas utiliser MAX() ou MIN() sans GROUP BY si tu veux tous les joueurs
- Utilise plutôt : SELECT player_name, Assists FROM table ORDER BY Assists DESC
- Ajoute un LIMIT 1000 pour éviter trop de données
- Si la question demande "le meilleur", renvoie tous les joueurs triés, pas juste le maximum

Exemple de SQL correct :
SELECT player_name, Assists 
FROM "player_stats_2024_2025_season" 
WHERE Assists > 0
ORDER BY Assists DESC 
LIMIT 1000
```

## 🔍 Vérification dans le Workflow AnalyseDonnees

### Étape 1 : Vérifier le SQL Généré

Ajoutez un nœud "Set" ou "Code" après la génération du SQL :

```javascript
const sql = $json.sql || "";
console.log("SQL généré:", sql);

// Compter les mots-clés problématiques
const hasMaxWithoutGroupBy = sql.includes("MAX(") && !sql.includes("GROUP BY");
const hasMinWithoutGroupBy = sql.includes("MIN(") && !sql.includes("GROUP BY");

if (hasMaxWithoutGroupBy || hasMinWithoutGroupBy) {
  console.error("❌ SQL problématique : agrégation sans GROUP BY");
  console.error("Ce SQL ne renverra qu'une seule ligne !");
}

return $json;
```

### Étape 2 : Tester le SQL Généré

Ajoutez un nœud "HTTP Request" pour tester le SQL :

```
POST http://127.0.0.1:8000/api/analytics/query/sql
Body: {
  "sql": "{{$json.sql}}"
}
```

Puis vérifiez combien de lignes sont retournées dans la réponse.

### Étape 3 : Corriger le SQL si Nécessaire

Si le SQL ne renvoie qu'une ligne, ajoutez un nœud "Code" pour le corriger :

```javascript
let sql = $json.sql || "";

// Si le SQL contient MAX() sans GROUP BY, le corriger
if (sql.includes("MAX(") && !sql.includes("GROUP BY")) {
  console.warn("Correction du SQL : MAX() sans GROUP BY");
  
  // Extraire le nom de la colonne et de la table
  const maxMatch = sql.match(/MAX\(["']?(\w+)["']?\)/i);
  const fromMatch = sql.match(/FROM\s+["']?([^"'\s]+)["']?/i);
  
  if (maxMatch && fromMatch) {
    const colName = maxMatch[1];
    const tableName = fromMatch[1];
    
    // Remplacer par un SELECT simple avec ORDER BY
    sql = `SELECT player_name, ${colName}
FROM "${tableName}"
WHERE ${colName} > 0
ORDER BY ${colName} DESC
LIMIT 1000`;
    
    console.log("SQL corrigé:", sql);
  }
}

return {
  ...$json,
  sql: sql
};
```

## 📝 Exemples de Corrections SQL

### Correction 1 : MAX() sans GROUP BY

**Avant** :
```sql
SELECT player_name, MAX(Assists) AS max_assists
FROM "player_stats_2024_2025_season"
```

**Après** :
```sql
SELECT player_name, Assists
FROM "player_stats_2024_2025_season"
WHERE Assists > 0
ORDER BY Assists DESC
LIMIT 1000
```

### Correction 2 : COUNT() au lieu de SELECT *

**Avant** :
```sql
SELECT COUNT(*) AS total
FROM "player_stats_2024_2025_season"
```

**Après** :
```sql
SELECT player_name, Assists
FROM "player_stats_2024_2025_season"
ORDER BY Assists DESC
LIMIT 1000
```

## 🎯 Solution Recommandée

**Modifiez le prompt du LLM dans AnalyseDonnees** pour qu'il génère toujours un SQL qui renvoie toutes les lignes :

```
Tu dois générer un SQL qui renvoie TOUTES les lignes pertinentes, pas juste une agrégation.

Pour les questions de type "qui est le meilleur", "liste des", "affiche les" :
- Utilise SELECT avec les colonnes nécessaires
- Ajoute ORDER BY pour trier
- Ajoute LIMIT 1000 pour limiter le nombre de résultats
- NE PAS utiliser MAX()/MIN()/COUNT() sans GROUP BY si tu veux toutes les lignes

Exemple pour "qui est le meilleur passeurs" :
SELECT player_name, Assists 
FROM table 
WHERE Assists > 0 
ORDER BY Assists DESC 
LIMIT 1000
```

## 🔍 Vérification Finale

Après correction, testez le workflow et vérifiez :

1. **Le SQL généré** ne contient pas `MAX()`/`MIN()` sans `GROUP BY`
2. **Le SQL contient** `ORDER BY` pour trier les résultats
3. **Le SQL contient** `LIMIT 1000` pour limiter les résultats
4. **Le test du SQL** renvoie plusieurs lignes (200+ au lieu de 1)

Une fois corrigé, le webhook `Analyse2` recevra toutes les lignes et pourra faire une analyse complète.

