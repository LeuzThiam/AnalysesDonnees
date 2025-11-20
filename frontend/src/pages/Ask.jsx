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
        <div className="chart-container" style={{ minHeight: "400px" }}>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={rows} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey={xKey} 
                tick={{ fill: "#666", fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fill: "#666", fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                }}
              />
              <Legend wrapperStyle={{ paddingTop: "20px" }} />
              <Bar dataKey={yKey} fill="#4e79a7" radius={[8, 8, 0, 0]} />
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
        <div className="chart-container" style={{ minHeight: "400px" }}>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={rows} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey={xKey} 
                tick={{ fill: "#666", fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fill: "#666", fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                }}
              />
              <Legend wrapperStyle={{ paddingTop: "20px" }} />
              <Line 
                type="monotone" 
                dataKey={yKey} 
                stroke="#f28e2b" 
                strokeWidth={3} 
                dot={{ fill: "#f28e2b", r: 4 }}
                activeDot={{ r: 6 }}
              />
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
        <div className="chart-container" style={{ minHeight: "400px" }}>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie 
                data={rows} 
                dataKey={yKey} 
                nameKey={xKey} 
                cx="50%" 
                cy="50%" 
                outerRadius={130} 
                label={{ fill: "#333", fontSize: 12 }}
              >
                {rows.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: "20px" }}
                iconType="circle"
              />
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
  const [datasetSearch, setDatasetSearch] = useState("");
  const [showDatasetList, setShowDatasetList] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [chart, setChart] = useState("");
  const [chartSpec, setChartSpec] = useState(null);
  const [sql, setSql] = useState("");
  const [summary, setSummary] = useState("");
  const [textResponse, setTextResponse] = useState("");
  const [resultText, setResultText] = useState("");
  const [stdout, setStdout] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [analysis, setAnalysis] = useState("");
  const [showAllRows, setShowAllRows] = useState(false);


  useEffect(() => {
    (async () => {
      try {
        const names = await listDatasets();
        if (Array.isArray(names)) {
          setSuggestions(names);
          if (!dataset && names.length > 0) {
            setDataset(names[0]);
            setDatasetSearch(names[0]);
          }
        }
      } catch (err) {
        console.warn("Impossible de charger les datasets :", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (dataset) {
      setDatasetSearch(dataset);
    }
  }, [dataset]);

  useEffect(() => {
    if (tableFromQS && tableFromQS !== dataset) {
      setDataset(tableFromQS);
      setDatasetSearch(tableFromQS);
    }
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
    setTextResponse("");
    setResultText("");
    setStdout("");
    setShowAllRows(false);
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

    const chosenIntent = inferIntent(q); // Toujours auto-détecté

    try {
      setBusy(true);
      const payload = {
        dataset: ds,
        question: q,
        intent: chosenIntent,
        // Pas de limite : toutes les données seront récupérées
      };
      const data = await unwrap(api.post("/analytics/query/nl", payload));
      setAnalysis(data.analysis || "");

      setRows(Array.isArray(data.rows) ? data.rows : []);
      setChart(typeof data.chart === "string" ? data.chart : "");
      setChartSpec(data.chart_spec ?? null);
      setSql(data.sql || "");
      setSummary(data.summary || "");
      setTextResponse(typeof data.text_response === "string" ? data.text_response : "");
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
    !!resultText ||
    !!stdout ||
    !!chartSpec ||
    !!textResponse;

  return (
    <div className="container py-4">
      {/* Header Section */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="text-center mb-4">
            <h2 className="fw-bold text-primary mb-2">
              <i className="bi bi-graph-up-arrow me-2"></i>
              Analyse de Données Interactive
            </h2>
            <p className="text-muted">
              Posez vos questions en langage naturel et obtenez des analyses visuelles instantanées
            </p>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card shadow-lg border-0">
            <div className="card-header bg-primary text-white py-3">
              <h5 className="mb-0 fw-semibold">
                <i className="bi bi-sliders me-2"></i>
                Configuration de l'analyse
              </h5>
            </div>
            <div className="card-body p-4">
              <form onSubmit={onAsk}>
                <div className="row g-4">
                  {/* Dataset Selection */}
                  <div className="col-md-4">
                    <label className="form-label fw-semibold mb-2">
                      <i className="bi bi-database me-2 text-primary"></i>
                      Dataset
                    </label>
                    <div className="position-relative">
                      <div className="input-group">
                        <span className="input-group-text bg-light">
                          <i className="bi bi-search text-muted"></i>
                        </span>
                        <input
                          className="form-control form-control-lg"
                          type="text"
                          value={datasetSearch}
                          onChange={(e) => {
                            setDatasetSearch(e.target.value);
                            setShowDatasetList(true);
                          }}
                          onFocus={() => setShowDatasetList(true)}
                          onBlur={() => setTimeout(() => setShowDatasetList(false), 200)}
                          placeholder="Rechercher un dataset..."
                          autoComplete="off"
                        />
                      </div>
                      {showDatasetList && suggestions.length > 0 && (
                        <div
                          className="position-absolute w-100 bg-white border rounded shadow-lg mt-1"
                          style={{
                            zIndex: 1000,
                            maxHeight: "300px",
                            overflowY: "auto",
                          }}
                        >
                          {suggestions
                            .filter((name) =>
                              name.toLowerCase().includes(datasetSearch.toLowerCase())
                            )
                            .map((name) => (
                              <div
                                key={name}
                                className="px-3 py-2"
                                style={{
                                  cursor: "pointer",
                                  backgroundColor: dataset === name ? "#e7f3ff" : "transparent",
                                  transition: "background-color 0.2s",
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setDataset(name);
                                  setDatasetSearch(name);
                                  setShowDatasetList(false);
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = "#f8f9fa";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    dataset === name ? "#e7f3ff" : "transparent";
                                }}
                              >
                                <i className="bi bi-table me-2 text-primary"></i>
                                <strong>{name}</strong>
                              </div>
                            ))}
                          {suggestions.filter((name) =>
                            name.toLowerCase().includes(datasetSearch.toLowerCase())
                          ).length === 0 && (
                            <div className="px-3 py-3 text-center text-muted">
                              <i className="bi bi-search me-2"></i>
                              Aucun dataset trouvé
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {dataset && (
                      <div className="mt-2">
                        <span className="badge bg-success">
                          <i className="bi bi-check-circle me-1"></i>
                          {dataset}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Question Input */}
                  <div className="col-md-8">
                    <label className="form-label fw-semibold mb-2">
                      <i className="bi bi-chat-quote me-2 text-primary"></i>
                      Votre question
                    </label>
                    <TextareaAutosize
                      className="form-control form-control-lg"
                      minRows={2}
                      maxRows={5}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Ex: Quels sont les joueurs ayant marqué plus de 10 buts ?"
                      style={{ resize: "none" }}
                    />
                    <small className="text-muted">
                      <i className="bi bi-info-circle me-1"></i>
                      Posez votre question en langage naturel
                    </small>
                  </div>

                  {/* Submit Button */}
                  <div className="col-12">
                    <div className="d-grid">
                      <button
                        className="btn btn-primary btn-lg shadow-sm"
                        type="submit"
                        disabled={!canSubmit}
                        style={{
                          padding: "12px 24px",
                          fontSize: "1.1rem",
                          fontWeight: "600",
                        }}
                      >
                        {busy ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                            Analyse en cours...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-rocket-takeoff me-2"></i>
                            Lancer l'analyse
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="alert alert-danger alert-dismissible fade show shadow-sm border-0" role="alert">
              <div className="d-flex align-items-start">
                <i className="bi bi-exclamation-triangle-fill fs-4 me-3 mt-1"></i>
                <div className="flex-grow-1">
                  <h6 className="alert-heading fw-bold mb-2">Erreur lors de l'analyse</h6>
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.6" }}>
                    {error.split("\n").map((line, idx) => (
                      <p key={idx} className={idx > 0 ? "mt-2 mb-0" : "mb-0"}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      {hasAnyResult && (
        <div className="row g-4">
          {/* Summary Card */}
          {summary && (
            <div className="col-12">
              <div className="card shadow-sm border-0">
                <div className="card-header bg-info text-white">
                  <h6 className="mb-0 fw-semibold">
                    <i className="bi bi-info-circle me-2"></i>
                    Résumé
                  </h6>
                </div>
                <div className="card-body">
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.8", fontSize: "1.05rem" }}>
                    {summary.split("\n\n").map((paragraph, idx) => (
                      <p key={idx} className={idx > 0 ? "mt-3 mb-0" : "mb-0"}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Expert Analysis Card */}
          {analysis && (
            <div className="col-12">
              <div className="card shadow-sm border-0 border-start border-4 border-success">
                <div className="card-header bg-success text-white">
                  <h6 className="mb-0 fw-semibold">
                    <i className="bi bi-lightbulb-fill me-2"></i>
                    Analyse experte
                  </h6>
                </div>
                <div className="card-body">
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.8", fontSize: "1.05rem" }}>
                    {analysis.split("\n\n").map((paragraph, idx) => (
                      <p key={idx} className={idx > 0 ? "mt-3 mb-0" : "mb-0"}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Text Response Card */}
          {textResponse && (
            <div className="col-12">
              <div className="card shadow-sm border-0 border-start border-4 border-primary">
                <div className="card-header bg-primary text-white">
                  <h6 className="mb-0 fw-semibold">
                    <i className="bi bi-chat-dots-fill me-2"></i>
                    Réponse
                  </h6>
                </div>
                <div className="card-body">
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.8", fontSize: "1.1rem" }}>
                    {textResponse.split("\n").map((line, idx) => (
                      <p key={idx} className={idx > 0 ? "mt-2 mb-0" : "mb-0"}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chart Card */}
          {!textResponse && (chartSpec || chart) && (
            <div className="col-12">
              <div className="card shadow-sm border-0">
                <div className="card-header bg-white border-bottom">
                  <h6 className="mb-0 fw-semibold">
                    <i className="bi bi-bar-chart-line-fill me-2 text-primary"></i>
                    Visualisation
                  </h6>
                </div>
                <div className="card-body p-4">
                  <ChartRenderer rows={rows || []} spec={chartSpec} base64={chart} />
                </div>
              </div>
            </div>
          )}

          {/* Data Table Card */}
          {rows?.length > 0 && (
            <div className="col-12">
              <div className="card shadow-sm border-0">
                <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center">
                  <h6 className="mb-0 fw-semibold">
                    <i className="bi bi-table me-2 text-primary"></i>
                    Données ({rows.length} ligne{rows.length > 1 ? "s" : ""})
                  </h6>
                  <span className="badge bg-primary">{rows.length} résultat{rows.length > 1 ? "s" : ""}</span>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <DataTable rows={showAllRows ? rows : rows.slice(0, 10)} />
                  </div>
                  {rows.length > 10 && (
                    <div className="card-footer bg-white border-top text-center py-3">
                      <button
                        className="btn btn-outline-primary"
                        onClick={() => setShowAllRows(!showAllRows)}
                      >
                        {showAllRows ? (
                          <>
                            <i className="bi bi-chevron-up me-2"></i>
                            Voir moins (afficher 10 premières lignes)
                          </>
                        ) : (
                          <>
                            <i className="bi bi-chevron-down me-2"></i>
                            Voir plus ({rows.length - 10} ligne{rows.length - 10 > 1 ? "s" : ""} supplémentaire{rows.length - 10 > 1 ? "s" : ""})
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SQL Code Card - Masqué pour l'utilisateur */}
          {/* {sql && (
            <div className="col-12">
              <div className="card shadow-sm border-0">
                <div className="card-header bg-dark text-white">
                  <h6 className="mb-0 fw-semibold">
                    <i className="bi bi-code-slash me-2"></i>
                    Requête SQL générée
                  </h6>
                </div>
                <div className="card-body bg-dark text-light p-3">
                  <pre className="mb-0" style={{ fontSize: "0.9rem", lineHeight: "1.6" }}>
                    <code>{sql}</code>
                  </pre>
                </div>
              </div>
            </div>
          )} */}

          {/* Additional Results */}
          {(resultText || stdout) && (
            <div className="col-12">
              <div className="accordion" id="resultsAccordion">
                {resultText && (
                  <div className="accordion-item">
                    <h2 className="accordion-header">
                      <button
                        className="accordion-button collapsed"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#resultText"
                      >
                        <i className="bi bi-bar-chart-line me-2"></i>
                        Résultat détaillé
                      </button>
                    </h2>
                    <div id="resultText" className="accordion-collapse collapse" data-bs-parent="#resultsAccordion">
                      <div className="accordion-body">
                        <pre className="bg-light p-3 rounded">
                          <code>{resultText}</code>
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
                {stdout && (
                  <div className="accordion-item">
                    <h2 className="accordion-header">
                      <button
                        className="accordion-button collapsed"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#stdout"
                      >
                        <i className="bi bi-terminal me-2"></i>
                        Sortie système
                      </button>
                    </h2>
                    <div id="stdout" className="accordion-collapse collapse" data-bs-parent="#resultsAccordion">
                      <div className="accordion-body">
                        <pre className="bg-dark text-light p-3 rounded">
                          <code>{stdout}</code>
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!busy && !error && !hasAnyResult && (
        <div className="row">
          <div className="col-12">
            <div className="card shadow-sm border-0">
              <div className="card-body text-center py-5">
                <i className="bi bi-clipboard-data display-1 text-muted mb-3"></i>
                <h5 className="fw-semibold mb-2">Aucun résultat</h5>
                <p className="text-muted mb-0">
                  Posez une question ci-dessus pour commencer l'analyse
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
