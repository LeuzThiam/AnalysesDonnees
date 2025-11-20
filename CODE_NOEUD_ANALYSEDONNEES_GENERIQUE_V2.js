// ============================================
// CODE GÉNÉRIQUE V2 - Plus Robuste
// ============================================
// Fonctionne avec n'importe quel dataset sans hardcoder de colonnes

// Récupérer les données
let sql = $json.sql || $json.body?.sql || $json.output?.sql || "";
const dataset = $json.body?.dataset || $json.dataset || $json.output?.dataset || "";
const question = $json.body?.question || $json.question || $json.output?.question || "";
const schema = $json.body?.schema || $json.schema || "";

console.log("📊 SQL original:", sql);

// CORRECTION : Si le SQL contient MAX()/MIN() sans GROUP BY
if ((sql.includes("MAX(") || sql.includes("MIN(")) && !sql.includes("GROUP BY")) {
  console.warn("⚠️ Correction : MAX()/MIN() sans GROUP BY détecté");
  
  // Extraire le nom de la table
  const fromMatch = sql.match(/FROM\s+["']?([^"'\s]+)["']?/i);
  const tableName = fromMatch ? fromMatch[1] : dataset;
  
  // Extraire la colonne depuis MAX(col) ou MIN(col)
  const aggMatch = sql.match(/(?:MAX|MIN)\(["']?([^"')]+)["']?\)/i);
  const aggCol = aggMatch ? aggMatch[1].trim() : null;
  
  if (aggCol && tableName) {
    // Générer un SQL qui renvoie toutes les lignes avec cette colonne
    // On utilise SELECT * pour éviter de hardcoder les noms de colonnes
    // et on filtre/trie sur la colonne d'agrégation
    sql = `SELECT *
FROM "${tableName}"
WHERE "${aggCol}" IS NOT NULL
ORDER BY "${aggCol}" DESC
LIMIT 1000`;
    
    console.log("✅ SQL corrigé (générique):", sql);
  } else {
    // Fallback : SELECT * avec LIMIT
    sql = `SELECT *
FROM "${tableName}"
LIMIT 1000`;
    console.log("✅ SQL corrigé (fallback):", sql);
  }
}

// Retourner le résultat
return [{
  summary: $json.text || $json.message || $json.output || $json.content,
  insight_source: "n8n_analysis",
  sql: sql
}];

