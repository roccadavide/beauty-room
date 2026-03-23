import http from "../httpClient";
import { SERVICE_ENDPOINTS } from "../endpoints";

// ---------------------------------- SERVICES ----------------------------------

// -------------------------- GET ALL --------------------------
export const fetchServices = async () => {
  try {
    const { data } = await http.get(SERVICE_ENDPOINTS.BASE);
    return data.content || data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare i servizi.";
    throw new Error(message);
  }
};

// -------------------------- GET BY ID --------------------------
export const fetchServiceById = async serviceId => {
  try {
    const { data } = await http.get(SERVICE_ENDPOINTS.BY_ID(serviceId));
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare il servizio.";
    throw new Error(message);
  }
};

// -------------------------- CREATE --------------------------
// buildFormData rimosso — usa src/api/utils/multipart.js
export const createService = async formData => {
  try {
    const { data } = await http.post(SERVICE_ENDPOINTS.BASE, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore nella creazione del servizio.";
    throw new Error(message);
  }
};

// -------------------------- UPDATE --------------------------
export const updateService = async (serviceId, formData) => {
  try {
    const { data } = await http.put(SERVICE_ENDPOINTS.BY_ID(serviceId), formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore nell’aggiornamento del servizio.";
    throw new Error(message);
  }
};

// -------------------------- DELETE --------------------------
export const deleteService = async serviceId => {
  try {
    await http.delete(SERVICE_ENDPOINTS.BY_ID(serviceId));
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l’eliminazione del servizio.";
    throw new Error(message);
  }
};

