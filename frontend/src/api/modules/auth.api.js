import http from "../httpClient";
import { AUTH_ENDPOINTS } from "../endpoints";

// -------------------------- LOGIN --------------------------
export const loginUser = async payload => {
  try {
    const { data } = await http.post(AUTH_ENDPOINTS.LOGIN, payload);
    return data;
  } catch (error) {
    const message = error?.normalized?.message || error.response?.data?.message || "Credenziali non valide o errore di rete.";
    throw new Error(message);
  }
};

// -------------------------- REGISTER --------------------------
export const registerUser = async payload => {
  try {
    const { data } = await http.post(AUTH_ENDPOINTS.REGISTER, payload);
    return data;
  } catch (error) {
    const message = error?.normalized?.message || error.response?.data?.message || "Errore durante la registrazione. Riprova più tardi.";
    throw new Error(message);
  }
};
