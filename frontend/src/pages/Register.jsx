import React, { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const isValidEmail = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());

export default function Register() {
  const nav = useNavigate();
  const { register, login } = useAuth();
  const [sp] = useSearchParams();
  const next = sp.get("next") || "/ask";

  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [busy, setBusy]           = useState(false);
  const [err, setErr]             = useState("");
  const [ok, setOk]               = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setOk("");

    const eTrim = email.trim();
    if (!eTrim) return setErr("Email requis");
    if (!isValidEmail(eTrim)) return setErr("Email invalide");
    if (!password) return setErr("Mot de passe requis");
    if (password.length < 6) return setErr("Mot de passe trop court (>= 6)");
    if (password !== confirm) return setErr("Confirmation non identique");

    try {
      setBusy(true);
      // compat: certains context ont register(email, password); sinon simule via login
      if (typeof register === "function" && register.length >= 2) {
        await register(eTrim, password);
      }
      // auto-login apres inscription si possible
      if (typeof login === "function") {
        if (login.length >= 2) await login(eTrim, password);
        else await login(eTrim);
      }
      setOk("Compte cree avec succes");
      nav(next, { replace: true });
    } catch (ex) {
      const api = ex?.response?.data;
      const msg =
        typeof api === "string" ? api :
        api?.detail || api?.message || ex?.message || "Echec inscription.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <h4 className="mt-3 mb-3">Inscription</h4>

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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Au moins 6 caracteres"
            disabled={busy}
          />
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setShowPwd((v) => !v)}
            disabled={busy}
          >
            {showPwd ? "Cacher" : "Afficher"}
          </button>
        </div>

        <label className="form-label mt-3">Confirmer</label>
        <input
          className="form-control"
          type={showPwd ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeter le mot de passe"
          disabled={busy}
        />

        {err && <div className="text-danger mt-2">{err}</div>}
        {ok  && <div className="text-success mt-2">{ok}</div>}

        <button className="btn btn-dark mt-3" disabled={busy}>
          {busy ? "Creation..." : "Creer"}
        </button>
      </form>

      <p className="mt-3">
        Deja inscrit ? <Link to={`/login?next=${encodeURIComponent(next)}`}>Se connecter</Link>
      </p>
    </div>
  );
}
