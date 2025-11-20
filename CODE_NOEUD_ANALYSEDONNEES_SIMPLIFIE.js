// ============================================
// CODE POUR VOTRE NŒUD "Code" DANS AnalyseDonnees
// ============================================
// Remplacez votre code actuel par celui-ci

// Récupérer le SQL généré par l'agent AI
let sql = $json.sql || $json.body?.sql || $json.output?.sql || "";
const dataset = $json.body?.dataset || $json.dataset || $json.output?.dataset || "";
const question = $json.body?.question || $json.question || $json.output?.question || "";

// CORRECTION : Si le SQL contient MAX()/MIN() sans GROUP BY, le corriger
if ((sql.includes("MAX(") || sql.includes("MIN(")) && !sql.includes("GROUP BY")) {
  console.warn("⚠️ SQL avec MAX()/MIN() sans GROUP BY → correction automatique");
  
  // Détecter la colonne selon la question
  let colName = "Assists";
  const q = question.toLowerCase();
  if (q.includes("passeur") || q.includes("passes") || q.includes("assist")) {
    colName = "Assists";
  } else if (q.includes("but") || q.includes("goal")) {
    colName = "Goals";
  } else {
    // Extraire depuis le SQL
    const match = sql.match(/MAX\(["']?(\w+)["']?\)|MIN\(["']?(\w+)["']?\)/i);
    if (match) colName = match[1] || match[2];
  }
  
  // Générer le SQL correct
  sql = `SELECT player_name, ${colName}
FROM "${dataset}"
WHERE ${colName} > 0
ORDER BY ${colName} DESC
LIMIT 1000`;
  
  console.log("✅ SQL corrigé:", sql);
}

// Retourner le résultat (même format que votre code actuel)
return [{
  summary: $json.text || $json.message || $json.output || $json.content,
  insight_source: "n8n_analysis",
  sql: sql  // SQL corrigé si nécessaire
}];

