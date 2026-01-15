import http from "../httpClient";
import { ORDER_ENDPOINTS } from "../endpoints";

// ---------------------------------- ORDERS ----------------------------------

// -------------------------- GET ALL (ADMIN) --------------------------
export const fetchOrders = async (params = { page: 0, size: 10, sort: "customerName" }) => {
  try {
    const { data } = await http.get(ORDER_ENDPOINTS.BASE, { params });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare gli ordini.";
    throw new Error(message);
  }
};

// -------------------------- GET MY ORDERS --------------------------
export const fetchMyOrders = async () => {
  try {
    const { data } = await http.get(ORDER_ENDPOINTS.ME);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare i tuoi ordini.";
    throw new Error(message);
  }
};

// -------------------------- GET BY ID (OWNER/ADMIN) --------------------------
export const fetchOrderById = async orderId => {
  try {
    const { data } = await http.get(ORDER_ENDPOINTS.BY_ID(orderId));
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare l’ordine.";
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

// -------------------------- DELETE (OWNER/ADMIN) --------------------------
export const deleteOrder = async orderId => {
  try {
    await http.delete(ORDER_ENDPOINTS.BY_ID(orderId));
    return true;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante l’eliminazione dell’ordine.";
    throw new Error(message);
  }
};
