import axios from "axios";
import { clearToken, getToken } from "../utils/token";

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  headers: {
    Accept: "application/json",
  },
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

/* RESPONSE INTERCEPTOR */
http.interceptors.response.use(
  response => response,
  error => {
    const status = error?.response?.status ?? 0;
    const data = error?.response?.data;

    error.normalized = {
      status,
      message: data?.message || data?.error || error.message || "Si è verificato un errore imprevisto.",
      details: data?.details ?? null,
      path: data?.path ?? null,
      timestamp: data?.timestamp ?? null,
    };

    if (status === 401 || status === 403) {
      clearToken();
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }

    return Promise.reject(error);
  }
);

export default http;
