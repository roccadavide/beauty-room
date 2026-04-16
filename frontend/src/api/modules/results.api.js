import http from "../httpClient";
import { RESULT_ENDPOINTS } from "../endpoints";

// ---------------------------------- RESULTS ----------------------------------

// -------------------------- GET ALL --------------------------
export const fetchResults = async () => {
  try {
    const { data } = await http.get(RESULT_ENDPOINTS.BASE);
    return data.content || data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare i risultati.";
    throw new Error(message);
  }
};

// -------------------------- GET BY ID --------------------------
export const fetchResultById = async resultId => {
  try {
    const { data } = await http.get(RESULT_ENDPOINTS.BY_ID(resultId));
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare il risultato.";
    throw new Error(message);
  }
};

// -------------------------- CREATE --------------------------
// formData deve essere un FormData pre-costruito con "data" (JSON blob) + "images" (files)
export const createResult = async (formData) => {
  try {
    const { data } = await http.post(RESULT_ENDPOINTS.BASE, formData);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore nella creazione del risultato.";
    throw new Error(message);
  }
};

// -------------------------- UPDATE --------------------------
export const updateResult = async (resultId, formData) => {
  try {
    const { data } = await http.put(RESULT_ENDPOINTS.BY_ID(resultId), formData);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore nell’aggiornamento del risultato.";
    throw new Error(message);
  }
};

// -------------------------- DELETE --------------------------
export const deleteResult = async resultId => {
  try {
    await http.delete(RESULT_ENDPOINTS.BY_ID(resultId));
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l’eliminazione del risultato.";
    throw new Error(message);
  }
};

export const patchResultFeatured = async (id, value, token) => {
  try {
    const { data } = await http.patch(`${RESULT_ENDPOINTS.BY_ID(id)}/featured`, null, {
      params: { value },
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore nell’aggiornamento dell’evidenza del risultato.";
    throw new Error(message);
  }
};

// buildFormData rimosso — usa src/api/utils/multipart.js
