import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import FileUploader from "../components/FileUploader.jsx";
import SchemaTable from "../components/SchemaTable.jsx";
import { listDatasets } from "../api"; // doit retourner soit {tables: [...]}, soit [...]

export default function Home() {
  const nav = useNavigate();
  const [tables, setTables] = useState([]);     // array de noms
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const data = await listDatasets();
      // normalise le format
      const names = Array.isArray(data)
        ? data
        : Array.isArray(data?.tables)
        ? data.tables
        : [];
      setTables(names);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Erreur lors du chargement des tables.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const onUploaded = async () => {
    await refresh();
  };

  const onSelectTable = (t) => {
    if (!t) return;
    nav(`/ask?table=${encodeURIComponent(t)}`);
  };

  return (
    <div className="d-flex flex-column gap-3">
      <h4>Importer & Explorer</h4>

      {/* uploader → déclenche refresh quand OK */}
      <FileUploader onUploaded={onUploaded} />

      <button className="btn btn-dark w-auto" onClick={refresh} disabled={loading}>
        {loading ? "Actualisation..." : "Actualiser les tables"}
      </button>

      {err && <div className="alert alert-danger mb-0">{err}</div>}

      {/* État vide / chargement / liste */}
      {loading ? (
        <div className="text-muted">Chargement des tables…</div>
      ) : tables.length === 0 ? (
        <div className="text-muted">Aucune table pour le moment. Importez un CSV/XLSX ci-dessus.</div>
      ) : (
        // SchemaTable doit accepter une liste de noms et appeler onSelectTable(name)
        <SchemaTable schema={tables} onSelectTable={onSelectTable} />
      )}
    </div>
  );
}
