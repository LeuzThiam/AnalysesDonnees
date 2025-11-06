import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import FileUploader from "../components/FileUploader.jsx";
import SchemaTable from "../components/SchemaTable.jsx";
import { listDatasets } from "../api";
import "../styles/Home.css";

export default function Home() {
  const nav = useNavigate();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const data = await listDatasets();
      const names = Array.isArray(data)
        ? data
        : Array.isArray(data?.tables)
        ? data.tables
        : [];
      setTables(names);
    } catch (e) {
      setErr(
        e?.response?.data?.detail ||
          e?.message ||
          "❌ Erreur lors du chargement des tables."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onUploaded = async () => {
    await refresh();
  };

  const onSelectTable = (t) => {
    if (!t) return;
    nav(`/ask?table=${encodeURIComponent(t)}`);
  };

  return (
    <div className="home-wrapper container py-5">
      {/* ==================== HEADER ==================== */}
      <header className="text-center mb-5">
        <h2 className="fw-bold text-dark mb-2">
          <i className="bi bi-database-fill-gear text-primary me-2"></i>
          Importer & Explorer vos données
        </h2>
        <p className="text-muted lead mb-0">
          Téléversez un fichier CSV/XLSX, explorez automatiquement les schémas et
          visualisez vos jeux de données.
        </p>
      </header>

      {/* ==================== UPLOADER ==================== */}
      <section className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <h5 className="fw-semibold text-secondary mb-3">
            <i className="bi bi-cloud-upload-fill text-success me-2"></i>
            Téléversement de données
          </h5>
          <FileUploader onUploaded={onUploaded} />
        </div>
      </section>

      {/* ==================== ACTIONS ==================== */}
      <div className="d-flex justify-content-center mb-4">
        <button
          className="btn btn-outline-primary btn-lg px-4"
          onClick={refresh}
          disabled={loading}
        >
          <i className={`bi ${loading ? "bi-arrow-repeat spin" : "bi-arrow-clockwise"} me-2`}></i>
          {loading ? "Actualisation..." : "Actualiser les tables"}
        </button>
      </div>

      {/* ==================== ALERTES ==================== */}
      {err && (
        <div className="alert alert-danger text-center shadow-sm">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {err}
        </div>
      )}

      {/* ==================== TABLES ==================== */}
      <section className="card border-0 shadow-sm">
        <div className="card-body">
          <h5 className="fw-semibold text-secondary mb-4">
            <i className="bi bi-table me-2 text-info"></i>
            Tables disponibles
          </h5>

          {loading ? (
            <div className="text-center text-muted py-4">
              <div className="spinner-border text-primary mb-3" role="status"></div>
              <p>Chargement des tables…</p>
            </div>
          ) : tables.length === 0 ? (
            <div className="text-center text-muted py-4">
              <i className="bi bi-folder2-open fs-1 mb-2 text-secondary"></i>
              <p className="mb-0 fw-semibold">
                Aucune table disponible pour l’instant.
              </p>
              <small>Importez un fichier CSV ou Excel pour commencer.</small>
            </div>
          ) : (
            <SchemaTable schema={tables} onSelectTable={onSelectTable} />
          )}
        </div>
      </section>
    </div>
  );
}
