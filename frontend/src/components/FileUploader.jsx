import React, { useCallback, useRef, useState } from "react";
import axios from "axios";
import { Alert, ProgressBar } from "react-bootstrap";

const MAX_SIZE_MB = 100;

export default function FileUploader({ onUploaded, apiBase }) {
  const [busy, setBusy]   = useState(false);
  const [msg, setMsg]     = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  // Base API: http://127.0.0.1:8000  +  /api
  const API_URL  = (import.meta.env.VITE_API_URL  || "http://127.0.0.1:8000").trim();
  const API_BASE = (import.meta.env.VITE_API_BASE || "/api").trim();
  const BASE     = (apiBase || `${API_URL}${API_BASE}`).replace(/\/+$/,""); // optionnel prop externe
  const UPLOAD_URL = `${BASE}/analytics/datasets/upload`;

  const validate = (file) => {
    if (!file) return "Aucun fichier.";
    const name = file.name.toLowerCase();
    if (!/\.(csv|xlsx|xls)$/i.test(name)) return "Format non supporte. CSV ou XLSX attendu.";
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return `Fichier trop volumineux (> ${MAX_SIZE_MB} Mo).`;
    return "";
  };

  // genere un nom de dataset a partir du nom de fichier si non fourni par l API
  const datasetFromFilename = (filename) =>
    filename
      .replace(/\.[^.]+$/,"")
      .trim()
      .toLowerCase()
      .replace(/\s+/g,"_")
      .replace(/[^a-z0-9_]/g,"_");

  const handle = async (file) => {
    const v = validate(file);
    if (v) { setError(v); return; }

    setBusy(true); setError(""); setMsg("");

    try {
      const fd = new FormData();
      fd.append("file", file);
      // tu peux aussi fournir dataset si tu veux maitriser le nom:
      // fd.append("dataset", "mon_dataset");

      const res = await axios.post(UPLOAD_URL, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // structure attendue du backend:
      // { ok: true, table: string, rows: [...preview...], columns: [...], count: number }
      const data = res?.data || {};
      const table = data.table || datasetFromFilename(file.name);
      const count = Number.isFinite(data.count) ? data.count : Array.isArray(data.rows) ? data.rows.length : 0;

      setMsg(`Table creee: ${table} (${count} lignes)`);
      onUploaded?.({ ...data, table, count });
    } catch (e) {
      const apiErr = e?.response?.data;
      const detail = typeof apiErr === "string"
        ? apiErr
        : apiErr?.detail || apiErr?.message || e?.message;
      setError(detail || "Echec upload.");
    } finally {
      setBusy(false);
      // reset input pour re-uploader le meme fichier si besoin
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDrop = useCallback((ev) => {
    ev.preventDefault();
    if (busy) return;
    const f = ev.dataTransfer?.files?.[0];
    if (f) handle(f);
  }, [busy]);

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        className="p-4 text-center border border-2 border-secondary-subtle rounded-4 bg-light"
        style={{ cursor: busy ? "not-allowed" : "pointer" }}
      >
        <div className="fw-semibold">Deposez un CSV/XLSX ici</div>
        <div className="text-muted small">ou cliquez pour selectionner…</div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: "none" }}
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
        />
      </div>

      {busy  && <ProgressBar animated now={100} className="my-2" />}
      {msg   && <Alert variant="success" className="mt-2 mb-0 py-2">{msg}</Alert>}
      {error && <Alert variant="danger"  className="mt-2 mb-0 py-2">{error}</Alert>}
    </div>
  );
}
