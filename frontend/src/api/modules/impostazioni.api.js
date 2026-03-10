import { SETTINGS_ENDPOINTS } from "../endpoints";
import http from "../httpClient";

/* ============================================================
   WORKING HOURS
   ============================================================ */

export const getWorkingHours = async () => {
  try {
    const { data } = await http.get(SETTINGS_ENDPOINTS.WORKING_HOURS);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare gli orari di apertura.";
    throw new Error(message);
  }
};

export const updateWorkingHours = async (id, dto) => {
  try {
    const { data } = await http.put(SETTINGS_ENDPOINTS.WORKING_HOURS_BY_ID(id), dto);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante il salvataggio degli orari.";
    throw new Error(message);
  }
};

export const initDefaultWeek = async () => {
  try {
    const { data } = await http.post(SETTINGS_ENDPOINTS.WORKING_HOURS_INIT);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l'inizializzazione della settimana.";
    throw new Error(message);
  }
};

/* ============================================================
   CLOSURES
   ============================================================ */

export const getAllClosures = async () => {
  try {
    const { data } = await http.get(SETTINGS_ENDPOINTS.CLOSURES);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare le chiusure.";
    throw new Error(message);
  }
};

export const createClosure = async dto => {
  try {
    const { data } = await http.post(SETTINGS_ENDPOINTS.CLOSURES, dto);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la creazione della chiusura.";
    throw new Error(message);
  }
};

export const updateClosure = async (id, dto) => {
  try {
    const { data } = await http.put(SETTINGS_ENDPOINTS.CLOSURE_BY_ID(id), dto);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l'aggiornamento della chiusura.";
    throw new Error(message);
  }
};

export const deleteClosure = async id => {
  try {
    await http.delete(SETTINGS_ENDPOINTS.CLOSURE_BY_ID(id));
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l'eliminazione della chiusura.";
    throw new Error(message);
  }
};
