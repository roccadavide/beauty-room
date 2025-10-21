import http from "../httpClient";
import { PRODUCT_ENDPOINTS } from "../endpoints";

// ---------------------------------- PRODUCTS ----------------------------------

// -------------------------- GET ALL --------------------------
export const fetchProducts = async () => {
  try {
    const { data } = await http.get(PRODUCT_ENDPOINTS.BASE);
    return data.content || data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare i prodotti.";
    throw new Error(message);
  }
};

// -------------------------- GET BY ID --------------------------
export const fetchProductById = async productId => {
  try {
    const { data } = await http.get(PRODUCT_ENDPOINTS.BY_ID(productId));
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare il prodotto.";
    throw new Error(message);
  }
};

// -------------------------- CREATE --------------------------
export const createProduct = async (productData, file) => {
  const formData = buildFormData(productData, file);

  try {
    const { data } = await http.post(PRODUCT_ENDPOINTS.BASE, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore nella creazione del prodotto.";
    throw new Error(message);
  }
};

// -------------------------- UPDATE --------------------------
export const updateProduct = async (productId, productData, file) => {
  const formData = buildFormData(productData, file);

  try {
    const { data } = await http.put(PRODUCT_ENDPOINTS.BY_ID(productId), formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore nell’aggiornamento del prodotto.";
    throw new Error(message);
  }
};

// -------------------------- DELETE --------------------------
export const deleteProduct = async productId => {
  try {
    await http.delete(PRODUCT_ENDPOINTS.BY_ID(productId));
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l’eliminazione del prodotto.";
    throw new Error(message);
  }
};

// -------------------------- HELPERS --------------------------
function buildFormData(productData, file) {
  const formData = new FormData();
  formData.append("data", new Blob([JSON.stringify(productData)], { type: "application/json" }));

  if (file) {
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) throw new Error("Immagine troppo grande (max 5MB)");
    if (!file.type.startsWith("image/")) throw new Error("File non valido: carica un'immagine");
    formData.append("image", file);
  }

  return formData;
}
