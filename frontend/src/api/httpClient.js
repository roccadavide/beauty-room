import axios from "axios";
import { clearAccessToken, getAccessToken, setAccessToken } from "../utils/token";
import store from "../app/store";
import { loginSuccess, logout } from "../features/auth/slices/auth.slice";
import { USER_ENDPOINTS } from "./endpoints";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const http = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

/* REQUEST INTERCEPTOR */
http.interceptors.request.use(
  config => {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;

    if (config.isMultipart && config.data && !(config.data instanceof FormData)) {
      const form = new FormData();
      Object.entries(config.data).forEach(([k, v]) => form.append(k, v));
      config.data = form;
    }

    return config;
  },
  error => Promise.reject(error)
);

/* ---------- SINGLE-FLIGHT REFRESH ---------- */
// Shared by the response interceptor AND main.jsx boot path. A single in-flight
// promise dedupes concurrent refresh attempts: without this, a boot refresh and
// an interceptor 401 refresh would each consume the same rotating cookie and the
// second one would look like a reuse attack to the backend → forced logout.
const REFRESH_TIMEOUT_MS = 30000;
const REFRESH_RETRY_DELAYS_MS = [0, 1000, 3000];

let refreshInFlight = null;

const sleep = ms => new Promise(r => setTimeout(r, ms));

const isNetworkOrTransientError = err => {
  if (!err) return false;
  if (err.code === "ERR_NETWORK" || err.code === "ECONNABORTED") return true;
  if (!err.response) return true; // no response = network / timeout / aborted
  const s = err.response.status;
  return s >= 500 && s < 600;
};

const makeRefreshError = (kind, message, cause) => {
  const e = new Error(message);
  e.kind = kind;
  if (cause) e.cause = cause;
  return e;
};

const doRefresh = async () => {
  let lastTransientErr = null;
  for (let i = 0; i < REFRESH_RETRY_DELAYS_MS.length; i++) {
    if (REFRESH_RETRY_DELAYS_MS[i] > 0) await sleep(REFRESH_RETRY_DELAYS_MS[i]);
    try {
      const res = await axios.post(`${API_BASE}/auth/refresh`, null, {
        withCredentials: true,
        timeout: REFRESH_TIMEOUT_MS,
      });
      const token = res.data?.accessToken;
      if (!token) throw makeRefreshError("auth", "Refresh response missing accessToken");
      setAccessToken(token);
      return token;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        // Genuine auth failure — refresh cookie invalid/expired/revoked. No retry.
        throw makeRefreshError("auth", "Refresh rejected by server", err);
      }
      if (!isNetworkOrTransientError(err)) {
        // Unexpected non-transient error (e.g. 400) — treat as auth failure.
        throw makeRefreshError("auth", "Refresh failed unexpectedly", err);
      }
      lastTransientErr = err;
    }
  }
  throw makeRefreshError("network", "Refresh network-failed after retries", lastTransientErr);
};

export const refreshAccessToken = () => {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
};

const emitToast = (variant, text) => {
  window.dispatchEvent(new CustomEvent("app:toast", { detail: { variant, text } }));
};

/* RESPONSE INTERCEPTOR — silent refresh on 401, soft-fail on 403/network */
http.interceptors.response.use(
  response => response,
  async error => {
    const status = error?.response?.status ?? 0;
    const data = error?.response?.data;
    const original = error.config;

    error.normalized = {
      status,
      message: data?.message || data?.error || error.message || "Si è verificato un errore imprevisto.",
      details: data?.details ?? null,
      path: data?.path ?? null,
      timestamp: data?.timestamp ?? null,
    };

    // Skip refresh for auth endpoints themselves or already retried requests
    const isAuthUrl = original?.url?.startsWith("/auth/");
    if (status === 401 && !original._retried && !isAuthUrl) {
      original._retried = true;

      try {
        const newAccessToken = await refreshAccessToken();
        try {
          const meRes = await axios.get(`${API_BASE}${USER_ENDPOINTS.ME}`, {
            withCredentials: true,
            headers: { Authorization: `Bearer ${newAccessToken}` },
            timeout: 10000,
          });
          store.dispatch(loginSuccess({ user: meRes.data, accessToken: newAccessToken }));
        } catch {
          // se /users/me fallisce, lasceremo che la prossima chiamata gestisca l'errore
        }
        original.headers.Authorization = `Bearer ${newAccessToken}`;
        return http(original);
      } catch (refreshErr) {
        if (refreshErr?.kind === "network") {
          // Backend unreachable / cold-start / transient 5xx: stay logged in, surface a toast.
          // The next user action will re-trigger refresh.
          emitToast("warning", "Connessione instabile, riprova tra qualche secondo");
          return Promise.reject(error);
        }
        // Genuine auth failure → hard logout.
        clearAccessToken();
        store.dispatch(logout());
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
        return Promise.reject(error);
      }
    }

    // H-01: 403 outside /auth/refresh means "logged in but not authorized for THIS action".
    // Do NOT force logout — surface a toast and let the caller handle the failed request.
    if (status === 403 && !isAuthUrl) {
      emitToast("warning", "Non autorizzato per questa azione");
    }

    return Promise.reject(error);
  }
);

export default http;
