// src/components/SchemaTable.jsx
import React, { useState } from "react";
import { getDatasetPreview } from "../api";

export default function SchemaTable({ schema = [], onSelectTable }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const handlePreview = async (name) => {
    setErr(""); setBusy(true); setPreview(null);
    try {
      const data = await getDatasetPreview(name, 10);
      setPreview(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Erreur prévisualisation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-3">
      <div className="fw-semibold mb-2">Tables</div>

      {err && <div className="alert alert-danger">{err}</div>}

      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead>
            <tr>
              <th>Nom</th>
              <th style={{width: 220}}></th>
            </tr>
          </thead>
          <tbody>
            {schema.map((name) => (
              <tr key={name}>
                <td className="text-break">{name}</td>
                <td className="text-end">
                  <button
                    className="btn btn-outline-primary btn-sm me-2"
                    onClick={() => handlePreview(name)}
                    disabled={busy}
                  >
                    Prévisualiser
                  </button>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => onSelectTable?.(name)}
                  >
                    Poser une question
                  </button>
                </td>
              </tr>
            ))}
            {!schema.length && (
              <tr><td colSpan={2} className="text-muted">Aucune table trouvée.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {preview && (
        <div className="mt-3">
          <div className="fw-semibold mb-2">Aperçu: {preview.table}</div>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  {(preview.columns?.map(c => c.name))?.map((c) => <th key={c}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {(preview.rows || []).map((r, i) => (
                  <tr key={i}>
                    {(preview.columns?.map(c => c.name) || Object.keys(r)).map((c) => (
                      <td key={c}>{String(r[c])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
