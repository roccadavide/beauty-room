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
export const createResult = async (resultData, file) => {
  const formData = buildFormData(resultData, file);

  try {
    const { data } = await http.post(RESULT_ENDPOINTS.BASE, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore nella creazione del risultato.";
    throw new Error(message);
  }
};

// -------------------------- UPDATE --------------------------
export const updateResult = async (resultId, resultData, file) => {
  const formData = buildFormData(resultData, file);

  try {
    const { data } = await http.put(RESULT_ENDPOINTS.BY_ID(resultId), formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
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

// -------------------------- HELPERS --------------------------
function buildFormData(resultData, file) {
  const formData = new FormData();
  formData.append("data", new Blob([JSON.stringify(resultData)], { type: "application/json" }));

  if (file) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) throw new Error("Immagine troppo grande (max 5MB)");
    if (!file.type.startsWith("image/")) throw new Error("File non valido: carica un'immagine");
    formData.append("image", file);
  }

  return formData;
}
