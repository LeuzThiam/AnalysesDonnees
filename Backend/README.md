# AnalyseDesDonnees

Plateforme d'analyse de données **Django + DuckDB** avec intégrations **n8n** (NL→SQL/plan).

## 📦 Stack
- **Backend** : Django 5, DRF, CORS
- **Data** : DuckDB (fichier), Pandas
- **Auth** : JWT (SimpleJWT)
- **Intégrations** : n8n (optionnel)
- **Tests** : pytest (optionnel)

## 🚀 Démarrage rapide

```bash
python -m venv .venv
# Windows: .\.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

pip install -r requirements.txt

# variables d'env de dev
cp .env.example .env

# migrations + run
python src/manage.py migrate
python src/manage.py runserver 0.0.0.0:8000
