import axios from "axios";
import { clearToken, getToken, saveToken } from "../utils/token";

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
    const token = getToken();
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
            `${API_BASE}/auth/refresh`, null,
            { withCredentials: true, timeout: 10000 }
          );
        }
        const res = await refreshPromise;
        refreshPromise = null;

        const newAccessToken = res.data?.accessToken;
        if (newAccessToken) {
          saveToken(newAccessToken);
          original.headers.Authorization = `Bearer ${newAccessToken}`;
          return http(original);
        }
      } catch {
        refreshPromise = null;
      }

      clearToken();
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      return Promise.reject(error);
    }

    if (status === 403) {
      clearToken();
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }

    return Promise.reject(error);
  }
);

export default http;
