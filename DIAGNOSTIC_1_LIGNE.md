# 🔍 Diagnostic - Pourquoi Seulement 1 Ligne Arrive à Analyse2

## ❌ Problème

Le webhook `Analyse2` reçoit seulement **1 ligne** dans `rows` :
```json
{
  "rows": [{"player_name": "Joachim Kayi-Sanda", "total_passes": 15}],
  "total_rows": 1
}
```

## 🔍 Points de Vérification

### 1️⃣ Vérifier le SQL Généré par le LLM dans AnalyseDonnees

Dans le workflow `AnalyseDonnees`, ajoutez un nœud **"Set"** ou **"Code"** APRÈS le nœud AI Agent pour logger le SQL :

```javascript
// Nœud Code : Logger le SQL généré
const sql = $json.sql || $json.body?.sql || "";
console.log("🔍 SQL généré par le LLM:", sql);

// Vérifier si c'est un SQL problématique
if (sql.includes("MAX(") || sql.includes("MIN(")) {
  if (!sql.includes("GROUP BY")) {
    console.error("❌ PROBLÈME : SQL avec MAX()/MIN() sans GROUP BY");
  } else {
    console.log("✅ SQL avec GROUP BY - OK");
  }
}

return $json;
```

**Résultat attendu** : Vous devriez voir dans les logs n8n le SQL généré.

### 2️⃣ Vérifier si le Code de Correction est Appliqué

Dans votre nœud Code (celui qui parse le JSON), ajoutez des logs :

```javascript
let out = {};
let ds = "";

// 1. Récupérer la sortie texte du LLM
try {
  out = JSON.parse($json["text"]);
  console.log("📊 SQL AVANT correction:", out.sql);
} catch (e) {
  return [{ json: { error: "LLM output not JSON", raw: $json["text"] } }];
}

// ... (votre code existant) ...

// 4. NOUVEAU : Correction automatique
if (out.sql && (out.sql.includes("MAX(") || out.sql.includes("MIN(")) && !out.sql.includes("GROUP BY")) {
  console.warn("⚠️ Correction : MAX()/MIN() sans GROUP BY détecté");
  
  // ... (code de correction) ...
  
  console.log("✅ SQL APRÈS correction:", out.sql);
}

return [{ json: out }];
```

**Résultat attendu** : Vous devriez voir dans les logs :
- `📊 SQL AVANT correction: SELECT ... MAX(...) ...`
- `⚠️ Correction : MAX()/MIN() sans GROUP BY détecté`
- `✅ SQL APRÈS correction: SELECT * FROM ...`

### 3️⃣ Vérifier le SQL Reçu par Django

Dans Django, regardez les logs quand vous faites une requête. Vous devriez voir :

```
[query_nl] Envoi de X lignes à n8n pour analyse (dataset: ...)
```

**Si vous voyez `Envoi de 1 lignes`** → Le problème est dans le SQL exécuté par Django.

**Si vous voyez `Envoi de 200 lignes`** → Le problème est dans la transmission entre Django et n8n.

### 4️⃣ Tester le SQL Directement dans Django

Créez un endpoint de test ou utilisez le shell Django :

```python
# Dans Django shell : python manage.py shell
from analytics.services.runners import run_sql_safe

# Testez le SQL que vous pensez être généré
sql_test = 'SELECT * FROM "player_stats_2024_2025_season" WHERE "Assists" IS NOT NULL ORDER BY "Assists" DESC LIMIT 1000'
rows = run_sql_safe(sql_test)
print(f"Nombre de lignes : {len(rows)}")
print(f"Premières lignes : {rows[:5]}")
```

**Résultat attendu** : Vous devriez voir 200+ lignes, pas 1.

### 5️⃣ Vérifier le SQL dans le Webhook AnalyseDonnees

Dans le workflow `AnalyseDonnees`, ajoutez un nœud **"Respond to Webhook"** et loggez ce qui est renvoyé :

```javascript
// Dans le nœud qui renvoie la réponse
const response = {
  sql: out.sql,
  chart_spec: out.chart_spec,
  summary: out.summary
};

console.log("📤 SQL renvoyé à Django:", response.sql);
console.log("📤 Réponse complète:", JSON.stringify(response, null, 2));

return response;
```

**Résultat attendu** : Le SQL renvoyé devrait être le SQL corrigé, pas le SQL original.

## 🎯 Solution par Étapes

### Étape 1 : Vérifier que le Code de Correction est Bien Appliqué

1. Ouvrez le workflow `AnalyseDonnees` dans n8n
2. Trouvez le nœud Code qui parse le JSON
3. Vérifiez qu'il contient bien le code de correction (section 4)
4. Ajoutez les logs comme indiqué ci-dessus
5. Testez une requête et regardez les logs n8n

