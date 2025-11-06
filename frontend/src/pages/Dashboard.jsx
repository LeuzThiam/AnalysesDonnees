import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from "recharts";

/** ====== CONFIG API ====== **/
const API_URL  = (import.meta.env.VITE_API_URL  || "http://127.0.0.1:8000").trim();
const API_BASE = (import.meta.env.VITE_API_BASE || "/api").trim();
const BASE     = `${API_URL}${API_BASE}`.replace(/\/+$/,"");

/** ====== HELPERS - Typage heuristique ====== **/
const isNumberLike = (v) => v !== null && v !== "" && !isNaN(Number(v));
const looksLikeDateKey = (k="") => /^(date|day|dt|ts|time|timestamp)$/i.test(k);
const looksLikeCatKey  = (k="") => /^(cat|category|label|type|name|segment|group)$/i.test(k);
const nice = (x) => x ?? ""; // small nil-safe

/** Détecte le “meilleur” schéma à partir d’un échantillon de lignes */
function inferSchema(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { kind: "empty" };

  const cols = Object.keys(rows[0] || {});
  // 1) Une colonne date + ≥1 colonnes numériques  => timeseries
  const dateCol = cols.find(c => looksLikeDateKey(c)) ||
                  cols.find(c => rows.some(r => String(r[c]).match(/^\d{4}-\d{2}-\d{2}/)));
  const numericCols = cols.filter(c => rows.some(r => isNumberLike(r[c])));

  if (dateCol && numericCols.length >= 1) {
    const valueCol = numericCols.find(c => /^(total|sum|amount|value|count|y)$/i.test(c)) || numericCols[0];
    return { kind: "timeseries", x: dateCol, y: valueCol };
  }

  // 2) Une colonne catégorielle + une numérique  => bar chart
  const catCol = cols.find(looksLikeCatKey) ||
                 cols.find(c => !rows.every(r => isNumberLike(r[c])) && c !== dateCol);
  if (catCol && numericCols.length >= 1) {
    const valueCol = numericCols.find(c => /^(total|sum|amount|value|count|y)$/i.test(c)) || numericCols[0];
    return { kind: "bar", x: catCol, y: valueCol };
  }

  // 3) Une seule numérique  => histogramme-like (barres par index)
  if (numericCols.length === 1) {
    return { kind: "bar_index", y: numericCols[0] };
  }

  // 4) Plusieurs numériques + pas de mieux  => pie si ≤ 8 lignes + 1 num + 1 cat
  if (catCol && numericCols.length === 1 && rows.length <= 8) {
    return { kind: "pie", label: catCol, value: numericCols[0] };
  }

  // 5) fallback tableau
  return { kind: "table", columns: cols };
}

/** Formate les lignes selon le schéma choisi */
function projectData(rows, schema) {
  if (schema.kind === "timeseries") {
    const { x, y } = schema;
    return rows.map(r => ({ name: nice(r[x]), value: Number(r[y] ?? 0) }));
  }
  if (schema.kind === "bar") {
    const { x, y } = schema;
    return rows.map(r => ({ name: String(r[x]), value: Number(r[y] ?? 0) }));
  }
  if (schema.kind === "bar_index") {
    const { y } = schema;
    return rows.map((r, i) => ({ name: String(i + 1), value: Number(r[y] ?? 0) }));
  }
  if (schema.kind === "pie") {
    const { label, value } = schema;
    return rows.map(r => ({ name: String(r[label]), value: Number(r[value] ?? 0) }));
  }
  return rows;
}

