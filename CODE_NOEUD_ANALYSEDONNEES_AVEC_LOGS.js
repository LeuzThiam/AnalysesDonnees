// ============================================
// CODE AVEC LOGS DÉTAILLÉS POUR DIAGNOSTIC
// ============================================
// Remplacez votre code actuel par celui-ci pour voir exactement ce qui se passe

let out = {};
let ds = "";

// 1. Récupérer la sortie texte du LLM
try {
  out = JSON.parse($json["text"]);
  console.log("📊 [ÉTAPE 1] SQL généré par le LLM:", out.sql);
  console.log("📊 [ÉTAPE 1] Structure complète:", JSON.stringify(out, null, 2));
} catch (e) {
  console.error("❌ [ÉTAPE 1] Erreur parsing JSON:", e);
  return [{ json: { error: "LLM output not JSON", raw: $json["text"] } }];
}

// 2. Récupérer le dataset depuis l'autre input (Merge)
try {
  const input1 = $item(1);
  if (input1 && typeof input1.json === "object") {
    ds = input1.json.body?.dataset ?? input1.json.dataset ?? "";
    console.log("📊 [ÉTAPE 2] Dataset récupéré:", ds);
  }
} catch (e) {
  console.warn("⚠️ [ÉTAPE 2] Erreur récupération dataset:", e);
  ds = "";
}

// 3. Remplacer le placeholder `dataset` par le vrai nom
if (out.sql && ds) {
  const sqlAvant = out.sql;
  out.sql = out.sql.replace(/\bdataset\b/gi, ds);
  if (sqlAvant !== out.sql) {
    console.log("📊 [ÉTAPE 3] SQL après remplacement 'dataset':", out.sql);
  } else {
    console.log("📊 [ÉTAPE 3] Pas de remplacement nécessaire");
  }
}

// 4. Détection et correction du SQL problématique
const sql = out.sql || "";
const hasMax = /MAX\s*\(/i.test(sql);
const hasMin = /MIN\s*\(/i.test(sql);
const hasGroupBy = /GROUP\s+BY/i.test(sql);

console.log("🔍 [ÉTAPE 4] Analyse du SQL:");
console.log("  - Contient MAX():", hasMax);
console.log("  - Contient MIN():", hasMin);
console.log("  - Contient GROUP BY:", hasGroupBy);

if (sql && (hasMax || hasMin) && !hasGroupBy) {
  console.warn("⚠️ [ÉTAPE 4] PROBLÈME DÉTECTÉ : MAX()/MIN() sans GROUP BY");
  
  // Extraire le nom de la table
  const fromMatch = sql.match(/FROM\s+["']?([^"'\s]+)["']?/i);
  const tableName = fromMatch ? fromMatch[1] : ds;
  console.log("  - Table extraite:", tableName);
  
  // Extraire la colonne depuis MAX(col) ou MIN(col)
  const aggMatch = sql.match(/(?:MAX|MIN)\s*\(\s*["']?([^"')]+)["']?\s*\)/i);
  const aggCol = aggMatch ? aggMatch[1].trim() : null;
  console.log("  - Colonne extraite:", aggCol);
  
  if (aggCol && tableName) {
    // Générer le SQL corrigé
    const sqlCorrige = `SELECT *
FROM "${tableName}"
WHERE "${aggCol}" IS NOT NULL
ORDER BY "${aggCol}" DESC
LIMIT 1000`;
    
    console.log("✅ [ÉTAPE 4] SQL AVANT correction:", sql);
    console.log("✅ [ÉTAPE 4] SQL APRÈS correction:", sqlCorrige);
    
    out.sql = sqlCorrige;
    
    // Mettre à jour le chart_spec si nécessaire
    if (!out.chart_spec) {
      out.chart_spec = {
        type: "bar",
        x: "auto",
        y: aggCol
      };
      console.log("📊 [ÉTAPE 4] chart_spec créé:", out.chart_spec);
    }
  } else if (tableName) {
    // Fallback
    const sqlFallback = `SELECT *
FROM "${tableName}"
LIMIT 1000`;
    console.warn("⚠️ [ÉTAPE 4] Fallback utilisé (colonne non détectée)");
    console.log("✅ [ÉTAPE 4] SQL fallback:", sqlFallback);
    out.sql = sqlFallback;
  } else {
    console.error("❌ [ÉTAPE 4] Impossible de corriger : table non trouvée");
  }
} else {
  console.log("✅ [ÉTAPE 4] SQL OK (pas de correction nécessaire)");
}

// 5. Retourner proprement
console.log("📤 [ÉTAPE 5] SQL FINAL renvoyé à Django:", out.sql);
console.log("📤 [ÉTAPE 5] Réponse complète:", JSON.stringify(out, null, 2));

return [{ json: out }];

