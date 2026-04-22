import http from "../httpClient";
import { PRODUCT_ENDPOINTS } from "../endpoints";
import { getCached, setCached, invalidateCache } from "../apiCache";

// ---------------------------------- PRODUCTS ----------------------------------

// -------------------------- GET ALL --------------------------
export const fetchProducts = async (includeInactive = false) => {
  try {
    const KEY = includeInactive ? "products_admin" : "products";
    const cached = getCached(KEY);
    if (cached) return cached;
    const params = includeInactive ? { includeInactive: true } : {};
    const { data } = await http.get(PRODUCT_ENDPOINTS.BASE, { params });
    const result = data.content || data;
    setCached(KEY, result);
    return result;
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
// buildFormData rimosso — usa src/api/utils/multipart.js
export const createProduct = async formData => {
  try {
    const { data } = await http.post(PRODUCT_ENDPOINTS.BASE, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    invalidateCache("products", "products_admin");
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore nella creazione del prodotto.";
    throw new Error(message);
  }
};

// -------------------------- UPDATE --------------------------
export const updateProduct = async (productId, formData) => {
  try {
    const { data } = await http.put(PRODUCT_ENDPOINTS.BY_ID(productId), formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    invalidateCache("products", "products_admin");
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
    invalidateCache("products", "products_admin");
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l’eliminazione del prodotto.";
    throw new Error(message);
  }
};


// -------------------------- PRODUCT OPTIONS --------------------------

export const createProductOption = async (productId, optionPayload) => {
  try {
    const { data } = await http.post(PRODUCT_ENDPOINTS.CREATE_OPTION(productId), optionPayload, {
      headers: { "Content-Type": "application/json" },
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore nella creazione dell'opzione prodotto.";
    throw new Error(message);
  }
};

export const updateProductOption = async (optionId, optionPayload) => {
  try {
    const { data } = await http.put(PRODUCT_ENDPOINTS.UPDATE_OPTION(optionId), optionPayload, {
      headers: { "Content-Type": "application/json" },
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore nell'aggiornamento dell'opzione prodotto.";
    throw new Error(message);
  }
};

export const deleteProductOption = async optionId => {
  try {
    await http.delete(PRODUCT_ENDPOINTS.DELETE_OPTION(optionId));
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l'eliminazione dell'opzione prodotto.";
    throw new Error(message);
  }
};

// -------------------------- STOCK ALERT --------------------------
export const subscribeStockAlert = async (productId, email, customerName) => {
  try {
    const { data } = await http.post(
      `${PRODUCT_ENDPOINTS.BY_ID(productId)}/stock-alerts`,
      { email, customerName }
    );
    return data;
  } catch (error) {
    if (error.response?.status === 409) {
      throw new Error("ALREADY_SUBSCRIBED");
    }
    throw new Error(error.response?.data?.message || "Impossibile registrare l'avviso.");
  }
};
