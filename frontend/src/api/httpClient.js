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

/* RESPONSE INTERCEPTOR — silent refresh on 401 */
let refreshPromise = null;

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
        if (!refreshPromise) {
          refreshPromise = axios.post(
            `${API_BASE}/auth/refresh`,
            null,
            { withCredentials: true, timeout: 10000 }
          );
        }
        const res = await refreshPromise;
        refreshPromise = null;

        const newAccessToken = res.data?.accessToken;
        if (newAccessToken) {
          setAccessToken(newAccessToken);
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
        }
      } catch {
        refreshPromise = null;
      }

      clearAccessToken();
      store.dispatch(logout());
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      return Promise.reject(error);
    }

    if (status === 403) {
      clearAccessToken();
      store.dispatch(logout());
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }

    return Promise.reject(error);
  }
);

export default http;
