# 🔧 Où Modifier le Workflow AnalyseDonnees

## 📍 Emplacement de la Modification

Dans le workflow `AnalyseDonnees`, vous devez modifier le **nœud qui génère le SQL** (probablement un nœud "AI Agent" ou "OpenAI").

## ✅ Étape 1 : Trouver le Nœud qui Génère le SQL

1. **Ouvrez le workflow `AnalyseDonnees` dans n8n**
2. **Cherchez le nœud "AI Agent" ou "OpenAI"** qui génère le SQL
3. **Ce nœud doit avoir un prompt** qui demande de générer du SQL

## ✅ Étape 2 : Modifier le Prompt

### Prompt Actuel (Probablement)

```
Génère un SQL pour la question : {{$json.body.question}}
Dataset : {{$json.body.dataset}}
Schéma : {{$json.body.schema}}
```

### Prompt Corrigé

```
Tu es un expert SQL. Génère un SQL DuckDB pour répondre à cette question.

Question : {{$json.body.question}}
Dataset : {{$json.body.dataset}}
Schéma des colonnes : {{$json.body.schema}}

RÈGLES IMPORTANTES :
1. Pour les questions de type "qui est le meilleur", "liste des", "affiche les" :
   - Utilise SELECT avec les colonnes nécessaires
   - Ajoute WHERE pour filtrer si nécessaire
   - Ajoute ORDER BY pour trier les résultats
   - Ajoute LIMIT 1000 pour limiter le nombre de résultats
   - NE PAS utiliser MAX()/MIN()/COUNT() sans GROUP BY si tu veux toutes les lignes

2. Exemples de SQL corrects :

   Question : "qui est le meilleur passeurs"
   SQL : SELECT player_name, Assists FROM "table" WHERE Assists > 0 ORDER BY Assists DESC LIMIT 1000

   Question : "liste des joueurs avec leur nombre de buts"
   SQL : SELECT player_name, Goals FROM "table" WHERE Goals > 0 ORDER BY Goals DESC LIMIT 1000

3. Si la question demande "le meilleur", renvoie TOUS les joueurs triés, pas juste le maximum.

4. Utilise toujours des guillemets doubles pour les noms de tables et colonnes : "table_name", "column_name"

5. Retourne UNIQUEMENT le SQL, sans explication, dans ce format JSON :
{
  "sql": "SELECT ...",
  "chart_spec": {"type": "bar", "x": "player_name", "y": "Assists"}
}
```

## ✅ Étape 3 : Exemple Complet de Nœud AI Agent

### Configuration du Nœud AI Agent

**System Message** :
```
Tu es un expert SQL DuckDB. Tu génères des requêtes SQL pour répondre à des questions en langage naturel.
```

**Prompt (User Message)** :
```
Question : {{$json.body.question}}
Dataset : {{$json.body.dataset}}
Schéma : {{$json.body.schema}}

Génère un SQL qui renvoie TOUTES les lignes pertinentes, pas juste une agrégation.

Pour "qui est le meilleur passeurs", génère :
SELECT player_name, Assists 
FROM "{{$json.body.dataset}}" 
WHERE Assists > 0 
ORDER BY Assists DESC 
LIMIT 1000

Retourne UNIQUEMENT un JSON avec :
{
  "sql": "SELECT ...",
  "chart_spec": {"type": "bar", "x": "player_name", "y": "Assists"}
}
```

## ✅ Étape 4 : Alternative - Nœud Code pour Corriger le SQL

Si vous ne pouvez pas modifier le prompt, ajoutez un nœud "Code" APRÈS la génération du SQL pour le corriger :

```javascript
// Nœud Code : Corriger le SQL généré
let sql = $json.sql || $json.body?.sql || "";

console.log("SQL original:", sql);

// Si le SQL contient MAX()/MIN() sans GROUP BY, le corriger
if ((sql.includes("MAX(") || sql.includes("MIN(")) && !sql.includes("GROUP BY")) {
  console.warn("⚠️ Correction du SQL : agrégation sans GROUP BY");
  
  // Extraire les informations
  const dataset = $json.body?.dataset || $json.dataset || "";
  const question = $json.body?.question || $json.question || "";
  
  // Détecter la colonne à utiliser
  let colName = "Assists"; // Par défaut
  if (question.toLowerCase().includes("passeur") || question.toLowerCase().includes("passes")) {
    colName = "Assists";
  } else if (question.toLowerCase().includes("but") || question.toLowerCase().includes("goal")) {
    colName = "Goals";
  } else {
    // Essayer d'extraire depuis le SQL
    const colMatch = sql.match(/MAX\(["']?(\w+)["']?\)|MIN\(["']?(\w+)["']?\)/i);
    if (colMatch) {
      colName = colMatch[1] || colMatch[2];
    }
  }
  
  // Générer le SQL correct
  sql = `SELECT player_name, ${colName}
FROM "${dataset}"
WHERE ${colName} > 0
ORDER BY ${colName} DESC
LIMIT 1000`;
  
  console.log("SQL corrigé:", sql);
}

// Mettre à jour le chart_spec si nécessaire
let chartSpec = $json.chart_spec || $json.body?.chart_spec || {};
if (!chartSpec.x || !chartSpec.y) {
  chartSpec = {
    type: "bar",
    x: "player_name",
    y: colName || "Assists"
  };
}

return {
  ...$json,
  sql: sql,
  chart_spec: chartSpec
};
```

## 📋 Checklist

- [ ] Trouvé le nœud qui génère le SQL dans `AnalyseDonnees`
- [ ] Modifié le prompt pour qu'il génère un SQL avec ORDER BY au lieu de MAX() sans GROUP BY
- [ ] Ou ajouté un nœud Code pour corriger le SQL après génération
- [ ] Testé le workflow et vérifié que le SQL généré renvoie plusieurs lignes
- [ ] Vérifié dans les logs que `rows.length > 1` dans le webhook Analyse2

## 🎯 Résultat Attendu

Après modification, le SQL généré devrait être :
```sql
SELECT player_name, Assists
FROM "player_stats_2024_2025_season"
WHERE Assists > 0
ORDER BY Assists DESC
LIMIT 1000
```

Et le webhook `Analyse2` recevra 200+ lignes au lieu de 1.

