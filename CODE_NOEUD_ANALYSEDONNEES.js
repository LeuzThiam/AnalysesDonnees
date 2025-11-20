// ============================================
// CODE POUR LE NŒUD "Code" DANS AnalyseDonnees
// ============================================
// Ce nœud est placé APRÈS l'agent AI qui génère le SQL
// Il corrige le SQL si nécessaire et retourne le résultat

// Récupérer le SQL généré par l'agent AI
let sql = $json.sql || $json.body?.sql || $json.output?.sql || "";
const dataset = $json.body?.dataset || $json.dataset || $json.output?.dataset || "";
const question = $json.body?.question || $json.question || $json.output?.question || "";

console.log("📊 SQL généré par l'agent:", sql);
console.log("📊 Dataset:", dataset);
console.log("📊 Question:", question);

// CORRECTION : Si le SQL contient MAX()/MIN() sans GROUP BY, le corriger
if ((sql.includes("MAX(") || sql.includes("MIN(")) && !sql.includes("GROUP BY")) {
  console.warn("⚠️ PROBLÈME DÉTECTÉ : SQL avec MAX()/MIN() sans GROUP BY → ne renverra qu'1 ligne");
  console.warn("🔧 Correction automatique du SQL...");
  
  // Détecter la colonne à utiliser selon la question
  let colName = "Assists"; // Par défaut
  const questionLower = question.toLowerCase();
  
  if (questionLower.includes("passeur") || questionLower.includes("passes") || questionLower.includes("assist")) {
    colName = "Assists";
  } else if (questionLower.includes("but") || questionLower.includes("goal")) {
    colName = "Goals";
  } else {
    // Essayer d'extraire depuis le SQL
    const maxMatch = sql.match(/MAX\(["']?(\w+)["']?\)/i);
    const minMatch = sql.match(/MIN\(["']?(\w+)["']?\)/i);
    if (maxMatch) {
      colName = maxMatch[1];
    } else if (minMatch) {
      colName = minMatch[1];
    }
  }
  
  // Générer le SQL correct qui renvoie toutes les lignes
  sql = `SELECT player_name, ${colName}
FROM "${dataset}"
WHERE ${colName} > 0
ORDER BY ${colName} DESC
LIMIT 1000`;
  
  console.log("✅ SQL corrigé:", sql);
  
  // Mettre à jour le chart_spec si nécessaire
  if (!$json.chart_spec && !$json.output?.chart_spec) {
    $json.chart_spec = {
      type: "bar",
      x: "player_name",
      y: colName
    };
  }
}

// Mettre à jour le SQL dans l'objet JSON
if ($json.output) {
  $json.output.sql = sql;
} else if ($json.body) {
  $json.body.sql = sql;
} else {
  $json.sql = sql;
}

// Retourner le résultat avec le SQL corrigé
return [{
  summary: $json.text || $json.message || $json.output || $json.content,
  insight_source: "n8n_analysis",
  sql: sql, // SQL corrigé
  chart_spec: $json.chart_spec || $json.output?.chart_spec || null
}];

