// src/api/datasets.js
import api, { unwrap, BASE } from "./client";

// GET /analytics/datasets -> { tables: [...] }
export async function listDatasets() {
  const data = await unwrap(api.get("/analytics/datasets"));
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.tables)) return data.tables;
  return [];
}

// POST /analytics/datasets/upload (multipart)
export async function uploadDataset(file, dataset) {
  const fd = new FormData();
  fd.append("file", file);
  if (dataset) fd.append("dataset", dataset);
  return unwrap(api.post("/analytics/datasets/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  }));
}

// GET /analytics/datasets/:table/preview?limit=10
export async function getDatasetPreview(table, limit = 10) {
  return unwrap(api.get(`/analytics/datasets/${encodeURIComponent(table)}/preview`, {
    params: { limit },
  }));
}

// alias facultatif
export const getDatasetSchema = (table) => getDatasetPreview(table, 0);
