import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../api/api";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?[0-9]{7,15}$/;

const Register = () => {
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", surname: "", email: "", password: "", phone: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  function onChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors(prev => ({ ...prev, [e.target.name]: null }));
  }

  function validate() {
    const err = {};
    if (!form.name.trim()) err.name = "Il nome non può essere vuoto";
    if (!form.surname.trim()) err.surname = "Il cognome non può essere vuoto";
    if (!emailRegex.test(form.email)) err.email = "Email non valida";
    if (form.password.length < 8) err.password = "La password deve essere di almeno 8 caratteri";
    if (!phoneRegex.test(form.phone)) err.phone = "Numero di telefono non valido";
    return err;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError(null);
    const v = validate();
    if (Object.keys(v).length) {
      setErrors(v);
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        name: form.name,
        surname: form.surname,
        email: form.email,
        password: form.password,
        phone: form.phone,
      });

      setSuccessMessage("Registrazione avvenuta con successo! Reindirizzamento al login...");

      setTimeout(() => {
        nav("/login", { replace: true });
      }, 3500);
    } catch (err) {
      console.error(err);
      if (typeof err === "string") setServerError(err);
      else if (err?.message) setServerError(err.message);
      else if (err?.errors) setServerError(Object.values(err.errors).join(", "));
      else setServerError("Errore durante la registrazione");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="register-page">
      <div className="register-card">
        <div className="register-left">
          <header className="register-header">
            <h2>Registrati</h2>
            <p className="muted">Crea il tuo account per prenotare servizi e gestire le tue prenotazioni.</p>
          </header>

          {serverError && (
            <div className="server-error" role="alert">
              {serverError}
            </div>
          )}

          {successMessage && (
            <div className="success-badge" role="alert">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="register-form" noValidate disabled={!!successMessage}>
            <div className="register-row">
              <div className="field">
                <label htmlFor="name">Nome</label>
                <input id="name" name="name" value={form.name} onChange={onChange} aria-invalid={errors.name ? "true" : "false"} placeholder="" />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>

              <div className="field">
                <label htmlFor="surname">Cognome</label>
                <input id="surname" name="surname" value={form.surname} onChange={onChange} aria-invalid={errors.surname ? "true" : "false"} placeholder="" />
                {errors.surname && <span className="field-error">{errors.surname}</span>}
              </div>
            </div>

            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                value={form.email}
                onChange={onChange}
                aria-invalid={errors.email ? "true" : "false"}
                placeholder=""
                inputMode="email"
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            <div className="field password-field">
              <label htmlFor="password">Password</label>
              <div className="password-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={onChange}
                  aria-invalid={errors.password ? "true" : "false"}
                  placeholder=""
                />
                <button
                  type="button"
                  className="toggle-pass"
                  onClick={() => setShowPassword(p => !p)}
                  aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                >
                  {showPassword ? "👁️‍🗨️" : "👁️"}
                </button>
              </div>
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            <div className="field">
              <label htmlFor="phone">Telefono</label>
              <input
                id="phone"
                name="phone"
                value={form.phone}
                onChange={onChange}
                aria-invalid={errors.phone ? "true" : "false"}
                placeholder="+39..."
                inputMode="tel"
              />
              {errors.phone && <span className="field-error">{errors.phone}</span>}
            </div>

            <div className="actions">
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading && <span className="btn-spinner" aria-hidden="true"></span>}
                <span>{loading ? "Invio..." : "Registrati"}</span>
              </button>
              <Link to={"/login"}>Ho già un account</Link>
            </div>
          </form>
        </div>

        <div className="register-right" aria-hidden="true">
          <img src="/chisono-michela.jpeg" alt="Michela - estetista" className="img-register" />
          <div className="photo-caption">Benvenuta! Qui puoi creare il tuo account.</div>
        </div>
      </div>
    </div>
  );
};

export default Register;
