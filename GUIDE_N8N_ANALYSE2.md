# 🔧 Guide Complet - Correction du Workflow n8n Analyse2

## 📋 Structure du Workflow Analyse2

Votre workflow `Analyse2` doit avoir cette structure :

```
1. Webhook (reçoit les données de Django)
   ↓
2. Nœud Code (construit le prompt avec les données)
   ↓
3. Nœud AI Agent (utilise le prompt)
   ↓
4. Nœud Respond to Webhook (renvoie la réponse)
```

---

## ✅ Étape 1 : Ajouter un Nœud "Code" AVANT le Nœud "AI Agent"

### Configuration du Nœud Code

1. **Ajoutez un nœud "Code"** entre le Webhook et l'AI Agent
2. **Nommez-le** : "Construire Prompt avec Données"
3. **Collez ce code** :

```javascript
// Récupérer les données depuis le payload Django
const rows = $json.rows || $json.body?.rows || [];
const question = $json.question || $json.body?.question || "";
const chartSpec = $json.chart_spec || $json.body?.chart_spec || {};

// Log pour vérifier
console.log(`📊 Analyse2 : ${rows.length} lignes reçues`);

// Vérification
if (rows.length === 0) {
  return {
    summary: "Aucune donnée disponible pour l'analyse.",
    text: "Le workflow n'a pas reçu de données à analyser."
  };
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

// Retourner le prompt
return {
  prompt: prompt
};
```

---

## ✅ Étape 2 : Modifier le Nœud "AI Agent"

### Dans le champ "Prompt (User Message)"

**❌ REMPLACEZ** :
```
{{$json.prompt}}
```

**✅ PAR** :
```
{{$json.prompt}}
```

**⚠️ ATTENTION** : Le `$json.prompt` vient maintenant du nœud Code précédent, pas directement du webhook !

### Vérification

Le nœud AI Agent doit recevoir le prompt depuis le nœud Code, donc :
- **Input du nœud Code** : `$json` (depuis le Webhook)
- **Output du nœud Code** : `{ prompt: "..." }`
- **Input du nœud AI Agent** : `$json` (depuis le nœud Code)
- **Prompt dans AI Agent** : `{{$json.prompt}}`

---

## ✅ Étape 3 : Vérifier la Connexion des Nœuds

Assurez-vous que les nœuds sont connectés dans cet ordre :

```
Webhook → Code → AI Agent → Respond to Webhook
```

---

## 🔍 Test et Vérification

### Test 1 : Vérifier les Logs dans le Nœud Code

Après avoir exécuté le workflow, regardez les logs du nœud Code. Vous devriez voir :

```
📊 Analyse2 : 200 lignes reçues
```

**Si vous voyez `1 lignes reçues`** → Le problème est dans la transmission des données depuis Django ou le workflow AnalyseDonnees.

### Test 2 : Vérifier le Prompt Généré

Ajoutez temporairement un nœud "Set" après le nœud Code pour voir le prompt :

```javascript
// Dans un nœud Set ou Code de test
return {
  prompt_length: $json.prompt.length,
  prompt_preview: $json.prompt.substring(0, 500) + "..."
};
```

Vous devriez voir le prompt complet avec toutes les données `rows`.

---

## 🚨 Erreurs Courantes

### Erreur 1 : "rows is not defined"

**Cause** : Les données ne sont pas au bon endroit dans `$json`

**Solution** : Vérifiez la structure JSON reçue par le Webhook. Utilisez :
```javascript
console.log("Structure JSON:", JSON.stringify($json, null, 2));
```

### Erreur 2 : "Seulement 1 ligne reçue"

**Cause** : Le workflow `AnalyseDonnees` fait encore un appel à `/preview`

**Solution** : Vérifiez que `AnalyseDonnees` ne fait PAS d'appel HTTP à `/preview` ou `/all`. Les données doivent venir directement des résultats de la requête SQL.

### Erreur 3 : "prompt is undefined" dans AI Agent

**Cause** : Le nœud Code ne retourne pas `prompt` ou les nœuds ne sont pas bien connectés

**Solution** : Vérifiez que le nœud Code retourne bien `{ prompt: "..." }` et que l'AI Agent est connecté au nœud Code (pas directement au Webhook).

---

## 📝 Checklist Finale

- [ ] Nœud Code ajouté AVANT l'AI Agent
- [ ] Code copié dans le nœud Code
- [ ] Nœud AI Agent utilise `{{$json.prompt}}` (depuis le nœud Code)
- [ ] Les nœuds sont connectés : Webhook → Code → AI Agent → Respond
- [ ] Les logs montrent le bon nombre de lignes (200+ au lieu de 1)
- [ ] Le workflow AnalyseDonnees ne fait PAS d'appel à `/preview`

---

## 🎯 Résultat Attendu

Après ces modifications, quand vous exécutez une requête :

1. **Django envoie** : 200 lignes dans `rows`
2. **Nœud Code reçoit** : 200 lignes
3. **Nœud Code construit** : Un prompt avec toutes les 200 lignes
4. **AI Agent reçoit** : Le prompt complet avec toutes les données
5. **Analyse générée** : Une analyse complète sur tous les joueurs, pas juste un seul

---

## 💡 Astuce : Debug dans n8n

Pour voir exactement ce qui est reçu, ajoutez un nœud "Set" juste après le Webhook :

```javascript
// Nœud Set de debug
return {
  debug: {
    has_rows: !!$json.rows,
    rows_count: $json.rows?.length || 0,
    has_body: !!$json.body,
    body_rows_count: $json.body?.rows?.length || 0,
    all_keys: Object.keys($json)
  }
};
```

Cela vous montrera exactement où se trouvent les données dans votre structure JSON.

