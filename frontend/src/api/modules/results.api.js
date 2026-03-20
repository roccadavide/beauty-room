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

// -------------------------- HELPERS --------------------------
// Costruisce un FormData con il blob JSON "data" + i file in "images"
export function buildResultFormData(resultData, files = []) {
  const formData = new FormData();
  formData.append("data", new Blob([JSON.stringify(resultData)], { type: "application/json" }));

  const MAX_SIZE = 5 * 1024 * 1024;
  files.forEach(file => {
    if (file.size > MAX_SIZE) throw new Error("Immagine troppo grande (max 5MB)");
    if (!file.type.startsWith("image/")) throw new Error("File non valido: carica un'immagine");
    formData.append("images", file);
  });

  return formData;
}
