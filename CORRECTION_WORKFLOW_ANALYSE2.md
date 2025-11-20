# 🔧 Correction du Workflow n8n Analyse2 - Réception des Données

## ❌ Problème Identifié

Le workflow `Analyse2` reçoit seulement **1 ligne de données** au lieu de toutes les données, ce qui fait que l'analyse dit "une seule donnée disponible".

## 🔍 Diagnostic

### Comment les données sont envoyées depuis Django

Quand Django appelle le workflow `Analyse2`, il envoie un payload JSON avec cette structure :

```json
{
  "question": "Renvoie la liste des joueurs avec leur nombre de buts...",
  "rows": [
    {"player_name": "Mohamed Salah", "Assists": 18},
    {"player_name": "Player 2", "Assists": 15},
    {"player_name": "Player 3", "Assists": 12},
    ...
    // TOUTES les lignes (200+ joueurs)
  ],
  "chart_spec": {
    "type": "bar",
    "x": "player_name",
    "y": "Assists"
  },
  "total_rows": 200
}
```

### ❌ Erreur dans le Workflow Analyse2

Le workflow `Analyse2` doit lire les données depuis `{{$json.body.rows}}` ou `{{$json.rows}}` selon comment n8n reçoit le webhook.

**Si vous utilisez `{{$json.prompt}}`**, vous ne recevez que le prompt, pas les données !

## ✅ Solution : Corriger le Workflow Analyse2

### Étape 1 : Vérifier comment n8n reçoit les données

Dans le workflow `Analyse2`, le nœud "Webhook" reçoit le payload. Vérifiez la structure :

1. **Ouvrez le workflow `Analyse2` dans n8n**
2. **Cliquez sur le nœud "Webhook"** (ou le premier nœud qui reçoit les données)
3. **Testez le workflow** avec des données de test
4. **Regardez la structure JSON** qui arrive

### Étape 2 : Utiliser le bon chemin pour les données

Selon comment n8n reçoit le webhook, les données peuvent être à :

**Option A** : Si le webhook reçoit directement le JSON :
```javascript
{{$json.rows}}           // ← Les données sont ici
{{$json.question}}       // ← La question
{{$json.chart_spec}}     // ← La spécification du graphique
```

**Option B** : Si le webhook reçoit un body avec le JSON :
```javascript
{{$json.body.rows}}      // ← Les données sont ici
{{$json.body.question}}   // ← La question
{{$json.body.chart_spec}} // ← La spécification du graphique
```

**Option C** : Si c'est un POST avec un body parsé :
```javascript
{{$json.rows}}           // ← Les données sont ici
{{$json.question}}       // ← La question
```

### Étape 3 : Modifier le nœud Code/LLM dans Analyse2

Dans le nœud qui prépare le prompt pour l'LLM, vous devez utiliser les `rows` :

**❌ MAUVAIS** (ce que vous avez probablement) :
```javascript
const prompt = `{{$json.prompt}}`;  // ← Ne contient pas les données !
```

**✅ CORRECT** :
```javascript
// Récupérer les données
const rows = $json.rows || $json.body?.rows || [];
const question = $json.question || $json.body?.question || "";
const chartSpec = $json.chart_spec || $json.body?.chart_spec || {};

// Vérifier qu'on a bien les données
if (!rows || rows.length === 0) {
  return {
    summary: "Aucune donnée reçue pour l'analyse.",
    text: "Le workflow n'a pas reçu de données à analyser."
  };
}

// Construire le prompt avec les données
const prompt = `Tu es un assistant expert en analyse de données.

Question: ${question}

Données (${rows.length} lignes):
${JSON.stringify(rows, null, 2)}

Spécification graphique: ${JSON.stringify(chartSpec, null, 2)}

Analyse ces données et réponds en JSON avec summary et text.`;

return { prompt, rows, question, chartSpec };
```

### Étape 4 : Vérifier le nombre de lignes

Ajoutez un nœud de log pour vérifier :

```javascript
// Dans un nœud Code avant l'LLM
const rows = $json.rows || $json.body?.rows || [];
console.log(`Nombre de lignes reçues: ${rows.length}`);

if (rows.length === 1) {
  console.error("⚠️ PROBLÈME : Seulement 1 ligne reçue !");
  console.log("Structure JSON complète:", JSON.stringify($json, null, 2));
}

return $json;
```

## 🔍 Vérification Rapide

### Test 1 : Vérifier les logs Django

Quand vous faites une requête, regardez les logs Django :

```
[query_nl] Envoi de 200 lignes à n8n pour analyse (dataset: player_stats_2024_2025_season)
[n8n] Analyse : envoi de 200 lignes (toutes les données disponibles)
[n8n] → Analyse POST http://... (rows=200, timeout=30s)
```

