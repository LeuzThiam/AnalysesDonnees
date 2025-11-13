import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { unwrap } from "../api/client";
import { listDatasets } from "../api";
import DataTable from "../components/DataTable";
import {
  Area, AreaChart,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, Treemap, FunnelChart, Funnel,
  RadialBarChart, RadialBar,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  ScatterChart, Scatter,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer
} from "recharts";


import TextareaAutosize from "react-textarea-autosize";

// ✅ Import Bootstrap et icônes
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

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
   🎨 ChartRenderer universel (Recharts + Base64 PNG)
   ============================================================ */
function ChartRenderer({ rows = [], spec, base64 }) {
  if (!spec && !base64) return null;

  const type = (spec?.type || spec?.mark || "").toLowerCase();
  const xKey = spec?.x || "x";
  const yKey = spec?.y || "y";

  const colors = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc949"];

  switch (type) {
    case "bar":
    case "bar_vertical":
      return (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={yKey} fill="#4e79a7" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );

    case "bar_horizontal":
      return (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart layout="vertical" data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey={xKey} />
              <Tooltip />
              <Legend />
              <Bar dataKey={yKey} fill="#59a14f" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );

    case "line":
    case "timeseries":
      return (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={yKey} stroke="#f28e2b" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );

    case "scatter":
      return (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis dataKey={yKey} />
              <Tooltip />
              <Legend />
              <Scatter data={rows} fill="#e15759" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      );

    case "pie":
      return (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie data={rows} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius={130} label>
                {rows.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );

    case "histogram":
      return (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={spec?.x || Object.keys(rows[0])[0]} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={spec?.y || Object.keys(rows[0])[1]} fill="#4e79a7" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );

    case "area":
      return (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey={yKey} stroke="#76b7b2" fill="#cbe4de" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );

    case "bubble":
      return (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={spec?.x || Object.keys(rows[0])[0]} />
              <YAxis dataKey={spec?.y || Object.keys(rows[0])[1]} />
              <Tooltip />
              <Legend />
              <Scatter data={rows} fill="#edc949" shape="circle" dataKey={spec?.z || Object.keys(rows[0])[2]} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      );

    case "donut":
      return (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie data={rows} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" innerRadius={60} outerRadius={120} label>
                {rows.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );

    case "radar":
      return (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={rows}>
              <PolarGrid />
              <PolarAngleAxis dataKey={xKey} />
              <PolarRadiusAxis />
              <Radar dataKey={yKey} stroke="#4e79a7" fill="#4e79a7" fillOpacity={0.6} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      );

    case "stacked_bar":
      return (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {Array.isArray(spec?.yKeys)
                ? spec.yKeys.map((k, i) => (
                    <Bar key={k} dataKey={k} stackId="a" fill={colors[i % colors.length]} />
                  ))
                : <Bar dataKey={yKey} fill="#4e79a7" />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );

    case "combo":
      const y1 = spec?.yBar || yKey;
      const y2 = spec?.yLine || spec?.y2;
      return (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={y1} fill="#76b7b2" />
              {y2 && <Line type="monotone" dataKey={y2} stroke="#e15759" />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      );

    case "radial_bar":
      return (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="10%" outerRadius="100%" data={rows}>
              <RadialBar dataKey={yKey} label={{ position: "insideStart", fill: "#fff" }} fill="#59a14f" />
              <Legend />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      );

    case "treemap":
      return (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <Treemap data={rows} dataKey={yKey} nameKey={xKey} stroke="#fff" fill="#76b7b2" />
          </ResponsiveContainer>
        </div>
      );

    case "funnel":
      return (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <FunnelChart>
              <Tooltip />
              <Legend />
              <Funnel dataKey={yKey} data={rows} />
            </FunnelChart>
          </ResponsiveContainer>
        </div>
      );

    default:
      if (base64) {
        return (
          <div className="chart-container text-center">
            <img alt="Graphique" src={`data:image/png;base64,${base64}`} className="chart-image img-fluid rounded shadow-sm" />
          </div>
        );
      }

      return (
        <div className="alert alert-secondary mt-3">
          Type de graphique non pris en charge : <code>{type || "inconnu"}</code>
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
  const [analysis, setAnalysis] = useState("");


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
      setAnalysis(data.analysis || "");

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
    <div className="ask-wrapper container py-4">
      <h3 className="ask-title mb-4 text-center text-primary fw-bold">
        <i className="bi bi-search me-2"></i>
        Analyse de données interactive
      </h3>

      <form onSubmit={onAsk} className="ask-form card p-4 shadow-sm border-0">
        <div className="row g-3 align-items-end">
          <div className="col-sm-4">
            <label className="form-label fw-semibold">
              <i className="bi bi-folder2-open me-1"></i> Dataset (table)
            </label>
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
            <label className="form-label fw-semibold">
              <i className="bi bi-question-circle me-1"></i> Question
            </label>
            
              <TextareaAutosize
              className="form-control"
              minRows={1}
              maxRows={4}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="ex: évolution mensuelle du total des ventes"
            />


          </div>

          <div className="col-sm-3">
            <div className="row g-2">
              <div className="col-7">
                <label className="form-label fw-semibold">
                  <i className="bi bi-bullseye me-1"></i> Intent
                </label>
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
                <label className="form-label fw-semibold">
                  <i className="bi bi-hash me-1"></i> Limit
                </label>
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

          <div className="col-12 text-center mt-3">
            <button
              className="btn btn-primary btn-lg shadow rounded-pill px-4"
              disabled={!canSubmit}
            >
              {busy ? (
                <>
                  <i className="bi bi-hourglass-split me-2"></i>Analyse en cours…
                </>
              ) : (
                <>
                  <i className="bi bi-rocket-takeoff me-2"></i>Lancer l’analyse
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {error && <div className="alert alert-danger mt-3">{error}</div>}
      {summary && <div className="alert alert-info mt-3 shadow-sm">{summary}</div>}
      {analysis && (
        <div className="alert alert-success mt-3 shadow-sm">
          <h6 className="fw-bold mb-2"><i className="bi bi-lightbulb me-1"></i> Analyse automatique</h6>
          <p className="mb-0">{analysis}</p>
        </div>
      )}


      {sql && (
        <details className="mt-3">
          <summary className="fw-semibold">
            <i className="bi bi-code-slash me-2"></i> SQL généré
          </summary>
          <pre className="bg-light p-2 mb-0">
            <code>{sql}</code>
          </pre>
        </details>
      )}

      {(chartSpec || chart) && <ChartRenderer rows={rows || []} spec={chartSpec} base64={chart} />}

      {rows?.length > 0 && (
        <div className="mt-4">
          <DataTable rows={rows} />
        </div>
      )}

      {resultText && (
        <details className="mt-3">
          <summary className="fw-semibold">
            <i className="bi bi-bar-chart-line me-2"></i> Résultat
          </summary>
          <pre className="bg-light p-2 mb-0">
            <code>{resultText}</code>
          </pre>
        </details>
      )}

      {stdout && (
        <details className="mt-3">
          <summary className="fw-semibold">
            <i className="bi bi-terminal me-2"></i> Sortie (stdout)
          </summary>
          <pre className="bg-light p-2 mb-0">
            <code>{stdout}</code>
          </pre>
        </details>
      )}

      {!busy && !error && !hasAnyResult && (
        <div className="text-muted text-center mt-4">
          <i className="bi bi-clipboard-data me-2"></i>Aucun résultat pour l’instant.
        </div>
      )}
    </div>
  );
}
