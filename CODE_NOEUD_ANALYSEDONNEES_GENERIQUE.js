// ============================================
// CODE GÉNÉRIQUE POUR N'IMPORTE QUEL DATASET
// ============================================
// Ce code fonctionne avec n'importe quel jeu de données, pas seulement le football

// Récupérer les données
let sql = $json.sql || $json.body?.sql || $json.output?.sql || "";
const dataset = $json.body?.dataset || $json.dataset || $json.output?.dataset || "";
const question = $json.body?.question || $json.question || $json.output?.question || "";
const schema = $json.body?.schema || $json.schema || "";

console.log("📊 SQL généré:", sql);
console.log("📊 Dataset:", dataset);
console.log("📊 Schema disponible:", schema ? "Oui" : "Non");

// CORRECTION : Si le SQL contient MAX()/MIN() sans GROUP BY, le corriger
if ((sql.includes("MAX(") || sql.includes("MIN(")) && !sql.includes("GROUP BY")) {
  console.warn("⚠️ SQL avec MAX()/MIN() sans GROUP BY → correction automatique");
  
  // Extraire les informations depuis le SQL original
  const fromMatch = sql.match(/FROM\s+["']?([^"'\s]+)["']?/i);
  const tableName = fromMatch ? fromMatch[1] : dataset;
  
  // Extraire la colonne depuis MAX() ou MIN()
  const maxMatch = sql.match(/MAX\(["']?([^"')]+)["']?\)/i);
  const minMatch = sql.match(/MIN\(["']?([^"')]+)["']?\)/i);
  const aggCol = (maxMatch ? maxMatch[1] : (minMatch ? minMatch[1] : null));
  
  // Essayer de trouver une colonne catégorielle (ID, nom, etc.)
  let catCol = null;
  
  // Méthode 1 : Chercher dans le SELECT original
  const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
  if (selectMatch) {
    const selectPart = selectMatch[1];
    // Chercher des colonnes qui ne sont pas des fonctions d'agrégation
    const colMatches = selectPart.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g);
    if (colMatches) {
      const sqlKeywords = ['MAX', 'MIN', 'SUM', 'AVG', 'COUNT', 'AS', 'FROM', 'SELECT'];
      catCol = colMatches.find(col => !sqlKeywords.includes(col.toUpperCase()));
    }
  }
  
  // Méthode 2 : Utiliser le schéma si disponible
  if (!catCol && schema) {
    // Le schéma est généralement une chaîne avec les colonnes
    // Format possible : "column_name | type" ou juste les noms de colonnes
    const schemaLines = schema.split('\n');
    for (const line of schemaLines) {
      const parts = line.split('|');
      if (parts.length > 0) {
        const colName = parts[0].trim();
        // Ignorer les colonnes numériques et les colonnes d'agrégation
        if (colName && colName !== aggCol && !colName.match(/^\d+$/)) {
          // Préférer les colonnes qui ressemblent à des identifiants ou noms
          if (colName.toLowerCase().includes('id') || 
              colName.toLowerCase().includes('name') || 
              colName.toLowerCase().includes('nom') ||
              colName.toLowerCase().includes('label') ||
              colName.toLowerCase().includes('libelle')) {
            catCol = colName;
            break;
          }
        }
      }
    }
    // Si pas trouvé, prendre la première colonne non numérique
    if (!catCol && schemaLines.length > 0) {
      for (const line of schemaLines) {
        const parts = line.split('|');
        if (parts.length > 0) {
          const colName = parts[0].trim();
          if (colName && colName !== aggCol) {
            catCol = colName;
            break;
          }
        }
      }
    }
  }
  
  // Méthode 3 : Si toujours pas trouvé, utiliser des noms génériques communs
  if (!catCol) {
    const commonNames = ['id', 'name', 'nom', 'label', 'libelle', 'categorie', 'category', 'type'];
    // On ne peut pas les utiliser directement, mais on peut essayer de les deviner
    // Pour l'instant, on va utiliser la première colonne non agrégée trouvée
    catCol = 'id'; // Par défaut, mais ce sera probablement remplacé
  }
  
  // Si on a trouvé une colonne d'agrégation mais pas de colonne catégorielle
  // On va générer un SQL qui sélectionne toutes les colonnes pertinentes
  if (aggCol && catCol) {
    // Générer le SQL correct
    sql = `SELECT "${catCol}", "${aggCol}"
FROM "${tableName}"
WHERE "${aggCol}" IS NOT NULL AND "${aggCol}" > 0
ORDER BY "${aggCol}" DESC
LIMIT 1000`;
  } else if (aggCol) {
    // Si on n'a pas de colonne catégorielle, on sélectionne juste la colonne d'agrégation
    // et on essaie de trouver une colonne ID ou similaire
    sql = `SELECT *
FROM "${tableName}"
WHERE "${aggCol}" IS NOT NULL AND "${aggCol}" > 0
ORDER BY "${aggCol}" DESC
LIMIT 1000`;
  } else {
    // Si on ne peut pas déterminer, on génère un SELECT * avec ORDER BY sur la première colonne numérique
    sql = `SELECT *
FROM "${tableName}"
ORDER BY 1 DESC
LIMIT 1000`;
  }
  
  console.log("✅ SQL corrigé:", sql);
}

// Retourner le résultat
return [{
  summary: $json.text || $json.message || $json.output || $json.content,
  insight_source: "n8n_analysis",
  sql: sql  // SQL corrigé si nécessaire
}];

