import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from "recharts";
/* import "../styles/Dashboard.css";

/* ===========================================================
   ⚙️ Configuration API
   =========================================================== */
const API_URL  = (import.meta.env.VITE_API_URL  || "http://127.0.0.1:8000").trim();
const API_BASE = (import.meta.env.VITE_API_BASE || "/api").trim();
const BASE     = `${API_URL}${API_BASE}`.replace(/\/+$/, "");

/* ===========================================================
   🧠 Helpers — Détection de schéma de données
   =========================================================== */
const isNumberLike = (v) => v !== null && v !== "" && !isNaN(Number(v));
const looksLikeDateKey = (k="") => /^(date|day|dt|time|timestamp)$/i.test(k);
const looksLikeCatKey  = (k="") => /^(cat|category|label|type|name|group)$/i.test(k);

function inferSchema(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { kind: "empty" };
  const cols = Object.keys(rows[0]);
  const dateCol = cols.find(looksLikeDateKey)
    || cols.find(c => rows.some(r => String(r[c]).match(/^\d{4}-\d{2}-\d{2}/)));
  const numericCols = cols.filter(c => rows.some(r => isNumberLike(r[c])));
  const catCol = cols.find(looksLikeCatKey)
    || cols.find(c => !rows.every(r => isNumberLike(r[c])) && c !== dateCol);

  if (dateCol && numericCols.length)
    return { kind: "timeseries", x: dateCol, y: numericCols[0] };
  if (catCol && numericCols.length)
    return { kind: "bar", x: catCol, y: numericCols[0] };
  if (numericCols.length === 1)
    return { kind: "bar_index", y: numericCols[0] };
  if (catCol && numericCols.length === 1 && rows.length <= 8)
    return { kind: "pie", label: catCol, value: numericCols[0] };
  return { kind: "table", columns: cols };
}

function projectData(rows, schema) {
  switch (schema.kind) {
    case "timeseries":
      return rows.map(r => ({ name: r[schema.x], value: Number(r[schema.y] || 0) }));
    case "bar":
      return rows.map(r => ({ name: r[schema.x], value: Number(r[schema.y] || 0) }));
    case "bar_index":
      return rows.map((r, i) => ({ name: `#${i+1}`, value: Number(r[schema.y] || 0) }));
    case "pie":
      return rows.map(r => ({ name: r[schema.label], value: Number(r[schema.value] || 0) }));
    default:
      return rows;
  }
}

/* ===========================================================
   📊 AutoChart — Rend automatiquement le meilleur graphique
   =========================================================== */
function AutoChart({ rows }) {
  const schema = useMemo(() => inferSchema(rows), [rows]);
  const data = useMemo(() => projectData(rows, schema), [rows, schema]);

  if (schema.kind === "empty") return <p className="text-muted">Aucune donnée disponible.</p>;

  switch (schema.kind) {
    case "timeseries":
      return (
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#0284c7" dot={false} strokeWidth={2}/>
          </LineChart>
        </ResponsiveContainer>
      );
    case "bar":
    case "bar_index":
      return (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#22c55e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    case "pie":
      return (
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={120} label>
              {data.map((_, i) => (
                <Cell key={i} fill={["#0284c7", "#22c55e", "#f97316", "#9333ea"][i % 4]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );
    default:
      return (
        <div className="table-responsive">
          <table className="table table-striped table-sm align-middle">
            <thead><tr>{Object.keys(rows[0]).map(c => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.slice(0, 50).map((r, i) => (
                <tr key={i}>{Object.keys(r).map(c => <td key={c}>{String(r[c])}</td>)}</tr>
              ))}
            </tbody>
          </table>
          {rows.length > 50 && <p className="text-muted small">… {rows.length - 50} lignes non affichées</p>}
        </div>
      );
  }
}

/* ===========================================================
   🧭 Dashboard principal
   =========================================================== */
export default function Dashboard() {
  const [sp] = useSearchParams();
  const table = (sp.get("table") || "").trim();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState(null);
  const [sql, setSql] = useState("");

  useEffect(() => {
    if (!table) return;
    setBusy(true);
    setErr(""); setRows(null); setSql("");

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

    (async () => {
      for (const call of tryCalls) {
        try {
          const res = await call();
          const rows = res?.data?.rows || [];
          if (rows.length) {
            setRows(rows);
            setSql(res?.data?.sql || "");
            setBusy(false);
            return;
          }
        } catch (e) {
          continue;
        }
      }
      setErr("Impossible de charger les données du dataset.");
      setBusy(false);
    })();
  }, [table]);

  const demo = useMemo(() => [
    { name: "Jan", value: 30 }, { name: "Fév", value: 45 },
    { name: "Mar", value: 60 }, { name: "Avr", value: 50 }, { name: "Mai", value: 80 },
  ], []);

  return (
    <div className="dashboard-wrapper container py-4">
      <h2 className="dashboard-title mb-4">📊 Tableau de bord</h2>

      {!table ? (
        <div className="alert alert-info shadow-sm">
          <strong>Mode démo :</strong> ajoute <code>?table=NomDeLaTable</code> à l’URL après avoir importé un CSV/XLSX.<br />
          L’application détecte automatiquement le meilleur type de graphique.
        </div>
      ) : (
        <div className="alert alert-secondary d-flex justify-content-between align-items-center shadow-sm">
          <div><strong>Source :</strong> <code>{table}</code></div>
          {busy && <span className="text-muted">Chargement…</span>}
        </div>
      )}

      {err && <div className="alert alert-danger shadow-sm">{err}</div>}

      <div className="card shadow-sm p-3 border-0 rounded-4 mt-3">
        <h6 className="text-muted mb-3">{table ? "Visualisation automatique" : "Démo rapide"}</h6>
        {busy ? (
          <div className="loader">
            <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
          </div>
        ) : rows && rows.length ? (
          <AutoChart rows={rows} />
        ) : !table ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={demo}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" /><YAxis /><Tooltip />
              <Line type="monotone" dataKey="value" stroke="#0ea5e9" dot={false} strokeWidth={2}/>
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted">Aucune donnée à afficher.</p>
        )}
      </div>

      {sql && (
        <details className="mt-3">
          <summary className="fw-semibold">🧩 SQL généré</summary>
          <pre className="sql-box">{sql}</pre>
        </details>
      )}
    </div>
  );
}
