import http from "../httpClient";
import { SERVICE_ENDPOINTS } from "../endpoints";
import { getCached, setCached, invalidateCache } from "../apiCache";

// ---------------------------------- SERVICES ----------------------------------

// -------------------------- GET ALL --------------------------
export const fetchServices = async (includeInactive = false) => {
  try {
    const KEY = includeInactive ? "services_admin" : "services";
    const cached = getCached(KEY);
    if (cached) return cached;
    const params = includeInactive ? { includeInactive: true } : {};
    const { data } = await http.get(SERVICE_ENDPOINTS.BASE, { params });
    const result = data.content || data;
    setCached(KEY, result);
    return result;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare i servizi.";
    throw new Error(message);
  }
};

// -------------------------- GET BY ID --------------------------
export const fetchServiceById = async serviceId => {
  try {
    const KEY = "service_" + serviceId;
    const cached = getCached(KEY);
    if (cached) return cached;
    const { data } = await http.get(SERVICE_ENDPOINTS.BY_ID(serviceId));
    setCached(KEY, data);
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
    invalidateCache("services", "services_admin");
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
    invalidateCache("services", "services_admin");
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
    invalidateCache("services", "services_admin", "service_" + serviceId);
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l’eliminazione del servizio.";
    throw new Error(message);
  }
};

export const createServiceOption = async (serviceId, optionPayload) => {
  try {
    const { data } = await http.post(SERVICE_ENDPOINTS.CREATE_OPTION(serviceId), optionPayload, {
      headers: { "Content-Type": "application/json" },
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore nella creazione dell’opzione servizio.";
    throw new Error(message);
  }
};

export const updateServiceOption = async (optionId, optionPayload) => {
  try {
    const { data } = await http.put(SERVICE_ENDPOINTS.UPDATE_OPTION(optionId), optionPayload, {
      headers: { "Content-Type": "application/json" },
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore nell’aggiornamento dell’opzione servizio.";
    throw new Error(message);
  }
};

export const deleteServiceOption = async optionId => {
  try {
    await http.delete(SERVICE_ENDPOINTS.DELETE_OPTION(optionId));
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l’eliminazione dell’opzione servizio.";
    throw new Error(message);
  }
};

export const patchServiceFeatured = async (id, value, token) => {
  try {
    const { data } = await http.patch(`${SERVICE_ENDPOINTS.BY_ID(id)}/featured`, null, {
      params: { value },
      headers: { Authorization: `Bearer ${token}` },
    });
    invalidateCache("services");
    invalidateCache("service_" + id);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore nell’aggiornamento dell’evidenza del servizio.";
    throw new Error(message);
  }
};
