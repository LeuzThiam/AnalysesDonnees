# 🔧 Correction du Workflow n8n - Utilisation des Données Complètes

## ❌ Problème Identifié

Le workflow `AnalyseDonnees` utilise la route `/preview` qui ne renvoie qu'un **échantillon limité** (10-20 lignes) au lieu de toutes les données.

**Résultat** : L'analyse n8n ne voit qu'un seul joueur au lieu de tous les joueurs du dataset.

## ✅ Solution

### Option 1 : Utiliser la nouvelle route `/all` (Recommandé)

J'ai créé une nouvelle route qui renvoie **toutes les données** d'un dataset :

```
GET /api/analytics/datasets/{dataset}/all
```

**Modification dans n8n :**

Dans le workflow `AnalyseDonnees`, remplacez :

```
❌ http://127.0.0.1:8000/api/analytics/datasets/{{$json["body"]["dataset"]}}/preview
```

Par :

```
✅ http://127.0.0.1:8000/api/analytics/datasets/{{$json["body"]["dataset"]}}/all
```

**⚠️ Attention** : Cette route peut être lente pour les très gros datasets (> 100 000 lignes).

---

### Option 2 : Utiliser les résultats de la requête SQL directement (Meilleure solution)

**Le problème actuel** : Le workflow fait un appel séparé à `/preview` alors que les résultats de la requête SQL sont déjà disponibles.

**Solution recommandée** : Modifier le workflow pour utiliser directement les résultats de la requête SQL générée.

#### Dans le workflow `AnalyseDonnees` :

1. **Après avoir généré le SQL**, au lieu de faire un appel à `/preview`, utilisez directement les résultats de la requête SQL.

2. **Si vous devez faire un appel HTTP**, utilisez plutôt :

```
POST http://127.0.0.1:8000/api/analytics/query/sql
Body: {
  "sql": "{{$json['sql']}}"
}
```

Cette route exécute le SQL et renvoie **tous les résultats** (jusqu'à 1000 lignes par défaut, mais vous pouvez ajuster).

---

### Option 3 : Passer les résultats directement au workflow d'analyse

**La meilleure approche** : Le workflow `AnalyseDonnees` devrait passer les résultats de la requête SQL directement au workflow `Analyse2`, sans faire d'appel HTTP supplémentaire.

Dans n8n, après avoir exécuté la requête SQL, vous pouvez :
1. Stocker les résultats dans une variable
2. Les passer directement au workflow d'analyse via un webhook interne ou en les incluant dans la réponse

---

## 📋 Routes API Disponibles

### 1. `/api/analytics/datasets/{table}/preview`
- **Limite** : 10-1000 lignes (paramètre `?limit=X`)
- **Usage** : Pour un aperçu rapide
- **⚠️ Ne pas utiliser pour l'analyse complète**

### 2. `/api/analytics/datasets/{table}/all` (NOUVEAU)
- **Limite** : Aucune (toutes les données)
- **Usage** : Pour récupérer toutes les données d'un dataset
- **⚠️ Peut être lent pour les gros datasets**

### 3. `/api/analytics/query/sql`
- **Limite** : 1000 lignes par défaut (ajustable)
- **Usage** : Pour exécuter une requête SQL et obtenir les résultats
- **✅ Recommandé** : Utilisez cette route avec le SQL généré

### 4. `/api/analytics/query/nl`
- **Usage** : Pour exécuter une requête en langage naturel
- **Retourne** : Les résultats complets de la requête SQL générée
- **✅ Idéal** : Cette route fait tout automatiquement et renvoie les résultats complets

---

## 🎯 Recommandation Finale

**Pour le workflow `AnalyseDonnees` :**

Au lieu de :
```
❌ GET /api/analytics/datasets/{dataset}/preview
```

Utilisez l'une de ces options :

1. **Option A** (Simple) :
   ```
   ✅ GET /api/analytics/datasets/{dataset}/all
   ```

2. **Option B** (Meilleure) :
   ```
   ✅ POST /api/analytics/query/sql
   Body: { "sql": "{{$json['sql']}}" }
   ```

3. **Option C** (Idéale) :
   - Ne pas faire d'appel HTTP supplémentaire
   - Utiliser directement les résultats de la requête SQL dans le workflow
   - Passer ces résultats au workflow d'analyse

---

## 🔍 Vérification

Pour vérifier que ça fonctionne :

1. Testez la nouvelle route :
   ```bash
   curl http://127.0.0.1:8000/api/analytics/datasets/ton_dataset/all
   ```

2. Vérifiez le nombre de lignes retournées :
   ```json
   {
     "table": "ton_dataset",
     "rows": [...],
     "count": 200  // ← Devrait être le nombre total de joueurs
   }
   ```

3. Si vous voyez `"count": 200` au lieu de `"count": 1`, alors le problème est résolu ! ✅

---

## 📝 Note Importante

Le workflow `Analyse2` reçoit les données via `analyze_result()` dans Django. 

**✅ Correction appliquée** : La limite a été augmentée de 200 à **5000 lignes** par défaut.

Si vous avez besoin de plus de données, vous pouvez :

1. **Configurer via variable d'environnement** (recommandé) :
   ```bash
   # Dans Backend/.env
   N8N_ANALYSE_MAX_ROWS=10000  # ou plus selon vos besoins
   ```

2. **Vérifier les logs Django** pour voir combien de lignes sont envoyées :
   ```
   [n8n] Analyse : envoi de X lignes sur Y disponibles
   ```

3. **Important** : Le workflow `AnalyseDonnees` ne doit PAS faire d'appel HTTP séparé à `/preview` ou `/all`. Les données sont déjà disponibles dans les résultats de la requête SQL et sont automatiquement envoyées au workflow d'analyse.

## 🔍 Vérification du Problème

Si vous voyez toujours "une seule entrée" dans l'analyse, vérifiez :

1. **Les logs Django** : Regardez combien de lignes sont envoyées à n8n
   ```
   [query_nl] Envoi de X lignes à n8n pour analyse
   [n8n] Analyse : envoi de X lignes sur Y disponibles
   ```

2. **Le workflow n8n `AnalyseDonnees`** : Assurez-vous qu'il n'utilise PAS `/preview` ou `/all` pour récupérer les données. Les données doivent venir directement des résultats de la requête SQL.

3. **Le workflow n8n `Analyse2`** : Vérifiez qu'il utilise bien le champ `rows` du payload reçu, et non pas un appel HTTP séparé.

