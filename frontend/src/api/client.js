// src/api/client.js
import axios from "axios";

const API_URL  = (import.meta.env.VITE_API_URL  || "http://127.0.0.1:8000").trim();
const API_BASE = (import.meta.env.VITE_API_BASE || "/api").trim();
export const BASE = `${API_URL}${API_BASE}`.replace(/\/+$/,"");

const api = axios.create({
  baseURL: BASE,
  withCredentials: false,
});

export function unwrap(promise) {
  return promise.then(r => r.data);
}

export default api;