/** ====== AutoChart - choisit le chart en fonction des données ====== **/
function AutoChart({ rows }) {
  const schema = useMemo(() => inferSchema(rows), [rows]);
  const data   = useMemo(() => projectData(rows, schema), [rows, schema]);

  if (schema.kind === "empty") {
    return <div className="text-muted">Aucune donnée.</div>;
  }

  if (schema.kind === "timeseries") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="value" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (schema.kind === "bar" || schema.kind === "bar_index") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (schema.kind === "pie") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Tooltip />
          <Legend />
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={120} label>
            {data.map((_, i) => <Cell key={i} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // Fallback: table
  const cols = Object.keys(rows[0] || {});
  return (
    <div className="table-responsive">
      <table className="table table-sm">
        <thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.slice(0, 50).map((r, i) => (
            <tr key={i}>
              {cols.map(c => <td key={c}>{String(r[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 50 && <div className="text-muted small">… {rows.length - 50} lignes non affichées</div>}
    </div>
  );
}

/** ====== Dashboard page ====== **/
export default function Dashboard() {
  const [sp] = useSearchParams();
  const table = (sp.get("table") || "").trim();

  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState("");
  const [rows, setRows]   = useState(null);  // lignes prêtes à visualiser
  const [sql, setSql]     = useState("");

  // Si table fournie: on tente 1) timeseries_total, 2) top_total, 3) preview
  useEffect(() => {
    if (!table) { setRows(null); setSql(""); return; }

    const load = async () => {
      setBusy(true); setErr(""); setRows(null); setSql("");
      const tryCalls = [
        () => axios.post(`${BASE}/analytics/query/nl`, {
          question: `courbe des totaux par date pour ${table}`,
          dataset: table,
          intent: "timeseries_total",
          limit: 1000,
        }),
        () => axios.post(`${BASE}/analytics/query/nl`, {
          question: `top categories par total pour ${table}`,
          dataset: table,
          intent: "top_total",
          limit: 20,
        }),
        () => axios.get(`${BASE}/analytics/datasets/${encodeURIComponent(table)}/preview?limit=100`),
      ];

      for (let i = 0; i < tryCalls.length; i++) {
        try {
          const res = await tryCalls[i]();
          const data = res?.data || {};
          const rowset = data.rows || data?.rows || [];
          if (Array.isArray(rowset) && rowset.length) {
            setRows(rowset);
            setSql(data.sql || "");
            setBusy(false);
            return;
          }
        } catch (e) {
          // essaie l’appel suivant
          if (i === tryCalls.length - 1) {
            const api = e?.response?.data;
            const msg = typeof api === "string" ? api : api?.detail || api?.message || e?.message;
            setErr(msg || "Echec chargement des données.");
          }
        }
      }
      setBusy(false);
    };

    load();
  }, [table]);

  // Mode démo si pas de table: on affiche un message + rien à charger
  const demo = useMemo(() => ([
    { name: "Jan", value: 30 }, { name: "Fev", value: 45 },
    { name: "Mar", value: 60 }, { name: "Avr", value: 50 }, { name: "Mai", value: 80 },
  ]), []);

  return (
    <div>
      <h1 className="mb-4">Tableau de bord</h1>

      {!table ? (
        <div className="alert alert-info">
          Mode auto: ajoute <code>?table=NomDeLaTable</code> à l’URL (après avoir importé un CSV/XLSX sur Accueil).<br/>
          Je m’adapte automatiquement aux données (courbe, barres, camembert ou tableau).
        </div>
      ) : (
        <div className="alert alert-secondary d-flex justify-content-between align-items-center">
          <div>Source: <code>{table}</code></div>
          {busy && <span className="text-muted">Chargement…</span>}
        </div>
      )}

      {err && <div className="alert alert-danger">{err}</div>}

      <div className="card p-3">
        <h6 className="mb-3">{table ? "Visualisation automatique" : "Démo rapide"}</h6>
        {table ? (
          busy ? <div className="text-muted">Chargement…</div> :
          rows && rows.length ? <AutoChart rows={rows} /> :
          <div className="text-muted">Aucune donnée à afficher.</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={demo}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" /><YAxis /><Tooltip />
              <Line type="monotone" dataKey="value" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {sql && (
        <details className="mt-3">
          <summary className="fw-semibold">SQL généré</summary>
          <pre className="mb-0" style={{ whiteSpace: "pre-wrap" }}>{sql}</pre>
        </details>
      )}
    </div>
  );
}
