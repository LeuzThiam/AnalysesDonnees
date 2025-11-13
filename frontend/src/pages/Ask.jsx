import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { unwrap } from "../api/client";
import { listDatasets } from "../api";
import DataTable from "../components/DataTable";

// Recharts
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  ScatterChart, Scatter,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";

/* ============================================================
   🎯 Inférence d’intention automatique selon la question
   ============================================================ */
function inferIntent(q = "") {
  const s = q.toLowerCase();
  if (/(anomal|outlier|z-?score)/.test(s)) return "anomaly_zscore";
  if (/(croissance|growth|augmente|baisse|evolution.*(par|entre)|vs)/.test(s)) return "top_growth";
  if (/(top|classement|meilleur|pire)/.test(s)) return "top_total";
  if (/(serie|chron|par jour|par mois|timeline|evolution)/.test(s)) return "timeseries_total";
  return "timeseries_total"; // défaut
}

/* ============================================================
   🎨 ChartRenderer universel (Recharts + PNG)
   ============================================================ */
function ChartRenderer({ rows = [], spec, base64 }) {
  if (!spec && !base64) return null;

  const type = (spec?.type || spec?.mark || "").toLowerCase();

  switch (type) {
    case "bar":
    case "bar_vertical":
      return (
        <BarChart width={700} height={400} data={rows}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={spec?.x} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey={spec?.y} fill="#8884d8" />
        </BarChart>
      );

    case "bar_horizontal":
      return (
        <BarChart layout="vertical" width={700} height={400} data={rows}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey={spec?.y} />
          <Tooltip />
          <Legend />
          <Bar dataKey={spec?.x} fill="#82ca9d" />
        </BarChart>
      );

    case "line":
      return (
        <LineChart width={700} height={400} data={rows}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={spec?.x} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey={spec?.y} stroke="#8884d8" />
        </LineChart>
      );

    case "scatter":
      return (
        <ScatterChart width={700} height={400}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={spec?.x} />
          <YAxis dataKey={spec?.y} />
          <Tooltip />
          <Legend />
          <Scatter data={rows} fill="#8884d8" />
        </ScatterChart>
      );

    case "pie":
      return (
        <PieChart width={400} height={400}>
          <Pie
            data={rows}
            dataKey={spec?.y}
            nameKey={spec?.x}
            cx="50%"
            cy="50%"
            outerRadius={120}
            label
          >
            {rows.map((_, i) => (
              <Cell
                key={i}
                fill={["#8884d8", "#82ca9d", "#ffc658", "#ff8042"][i % 4]}
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      );

    default:
      if (base64) {
        return (
          <div className="mt-3">
            <img
              alt="chart"
              src={`data:image/png;base64,${base64}`}
              style={{
                maxWidth: "100%",
                height: "auto",
                border: "1px solid #eee",
                borderRadius: "6px",
              }}
            />
          </div>
        );
      }
      return (
        <div className="alert alert-secondary mt-3">
          Type de graphique non encore pris en charge :
          <code>{type || "inconnu"}</code>
        </div>
      );
  }
}

/* ============================================================
   📊 Composant principal ASK
   ============================================================ */
export default function Ask() {
  const [sp] = useSearchParams();
  const tableFromQS = (sp.get("table") || "").trim();

  const [dataset, setDataset] = useState(tableFromQS);
  const [question, setQuestion] = useState("");
  const [intent, setIntent] = useState("auto");
  const [limit, setLimit] = useState(1000);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]);
  const [chart, setChart] = useState("");
  const [chartSpec, setChartSpec] = useState(null);
  const [sql, setSql] = useState("");
  const [summary, setSummary] = useState("");
  const [resultText, setResultText] = useState("");
  const [stdout, setStdout] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const names = await listDatasets();
        if (Array.isArray(names)) {
          setSuggestions(names);
          if (!dataset && names.length > 0) setDataset(names[0]);
        }
      } catch (err) {
        console.warn("Impossible de charger les datasets :", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (tableFromQS && tableFromQS !== dataset) setDataset(tableFromQS);
  }, [tableFromQS]);

  const canSubmit = useMemo(
    () => dataset.trim().length > 0 && question.trim().length > 0 && !busy,
    [dataset, question, busy]
  );

  const clearResults = () => {
    setRows([]);
    setChart("");
    setChartSpec(null);
    setSql("");
    setSummary("");
    setResultText("");
    setStdout("");
  };

  const onAsk = async (e) => {
    e.preventDefault();
    setError("");
    clearResults();

    const ds = dataset.trim();
    const q = question.trim();
    if (!ds || !q) {
      setError("Dataset et question requis.");
      return;
    }

    const chosenIntent = intent === "auto" ? inferIntent(q) : intent;

    try {
      setBusy(true);
      const payload = {
        dataset: ds,
        question: q,
        intent: chosenIntent,
        limit: Number(limit) > 0 ? Number(limit) : 1000,
      };
      const data = await unwrap(api.post("/analytics/query/nl", payload));

      setRows(Array.isArray(data.rows) ? data.rows : []);
      setChart(typeof data.chart === "string" ? data.chart : "");
      setChartSpec(data.chart_spec ?? null);
      setSql(data.sql || "");
      setSummary(data.summary || "");
      setResultText(
        typeof data.result === "string"
          ? data.result
          : Array.isArray(data.result)
          ? JSON.stringify(data.result, null, 2)
          : ""
      );
      setStdout(typeof data.stdout === "string" ? data.stdout : "");
    } catch (ex) {
      const apiErr = ex?.response?.data;
      let msg =
        (typeof apiErr === "string" && apiErr) ||
        apiErr?.detail ||
        apiErr?.error ||
        apiErr?.message ||
        ex?.message ||
        "Erreur inconnue.";
      if (/does not exist/i.test(msg))
        msg = `Le dataset "${dataset}" n'existe pas dans la base.`;
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const hasAnyResult =
    (rows && rows.length > 0) ||
    !!chart ||
    !!summary ||
    !!sql ||
    !!resultText ||
    !!stdout ||
    !!chartSpec;

  return (
    <div className="container py-3">
      <h3>Poser une question</h3>

      <form onSubmit={onAsk} className="row g-3 align-items-end">
        <div className="col-sm-4">
          <label className="form-label">Dataset (table)</label>
          <input
            className="form-control"
            list="datasets-list"
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
            placeholder="ex: ventes_2025"
            autoComplete="off"
          />
          <datalist id="datasets-list">
            {suggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        <div className="col-sm-5">
          <label className="form-label">Question</label>
          <input
            className="form-control"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="ex: Evolution journalière du total"
          />
        </div>

        <div className="col-sm-3">
          <div className="row g-2">
            <div className="col-7">
              <label className="form-label">Intent</label>
              <select
                className="form-select"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
              >
                <option value="auto">Auto</option>
                <option value="timeseries_total">Timeseries total</option>
                <option value="top_total">Top total</option>
                <option value="top_growth">Top croissance</option>
                <option value="anomaly_zscore">Anomalies (z-score)</option>
              </select>
            </div>
            <div className="col-5">
              <label className="form-label">Limit</label>
              <input
                type="number"
                min={1}
                className="form-control"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="col-12">
          <button className="btn btn-primary" disabled={!canSubmit}>
            {busy ? "Analyse en cours…" : "Analyser"}
          </button>
        </div>
      </form>

      {error && <div className="alert alert-danger mt-3">{error}</div>}
      {summary && <div className="alert alert-info mt-3">{summary}</div>}

      {sql && (
        <details className="mt-3">
          <summary className="fw-semibold">SQL généré</summary>
          <pre className="bg-light p-2 mb-0">
            <code>{sql}</code>
          </pre>
        </details>
      )}

      {(chartSpec || chart) && (
        <ChartRenderer rows={rows || []} spec={chartSpec} base64={chart} />
      )}

      {rows?.length > 0 && (
        <div className="mt-3">
          <DataTable rows={rows} />
        </div>
      )}

      {resultText && (
        <details className="mt-3">
          <summary className="fw-semibold">Résultat</summary>
          <pre className="bg-light p-2 mb-0">
            <code>{resultText}</code>
          </pre>
        </details>
      )}

      {stdout && (
        <details className="mt-3">
          <summary className="fw-semibold">Sortie (stdout)</summary>
          <pre className="bg-light p-2 mb-0">
            <code>{stdout}</code>
          </pre>
        </details>
      )}

      {!busy && !error && !hasAnyResult && (
        <div className="text-muted mt-3">Aucun résultat pour l’instant.</div>
      )}
    </div>
  );
}
