import http from "../httpClient";
import { USER_ENDPOINTS, APP_SETTINGS_ENDPOINTS } from "../endpoints";

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

// -------------------------- ADMIN: LIST ALL USERS --------------------------
export const fetchAllUsers = async ({ page = 0, size = 20, sort = "name" } = {}) => {
  try {
    const { data } = await http.get(USER_ENDPOINTS.BASE, { params: { page, size, sort } });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante il caricamento degli utenti.";
    throw new Error(message);
  }
};

// -------------------------- ADMIN: PATCH VERIFY --------------------------
export const patchUserVerified = async (userId, verified) => {
  try {
    const { data } = await http.patch(USER_ENDPOINTS.VERIFY(userId), null, { params: { verified } });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l’aggiornamento del cliente.";
    throw new Error(message);
  }
};

// -------------------------- SETTINGS: CANCELLATION POLICY --------------------------
export const fetchCancellationPolicy = async () => {
  try {
    const { data } = await http.get(APP_SETTINGS_ENDPOINTS.CANCELLATION_POLICY);
    return data;
  } catch {
    return { cancellationHoursLimit: 24 };
  }
};

export const patchCancellationHoursLimit = async hours => {
  try {
    const { data } = await http.patch(APP_SETTINGS_ENDPOINTS.CANCELLATION_HOURS_LIMIT, { cancellationHoursLimit: hours });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante il salvataggio.";
    throw new Error(message);
  }
};
