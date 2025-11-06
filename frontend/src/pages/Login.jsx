import React, { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const isValidEmail = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [sp] = useSearchParams();
  const next = sp.get("next") || "/dashboard";

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    const eTrim = email.trim();
    if (!eTrim) return setErr("Email requis");
    if (!isValidEmail(eTrim)) return setErr("Email invalide");
    if (!password) return setErr("Mot de passe requis");

    try {
      setBusy(true);
      // compat: certains context n’ont que login(email)
      if (login.length >= 2) await login(eTrim, password);
      else await login(eTrim);
      nav(next, { replace: true });
    } catch (ex) {
      const api = ex?.response?.data;
      const msg =
        typeof api === "string" ? api :
        api?.detail || api?.message || ex?.message || "Echec de connexion.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <h4 className="mt-3 mb-3">Connexion</h4>

      <form className="card p-3" onSubmit={submit} noValidate>
        <label className="form-label">Email</label>
        <input
          className="form-control"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@exemple.com"
          disabled={busy}
        />

        <label className="form-label mt-3">Mot de passe</label>
        <div className="input-group">
          <input
            className="form-control"
            type={showPwd ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Votre mot de passe"
            disabled={busy}
          />
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setShowPwd((v) => !v)}
            disabled={busy}
            aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {showPwd ? "Cacher" : "Afficher"}
          </button>
        </div>

        {err && <div className="text-danger mt-2">{err}</div>}

        <button className="btn btn-dark mt-3" disabled={busy}>
          {busy ? "Connexion..." : "Se connecter"}
        </button>
      </form>

      <p className="mt-3">
        Pas de compte ? <Link to={`/register?next=${encodeURIComponent(next)}`}>Creer</Link>
      </p>
    </div>
  );
}