**Si vous voyez `rows=200`** → Django envoie bien toutes les données ✅

**Si vous voyez `rows=1`** → Le problème est dans Django (mais on vient de corriger ça)

### Test 2 : Vérifier dans n8n

Dans le workflow `Analyse2`, ajoutez un nœud "Code" juste après le webhook :

```javascript
// Afficher la structure complète
console.log("Structure JSON reçue:", JSON.stringify($json, null, 2));

// Compter les lignes
const rows = $json.rows || $json.body?.rows || [];
console.log(`Nombre de lignes: ${rows.length}`);

return $json;
```

**Si vous voyez `Nombre de lignes: 1`** → Le problème est dans la transmission des données entre workflows

**Si vous voyez `Nombre de lignes: 200`** → Le problème est dans le prompt ou l'LLM

## 🎯 Solution Complète pour Analyse2

### Structure du Payload Reçu par Analyse2

Django envoie ce payload au webhook `Analyse2` :

```json
{
  "question": "Renvoie la liste des joueurs avec leur nombre de buts...",
  "rows": [
    {"player_name": "Mohamed Salah", "Assists": 18},
    {"player_name": "Player 2", "Assists": 15},
    ...
  ],
  "chart_spec": {
    "type": "bar",
    "x": "player_name",
    "y": "Assists"
  },
  "total_rows": 200
}
```

### Exemple Complet de Nœud Code pour Analyse2

```javascript
// ============================================
// NŒUD CODE pour Analyse2 - Récupération des données
// ============================================

// Récupérer les données (essayer plusieurs chemins selon la config n8n)
const rows = $json.rows || $json.body?.rows || $input.item.json.rows || [];
const question = $json.question || $json.body?.question || "";
const chartSpec = $json.chart_spec || $json.body?.chart_spec || {};

// Log pour debug (IMPORTANT : vérifiez ces logs !)
console.log(`📊 Analyse2 : ${rows.length} lignes reçues`);
console.log(`Question: ${question}`);
console.log(`Chart spec:`, JSON.stringify(chartSpec));

// Vérification critique
if (rows.length === 0) {
  console.error("❌ ERREUR : Aucune ligne reçue !");
  console.log("Structure JSON complète:", JSON.stringify($json, null, 2));
  return {
    summary: "Aucune donnée disponible pour l'analyse.",
    text: "Le workflow n'a pas reçu de données à analyser. Vérifiez que le workflow AnalyseDonnees transmet bien les 'rows'."
  };
}

if (rows.length === 1) {
  console.warn(`⚠️ ATTENTION : Seulement 1 ligne reçue. Attendu : plusieurs lignes.`);
  console.log("Première ligne:", JSON.stringify(rows[0], null, 2));
}

// Construire le prompt avec TOUTES les données
const prompt = `Tu es un assistant expert en analyse de données et visualisation.

Question de l'utilisateur: ${question}

Données à analyser (${rows.length} lignes au total):
${JSON.stringify(rows, null, 2)}

Spécification du graphique:
${JSON.stringify(chartSpec, null, 2)}

Ta mission:
1️⃣ Analyser le sens des données fournies.
2️⃣ Identifier les tendances, valeurs extrêmes, comparaisons pertinentes.
3️⃣ Expliquer les observations principales en langage clair et synthétique.
4️⃣ Si les données sont trop limitées (moins de 3 points), renvoyer une courte explication.

Réponds UNIQUEMENT en JSON avec ce format exact:
{
  "summary": "... ta synthèse principale ...",
  "text": "... ton texte plus détaillé d'analyse (si pertinent) ..."
}

Ne reformule jamais la question ni ne répète le jeu de données.`;

return {
  prompt,
  rows_count: rows.length,
  question,
  chartSpec
};
```

## 📝 Checklist de Vérification

- [ ] Le workflow `AnalyseDonnees` ne fait PAS d'appel à `/preview`
- [ ] Le workflow `AnalyseDonnees` transmet bien les `rows` dans sa réponse
- [ ] Le workflow `Analyse2` lit les `rows` depuis `{{$json.rows}}` ou `{{$json.body.rows}}`
- [ ] Le prompt inclut bien les `rows` (pas juste `{{$json.prompt}}`)
- [ ] Les logs Django montrent `rows=200` (ou le nombre attendu)
- [ ] Les logs n8n montrent le bon nombre de lignes reçues

## 🚨 Erreur Commune

**❌ NE PAS FAIRE** :
```javascript
const prompt = `{{$json.prompt}}`;  // ← Ne contient pas les données rows !
```

**✅ À FAIRE** :
```javascript
const rows = $json.rows || $json.body?.rows || [];
const prompt = `... ${JSON.stringify(rows)} ...`;  // ← Inclure les données
```

