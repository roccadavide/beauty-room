import http from "../httpClient";
import { ORDER_ENDPOINTS } from "../endpoints";

// ---------------------------------- ORDERS ----------------------------------

// -------------------------- GET ALL --------------------------
export const fetchOrders = async () => {
  try {
    const { data } = await http.get(ORDER_ENDPOINTS.BASE);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare gli ordini.";
    throw new Error(message);
  }
};

// -------------------------- GET BY EMAIL --------------------------
export const fetchMyOrders = async email => {
  try {
    const { data } = await http.get(ORDER_ENDPOINTS.BY_EMAIL(email));
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare gli ordini utente.";
    throw new Error(message);
  }
};

// -------------------------- CREATE --------------------------
export const createOrder = async payload => {
  try {
    const { data } = await http.post(ORDER_ENDPOINTS.BASE, payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la creazione dell’ordine.";
    throw new Error(message);
  }
};

// -------------------------- DELETE --------------------------
export const deleteOrder = async orderId => {
  try {
    await http.delete(ORDER_ENDPOINTS.BY_ID(orderId));
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l’eliminazione dell’ordine.";
    throw new Error(message);
  }
};
