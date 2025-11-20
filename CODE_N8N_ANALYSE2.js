// ============================================
// CODE POUR LE NŒUD "Code" DANS LE WORKFLOW Analyse2
// ============================================
// Placez ce code dans un nœud "Code" AVANT le nœud "AI Agent"

// Récupérer les données depuis le payload Django
// Les données sont dans $json.body car c'est un webhook POST
const rows = $json.body?.rows || $json.rows || [];
const question = $json.body?.question || $json.question || "";
const chartSpec = $json.body?.chart_spec || $json.chart_spec || {};
const totalRows = $json.body?.total_rows || rows.length;

// Log pour vérifier (visible dans les logs n8n)
console.log(`📊 Analyse2 : ${rows.length} lignes reçues (total_rows: ${totalRows})`);
console.log(`Question: ${question}`);
if (rows.length === 1) {
  console.warn(`⚠️ PROBLÈME : Seulement 1 ligne reçue ! Le SQL généré ne renvoie qu'une ligne.`);
  console.log(`Première ligne:`, JSON.stringify(rows[0], null, 2));
}

// Vérification critique
if (rows.length === 0) {
  console.error("❌ ERREUR : Aucune ligne reçue !");
  console.log("Structure JSON complète:", JSON.stringify($json, null, 2));
  return {
    summary: "Aucune donnée disponible pour l'analyse.",
    text: "Le workflow n'a pas reçu de données à analyser."
  };
}

if (rows.length === 1) {
  console.warn(`⚠️ ATTENTION : Seulement 1 ligne reçue. Attendu : plusieurs lignes.`);
}

// Construire le prompt avec TOUTES les données
const prompt = `Tu es un assistant expert en analyse de données et visualisation.

Ton rôle est d'interpréter des résultats de requêtes SQL ou de tableaux statistiques.

Tu reçois :
- une question d'utilisateur (question naturelle)
- un tableau de résultats (rows)
- une spécification de graphique (chart_spec) contenant les axes x/y et le type de graphique.

Question de l'utilisateur: ${question}

Données à analyser (${rows.length} lignes au total):
${JSON.stringify(rows, null, 2)}

Spécification du graphique:
${JSON.stringify(chartSpec, null, 2)}

Ta mission :
1️⃣ Analyser le sens des données fournies.
2️⃣ Identifier les tendances, valeurs extrêmes, comparaisons pertinentes.
3️⃣ Expliquer les observations principales en langage clair et synthétique.
4️⃣ Si les données sont trop limitées (moins de 3 points), renvoyer une courte explication comme "Je ne peux pas tirer de conclusion significative avec un seul point de données."

Réponds **uniquement** en JSON avec ce format exact :

{
  "summary": "… ta synthèse principale …",
  "text": "… ton texte plus détaillé d'analyse (si pertinent) …"
}

Ne reformule jamais la question ni ne répète le jeu de données.`;

// Retourner le prompt pour le nœud AI Agent
return {
  prompt: prompt,
  rows_count: rows.length,
  question: question,
  chart_spec: chartSpec
};

