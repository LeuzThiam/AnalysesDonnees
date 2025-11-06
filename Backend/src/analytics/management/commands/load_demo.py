from django.core.management.base import BaseCommand
from django.conf import settings
import duckdb
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random


class Command(BaseCommand):
    help = "Charge un dataset de demonstration dans DuckDB (table 'sales_demo' par defaut)."

    def add_arguments(self, parser):
        parser.add_argument("--rows", type=int, default=2000, help="Nombre de lignes a generer")
        parser.add_argument("--days", type=int, default=180, help="Nombre de jours d'historique")
        parser.add_argument("--table", type=str, default="sales_demo", help="Nom de la table cible")

    def handle(self, *args, **opts):
        rows = int(opts["rows"])
        days = int(opts["days"])
        table = str(opts["table"])

        self.stdout.write(self.style.NOTICE(f"Generation de {rows} lignes sur {days} jours -> table '{table}'"))

        # 1) Generer des donnees synthetiques (date, category, amount, customer_id)
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days)

        dates = pd.date_range(start=start_date, end=end_date, freq="D")
        categories = ["Electronics", "Fashion", "Home", "Sports", "Toys", "Grocery"]
        rng = np.random.default_rng(42)

        # Repartition des dates
        sample_dates = rng.choice(dates, size=rows, replace=True)

        # Categories avec biais leger (Electronics/Fashion plus frequentes)
        weights = np.array([0.22, 0.20, 0.18, 0.16, 0.12, 0.12])
        sample_categories = rng.choice(categories, size=rows, p=weights)

        # Montants positifs avec un peu d'heteroscedasticite
        base = {
            "Electronics": 120.0,
            "Fashion": 70.0,
            "Home": 90.0,
            "Sports": 60.0,
            "Toys": 40.0,
            "Grocery": 30.0,
        }
        amounts = []
        for c in sample_categories:
            noise = max(5.0, rng.normal(loc=0, scale=base[c] * 0.35))
            amounts.append(max(1.0, base[c] + noise))
        amounts = np.round(amounts, 2)

        customer_ids = rng.integers(low=1, high=500, size=rows)

        df = pd.DataFrame(
            {
                "date": pd.to_datetime(sample_dates).date,
                "category": sample_categories,
                "amount": amounts,
                "customer_id": customer_ids,
            }
        ).sort_values("date")

        # 2) Connexion DuckDB
        db_path = getattr(settings, "DUCKDB_PATH", str(settings.BASE_DIR / "data" / "insight.duckdb"))
        con = duckdb.connect(db_path)

        # 3) Ecrire la table (replace)
        con.register("df", df)
        con.execute(f"CREATE OR REPLACE TABLE {duckdb.identifier(table)} AS SELECT * FROM df;")

        # 4) Infos
        cnt = con.execute(f"SELECT COUNT(*) FROM {duckdb.identifier(table)};").fetchone()[0]
        self.stdout.write(self.style.SUCCESS(f"Table '{table}' chargee avec {cnt} lignes dans {db_path}"))

        # 5) Index ou stats eventuelles (facultatif)
        # DuckDB n'utilise pas d'index classiques; mais on peut materialiser des vues si besoin.
        # con.execute(f"CREATE OR REPLACE VIEW {table}_by_month AS SELECT date_trunc('month', date) AS m, SUM(amount) AS total FROM {table} GROUP BY 1;")
