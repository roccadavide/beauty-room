import http from "../httpClient";
import { USER_ENDPOINTS } from "../endpoints";

// ---------------------------------- USERS ----------------------------------

// -------------------------- GET CURRENT USER --------------------------
export const fetchCurrentUser = async () => {
  try {
    const { data } = await http.get(USER_ENDPOINTS.ME);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare i dati utente.";
    throw new Error(message);
  }
};

// -------------------------- UPDATE USER --------------------------
export const updateUser = async (userId, payload) => {
  try {
    const { data } = await http.put(USER_ENDPOINTS.BY_ID(userId), payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l’aggiornamento del profilo utente.";
    throw new Error(message);
  }
};

// -------------------------- PATCH PASSWORD --------------------------
export const patchPassword = async (userId, payload) => {
  try {
    const { data } = await http.patch(USER_ENDPOINTS.CHANGE_PASSWORD(userId), payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l’aggiornamento della password.";
    throw new Error(message);
  }
};
