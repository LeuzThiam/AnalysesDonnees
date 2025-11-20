# 📖 Guide Complet : Adapter le Workflow AnalyseDonnees dans n8n

## 🎯 Objectif

Corriger automatiquement le SQL généré par le LLM s'il contient `MAX()` ou `MIN()` sans `GROUP BY`, pour qu'il renvoie toutes les lignes au lieu d'une seule.

---

## 📋 Structure de Votre Workflow AnalyseDonnees

Votre workflow `AnalyseDonnees` doit ressembler à ceci :

```
[Webhook] → [Merge] → [AI Agent] → [Code] → [Respond to Webhook]
```

### Explication de chaque nœud :

1. **Webhook** : Reçoit la requête de Django (question, dataset, schema)
2. **Merge** : Combine les données du webhook avec d'autres données si nécessaire
3. **AI Agent** : Génère le SQL à partir de la question (c'est ici que le LLM crée le SQL)
4. **Code** : Parse le JSON et corrige le SQL si nécessaire ⭐ **C'EST ICI QU'IL FAUT MODIFIER**
5. **Respond to Webhook** : Renvoie le SQL à Django

---

## 🔧 Étape 1 : Trouver le Nœud "Code"

1. **Ouvrez n8n** dans votre navigateur
2. **Ouvrez le workflow** `AnalyseDonnees`
3. **Cherchez le nœud "Code"** qui se trouve **APRÈS** le nœud "AI Agent"
4. **Cliquez sur ce nœud** pour l'ouvrir

---

## 🔧 Étape 2 : Comprendre Votre Code Actuel

Votre code actuel fait ceci :

```javascript
let out = {};
let ds = "";

// 1. Parse le JSON de la sortie du LLM
try {
  out = JSON.parse($json["text"]);
} catch (e) {
  return [{ json: { error: "LLM output not JSON", raw: $json["text"] } }];
}

// 2. Récupère le dataset depuis l'autre input (Merge)
try {
  const input1 = $item(1);
  if (input1 && typeof input1.json === "object") {
    ds = input1.json.body?.dataset ?? input1.json.dataset ?? "";
  }
} catch (e) {
  ds = "";
}

// 3. Remplace le placeholder "dataset" par le vrai nom
if (out.sql && ds) {
  out.sql = out.sql.replace(/\bdataset\b/gi, ds);
}

// 4. Retourne le résultat
return [{ json: out }];
```

**Ce que fait ce code :**
- Prend la sortie du LLM (qui est un JSON stringifié dans `$json["text"]`)
- Parse ce JSON pour obtenir `out.sql`, `out.chart_spec`, etc.
- Récupère le nom du dataset depuis l'input Merge
- Remplace `dataset` par le vrai nom de la table dans le SQL
- Renvoie le résultat

---

## 🔧 Étape 3 : Ajouter la Correction du SQL

Vous devez **ajouter une nouvelle section** entre l'étape 3 et l'étape 4 (avant le `return`).

### Code Complet à Mettre dans le Nœud Code :

```javascript
let out = {};
let ds = "";

// 1. Récupérer la sortie texte du LLM
try {
  out = JSON.parse($json["text"]);   // parse le JSON
} catch (e) {
  return [{ json: { error: "LLM output not JSON", raw: $json["text"] } }];
}

// 2. Récupérer le dataset depuis l'autre input (Merge)
try {
  const input1 = $item(1);
  if (input1 && typeof input1.json === "object") {
    ds = input1.json.body?.dataset ?? input1.json.dataset ?? "";
  }
} catch (e) {
  ds = "";
}

// 3. Remplacer le placeholder `dataset` par le vrai nom
if (out.sql && ds) {
  out.sql = out.sql.replace(/\bdataset\b/gi, ds);
}

// 4. ⭐ NOUVEAU : Correction automatique du SQL si MAX()/MIN() sans GROUP BY
if (out.sql) {
  // Vérifier si le SQL contient MAX() ou MIN() sans GROUP BY
  const aMax = out.sql.includes("MAX(") || out.sql.includes("MAX (");
  const aMin = out.sql.includes("MIN(") || out.sql.includes("MIN (");
  const aGroupBy = out.sql.includes("GROUP BY");
  
  if ((aMax || aMin) && !aGroupBy) {
    // PROBLÈME DÉTECTÉ : Le SQL ne renverra qu'une seule ligne
    
    // Extraire le nom de la table depuis le SQL
    // Exemple : FROM "player_stats_2024_2025_season"
    const matchFrom = out.sql.match(/FROM\s+["']?([^"'\s]+)["']?/i);
    const nomTable = matchFrom ? matchFrom[1] : ds;
    
    // Extraire le nom de la colonne depuis MAX(colonne) ou MIN(colonne)
    // Exemple : MAX(Assists) → Assists
    const matchCol = out.sql.match(/(?:MAX|MIN)\s*\(\s*["']?([^"')]+)["']?\s*\)/i);
    const nomColonne = matchCol ? matchCol[1].trim() : null;
    
    if (nomColonne && nomTable) {
      // Générer le SQL corrigé qui renvoie toutes les lignes
      out.sql = `SELECT *
FROM "${nomTable}"
WHERE "${nomColonne}" IS NOT NULL
ORDER BY "${nomColonne}" DESC
LIMIT 1000`;
    } else if (nomTable) {
      // Si on ne peut pas extraire la colonne, on fait un SELECT * simple
      out.sql = `SELECT *
FROM "${nomTable}"
LIMIT 1000`;
    }
  }
}

// 5. Retourner proprement
return [{ json: out }];
```

---

## 📝 Explication Détaillée de la Section 4

### Pourquoi cette correction ?

Quand le LLM génère :
```sql
SELECT player_name, MAX(Assists) FROM "player_stats_2024_2025_season"
```

Cela renvoie **1 seule ligne** (la valeur maximale).

On veut plutôt :
```sql
SELECT * FROM "player_stats_2024_2025_season" WHERE "Assists" IS NOT NULL ORDER BY "Assists" DESC LIMIT 1000
```

Cela renvoie **toutes les lignes** triées par Assists décroissant.

### Comment ça fonctionne ?

1. **Détection** : On vérifie si le SQL contient `MAX(` ou `MIN(` mais pas `GROUP BY`
2. **Extraction** : On extrait le nom de la table depuis `FROM "table"`
3. **Extraction** : On extrait le nom de la colonne depuis `MAX(colonne)` ou `MIN(colonne)`
4. **Correction** : On génère un nouveau SQL avec `SELECT *` et `ORDER BY`

---

## 🔍 Comment Vérifier que Ça Fonctionne

### Option 1 : Ajouter des Logs Temporaires

Ajoutez ces lignes dans la section 4 pour voir ce qui se passe :

```javascript
// 4. Correction automatique
if (out.sql) {
  const aMax = out.sql.includes("MAX(") || out.sql.includes("MAX (");
  const aMin = out.sql.includes("MIN(") || out.sql.includes("MIN (");
  const aGroupBy = out.sql.includes("GROUP BY");
  
  console.log("SQL original:", out.sql);
  console.log("Contient MAX:", aMax);
  console.log("Contient MIN:", aMin);
  console.log("Contient GROUP BY:", aGroupBy);
  
  if ((aMax || aMin) && !aGroupBy) {
    console.log("⚠️ PROBLÈME DÉTECTÉ - Correction en cours...");
    
    // ... (code de correction) ...
    
    console.log("✅ SQL corrigé:", out.sql);
  }
}
```

Puis regardez les **logs n8n** (onglet "Executions" → cliquez sur une exécution → onglet "Logs").

### Option 2 : Vérifier dans Django

Après avoir modifié le code, testez une requête et regardez les **logs Django** :

```
[query_nl] Envoi de 200 lignes à n8n pour analyse
```

Si vous voyez `Envoi de 1 lignes`, c'est que la correction n'a pas fonctionné.

---

## 🎯 Résumé : Ce Qu'il Faut Faire

1. ✅ Ouvrir le workflow `AnalyseDonnees` dans n8n
2. ✅ Trouver le nœud "Code" (après le nœud "AI Agent")
3. ✅ Ouvrir ce nœud
4. ✅ **Remplacer** votre code actuel par le code complet ci-dessus
5. ✅ **Sauvegarder** le workflow
6. ✅ **Tester** avec une requête comme "qui est le meilleur passeurs"
7. ✅ **Vérifier** dans les logs Django que vous recevez 200+ lignes

---

## ❓ Questions Fréquentes

### Q : Où exactement dois-je mettre ce code ?
**R :** Dans le nœud "Code" qui se trouve **après** le nœud "AI Agent" et **avant** le nœud "Respond to Webhook".

### Q : Je ne trouve pas le nœud "Code"
**R :** Il se peut qu'il s'appelle "Function" ou "Set". Cherchez un nœud qui parse le JSON du LLM.

### Q : Mon code est différent, dois-je tout remplacer ?
**R :** Non, gardez votre code existant et ajoutez seulement la section 4 (correction automatique) avant le `return`.

### Q : Comment savoir si ça fonctionne ?
**R :** Testez une requête et vérifiez dans les logs Django : `[query_nl] Envoi de X lignes`. Si X > 1, ça fonctionne !

### Q : Le SQL corrigé ne fonctionne pas
**R :** Vérifiez que le nom de la table et de la colonne sont bien extraits. Ajoutez les logs pour voir ce qui est extrait.

---

## 🆘 Si Ça Ne Fonctionne Pas

1. **Vérifiez les logs n8n** : Y a-t-il des erreurs ?
2. **Vérifiez le format du SQL** : Le LLM génère-t-il bien du SQL avec MAX()/MIN() ?
3. **Testez le SQL manuellement** : Copiez le SQL généré et testez-le directement dans DuckDB
4. **Vérifiez les logs Django** : Combien de lignes Django envoie-t-il à n8n ?

---

## 📸 Structure Visuelle du Workflow

```
┌──────────┐
│ Webhook  │  ← Reçoit : {question, dataset, schema}
└────┬─────┘
     │
     ▼
┌──────────┐
│  Merge   │  ← Combine les données
└────┬─────┘
     │
     ▼
┌──────────┐
│AI Agent  │  ← Génère le SQL (peut générer MAX() sans GROUP BY)
└────┬─────┘
     │
     ▼
┌──────────┐
│  Code    │  ← ⭐ ICI : Parse JSON + Corrige SQL si nécessaire
└────┬─────┘
     │
     ▼
┌──────────┐
│ Respond  │  ← Renvoie le SQL corrigé à Django
└──────────┘
```

---

## ✅ Checklist Finale

- [ ] J'ai trouvé le nœud "Code" dans mon workflow AnalyseDonnees
- [ ] J'ai ouvert ce nœud
- [ ] J'ai copié le code complet ci-dessus
- [ ] J'ai remplacé mon code actuel par le nouveau code
- [ ] J'ai sauvegardé le workflow
- [ ] J'ai testé avec une requête
- [ ] J'ai vérifié les logs Django : `Envoi de X lignes` avec X > 1

Si toutes les cases sont cochées, ça devrait fonctionner ! 🎉

