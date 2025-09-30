import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchCurrentUser, loginUser } from "../api/api";
import { useDispatch } from "react-redux";
import { loginSuccess } from "../redux/action/authActions";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Login = () => {
  const nav = useNavigate();
  const dispatch = useDispatch();
  const [form, setForm] = useState({ email: "", password: "" });
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
    if (!emailRegex.test(form.email)) err.email = "Email non valida";
    if (form.password.length < 8) err.password = "La password deve essere di almeno 8 caratteri";
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
      const data = await loginUser({
        email: form.email,
        password: form.password,
      });

      const token = data.accessToken;

      console.log(token);

      const user = await fetchCurrentUser(token);

      console.log(user);

      dispatch(loginSuccess(user, token));

      setSuccessMessage("Accesso avvenuto con successo! Reindirizzamento alla homepage...");

      setTimeout(() => {
        nav("/", { replace: true });
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
            <h2>Accedi</h2>
            <p className="muted">Accedi al tuo account per prenotare servizi e gestire le tue prenotazioni.</p>
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
            <div className="actions">
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading && <span className="btn-spinner" aria-hidden="true"></span>}
                <span>{loading ? "Invio..." : "Accedi"}</span>
              </button>

              <Link to={"/register"}>Non ho un account</Link>
            </div>
          </form>
        </div>

        <div className="register-right" aria-hidden="true">
          <img src="/chisono-michela.jpeg" alt="Michela - estetista" className="img-register" />
          <div className="photo-caption">Benvenuta! Qui puoi accedere al tuo account.</div>
        </div>
      </div>
    </div>
  );
};

export default Login;
