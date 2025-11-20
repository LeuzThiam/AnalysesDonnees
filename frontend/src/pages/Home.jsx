import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import FileUploader from "../components/FileUploader.jsx";
import { listDatasets } from "../api";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

export default function Home() {
  const nav = useNavigate();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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
      setErr(e?.response?.data?.detail || e?.message || "Erreur lors du chargement des datasets.");
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

  const onSelectTable = (tableName) => {
    if (!tableName) return;
    nav(`/ask?table=${encodeURIComponent(tableName)}`);
  };

  const handlePreview = async (tableName) => {
    if (selectedTable === tableName && previewData) {
      setSelectedTable(null);
      setPreviewData(null);
      return;
    }

    setSelectedTable(tableName);
    setPreviewLoading(true);
    setPreviewData(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/analytics/datasets/${encodeURIComponent(tableName)}/preview`
      );
      const data = await response.json();
      setPreviewData(data);
    } catch (e) {
      console.error("Erreur prévisualisation:", e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const filteredTables = useMemo(() => {
    if (!searchTerm.trim()) return tables;
    const term = searchTerm.toLowerCase();
    return tables.filter((name) => name.toLowerCase().includes(term));
  }, [tables, searchTerm]);

  return (
    <div className="container py-4">
      {/* Header Section */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2 className="fw-bold text-primary mb-2">
                <i className="bi bi-database me-2"></i>
                Gestion des Datasets
              </h2>
              <p className="text-muted mb-0">
                Importez, explorez et analysez vos données en toute simplicité
              </p>
            </div>
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-primary"
                onClick={refresh}
                disabled={loading}
              >
                <i className={`bi ${loading ? "bi-arrow-clockwise" : "bi-arrow-repeat"} me-2`}></i>
                {loading ? "Actualisation..." : "Actualiser"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card shadow-sm border-0">
            <div className="card-body p-4">
              <h5 className="card-title fw-semibold mb-3">
                <i className="bi bi-cloud-upload me-2 text-primary"></i>
                Importer un nouveau dataset
              </h5>
              <FileUploader onUploaded={onUploaded} />
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {err && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {err}
          <button
            type="button"
            className="btn-close"
            onClick={() => setErr("")}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* Search and Stats Section */}
      {tables.length > 0 && (
        <div className="row mb-3">
          <div className="col-md-6">
            <div className="input-group">
              <span className="input-group-text bg-white">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Rechercher un dataset..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => setSearchTerm("")}
                >
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
          </div>
          <div className="col-md-6 d-flex align-items-center justify-content-end">
            <div className="text-muted">
              <i className="bi bi-table me-2"></i>
              <strong>{filteredTables.length}</strong> dataset{filteredTables.length > 1 ? "s" : ""} 
              {searchTerm && ` (sur ${tables.length} au total)`}
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Chargement...</span>
          </div>
          <p className="text-muted mt-3">Chargement des datasets...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && tables.length === 0 && (
        <div className="card shadow-sm border-0">
          <div className="card-body text-center py-5">
            <i className="bi bi-inbox display-1 text-muted mb-3"></i>
            <h5 className="fw-semibold mb-2">Aucun dataset disponible</h5>
            <p className="text-muted mb-4">
              Commencez par importer un fichier CSV ou XLSX ci-dessus
            </p>
          </div>
        </div>
      )}

      {/* No Results from Search */}
      {!loading && tables.length > 0 && filteredTables.length === 0 && (
        <div className="card shadow-sm border-0">
          <div className="card-body text-center py-5">
            <i className="bi bi-search display-4 text-muted mb-3"></i>
            <h5 className="fw-semibold mb-2">Aucun résultat</h5>
            <p className="text-muted">
              Aucun dataset ne correspond à votre recherche "{searchTerm}"
            </p>
            <button
              className="btn btn-outline-primary mt-3"
              onClick={() => setSearchTerm("")}
            >
              Réinitialiser la recherche
            </button>
          </div>
        </div>
      )}

      {/* Datasets Grid */}
      {!loading && filteredTables.length > 0 && (
        <div className="row g-3">
          {filteredTables.map((tableName) => (
            <div key={tableName} className="col-md-6 col-lg-4">
              <div className="card shadow-sm border-0 h-100 dataset-card">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div className="flex-grow-1">
                      <h6 className="card-title fw-bold mb-1 d-flex align-items-center">
                        <i className="bi bi-table me-2 text-primary"></i>
                        {tableName}
                      </h6>
                      <small className="text-muted">
                        <i className="bi bi-database me-1"></i>
                        Dataset
                      </small>
                    </div>
                    <div className="dropdown">
                      <button
                        className="btn btn-sm btn-outline-secondary border-0"
                        type="button"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                      >
                        <i className="bi bi-three-dots-vertical"></i>
                      </button>
                      <ul className="dropdown-menu dropdown-menu-end">
                        <li>
                          <button
                            className="dropdown-item"
                            onClick={() => handlePreview(tableName)}
                          >
                            <i className="bi bi-eye me-2"></i>
                            {selectedTable === tableName ? "Masquer" : "Prévisualiser"}
                          </button>
                        </li>
                        <li>
                          <button
                            className="dropdown-item"
                            onClick={() => onSelectTable(tableName)}
                          >
                            <i className="bi bi-chat-dots me-2"></i>
                            Analyser
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="d-grid gap-2 mt-3">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onSelectTable(tableName)}
                    >
                      <i className="bi bi-rocket-takeoff me-2"></i>
                      Lancer l'analyse
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => handlePreview(tableName)}
                      disabled={previewLoading && selectedTable === tableName}
                    >
                      {previewLoading && selectedTable === tableName ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          Chargement...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-eye me-2"></i>
                          {selectedTable === tableName ? "Masquer l'aperçu" : "Aperçu"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Section */}
      {selectedTable && previewData && (
        <div className="row mt-4">
          <div className="col-12">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                <h6 className="mb-0 fw-semibold">
                  <i className="bi bi-eye me-2"></i>
                  Aperçu : {selectedTable}
                </h6>
                <button
                  className="btn btn-sm btn-light"
                  onClick={() => {
                    setSelectedTable(null);
                    setPreviewData(null);
                  }}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <div className="card-body">
                {previewData.count !== undefined && (
                  <div className="mb-3">
                    <span className="badge bg-info me-2">
                      <i className="bi bi-list-ul me-1"></i>
                      {previewData.count} ligne{previewData.count > 1 ? "s" : ""}
                    </span>
                    {previewData.columns && (
                      <span className="badge bg-secondary">
                        <i className="bi bi-columns me-1"></i>
                        {previewData.columns.length} colonne{previewData.columns.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                )}
                {previewData.rows && previewData.rows.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover">
                      <thead className="table-light">
                        <tr>
                          {Object.keys(previewData.rows[0]).map((col) => (
                            <th key={col} className="text-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.rows.map((row, idx) => (
                          <tr key={idx}>
                            {Object.keys(previewData.rows[0]).map((col) => (
                              <td key={col} className="text-nowrap">
                                {String(row[col] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted mb-0">Aucune donnée à afficher</p>
                )}
                <div className="mt-3">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onSelectTable(selectedTable)}
                  >
                    <i className="bi bi-rocket-takeoff me-2"></i>
                    Analyser ce dataset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