### Étape 2 : Si le Code n'est Pas Appliqué

Si vous ne voyez pas les logs de correction, c'est que :
- Soit le code n'est pas dans le bon nœud
- Soit le SQL généré n'est pas détecté (format différent)

**Solution** : Vérifiez le format exact du SQL généré et adaptez la détection :

```javascript
// Détection plus robuste
const hasMax = /MAX\s*\(/i.test(out.sql);
const hasMin = /MIN\s*\(/i.test(out.sql);
const hasGroupBy = /GROUP\s+BY/i.test(out.sql);

if ((hasMax || hasMin) && !hasGroupBy) {
  // Correction...
}
```

### Étape 3 : Si le SQL est Corrigé mais Django Reçoit Toujours 1 Ligne

Si le SQL est bien corrigé dans n8n mais Django reçoit toujours 1 ligne, c'est que :
- Soit Django exécute un autre SQL (vérifiez les logs Django)
- Soit il y a un problème avec la transmission du SQL corrigé

**Solution** : Vérifiez dans les logs Django le SQL réellement exécuté :

```python
# Dans views.py, ligne 821, ajoutez un log :
logger.info(f"[query_nl] SQL à exécuter: {sql}")
rows = run_sql_safe(sql)
logger.info(f"[query_nl] Nombre de lignes retournées: {len(rows)}")
```

## 📋 Checklist de Diagnostic

- [ ] Le SQL généré par le LLM contient `MAX()` ou `MIN()` sans `GROUP BY`
- [ ] Le code de correction est bien dans le nœud Code de `AnalyseDonnees`
- [ ] Les logs n8n montrent que le SQL est corrigé
- [ ] Le SQL corrigé est bien renvoyé à Django (vérifier dans le nœud "Respond to Webhook")
- [ ] Django exécute bien le SQL corrigé (vérifier les logs Django)
- [ ] Le nombre de lignes retournées par Django est > 1 (vérifier les logs Django)
- [ ] Le webhook `Analyse2` reçoit bien toutes les lignes (vérifier les logs n8n)

## 🔧 Code de Correction Complet avec Logs

```javascript
let out = {};
let ds = "";

// 1. Récupérer la sortie texte du LLM
try {
  out = JSON.parse($json["text"]);
  console.log("📊 [1] SQL AVANT correction:", out.sql);
} catch (e) {
  return [{ json: { error: "LLM output not JSON", raw: $json["text"] } }];
}

// 2. Récupérer le dataset
try {
  const input1 = $item(1);
  if (input1 && typeof input1.json === "object") {
    ds = input1.json.body?.dataset ?? input1.json.dataset ?? "";
  }
} catch (e) {
  ds = "";
}

// 3. Remplacer le placeholder
if (out.sql && ds) {
  out.sql = out.sql.replace(/\bdataset\b/gi, ds);
  console.log("📊 [2] SQL après remplacement dataset:", out.sql);
}

// 4. Correction automatique
const hasMax = /MAX\s*\(/i.test(out.sql || "");
const hasMin = /MIN\s*\(/i.test(out.sql || "");
const hasGroupBy = /GROUP\s+BY/i.test(out.sql || "");

if (out.sql && (hasMax || hasMin) && !hasGroupBy) {
  console.warn("⚠️ [3] PROBLÈME DÉTECTÉ : MAX()/MIN() sans GROUP BY");
  
  const fromMatch = out.sql.match(/FROM\s+["']?([^"'\s]+)["']?/i);
  const tableName = fromMatch ? fromMatch[1] : ds;
  const aggMatch = out.sql.match(/(?:MAX|MIN)\(["']?([^"')]+)["']?\)/i);
  const aggCol = aggMatch ? aggMatch[1].trim() : null;
  
  if (aggCol && tableName) {
    out.sql = `SELECT *
FROM "${tableName}"
WHERE "${aggCol}" IS NOT NULL
ORDER BY "${aggCol}" DESC
LIMIT 1000`;
    console.log("✅ [4] SQL CORRIGÉ:", out.sql);
  }
} else {
  console.log("✅ [3] SQL OK (pas de correction nécessaire)");
}

// 5. Retourner
console.log("📤 [5] SQL FINAL renvoyé:", out.sql);
return [{ json: out }];
```

## 🎯 Action Immédiate

1. **Ajoutez les logs** dans votre nœud Code
2. **Testez une requête** et regardez les logs n8n
3. **Vérifiez** à quelle étape le SQL est limité à 1 ligne
4. **Corrigez** l'étape problématique

