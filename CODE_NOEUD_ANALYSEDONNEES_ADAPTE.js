// ============================================
// CODE ADAPTÉ - Basé sur votre code existant
// ============================================
// Ajoute la correction SQL tout en gardant votre logique

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

// 4. NOUVEAU : Correction automatique du SQL si MAX()/MIN() sans GROUP BY
if (out.sql && (out.sql.includes("MAX(") || out.sql.includes("MIN(")) && !out.sql.includes("GROUP BY")) {
  console.warn("⚠️ Correction : MAX()/MIN() sans GROUP BY détecté");
  
  // Extraire le nom de la table (déjà remplacé par le vrai nom de dataset)
  const fromMatch = out.sql.match(/FROM\s+["']?([^"'\s]+)["']?/i);
  const tableName = fromMatch ? fromMatch[1] : ds;
  
  // Extraire la colonne depuis MAX(col) ou MIN(col)
  const aggMatch = out.sql.match(/(?:MAX|MIN)\(["']?([^"')]+)["']?\)/i);
  const aggCol = aggMatch ? aggMatch[1].trim() : null;
  
  if (aggCol && tableName) {
    // Générer un SQL générique qui renvoie toutes les lignes
    // SELECT * pour éviter de hardcoder les noms de colonnes
    out.sql = `SELECT *
FROM "${tableName}"
WHERE "${aggCol}" IS NOT NULL
ORDER BY "${aggCol}" DESC
LIMIT 1000`;
    
    console.log("✅ SQL corrigé (générique):", out.sql);
    
    // Mettre à jour le chart_spec si nécessaire
    if (!out.chart_spec) {
      out.chart_spec = {
        type: "bar",
        x: "auto", // Sera détecté automatiquement
        y: aggCol
      };
    }
  } else if (tableName) {
    // Fallback : SELECT * avec LIMIT
    out.sql = `SELECT *
FROM "${tableName}"
LIMIT 1000`;
    console.log("✅ SQL corrigé (fallback):", out.sql);
  }
}

// 5. Retourner proprement
return [{ json: out }];

