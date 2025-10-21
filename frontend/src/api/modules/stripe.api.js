import http from "../httpClient";
import { STRIPE_ENDPOINTS } from "../endpoints";

// ---------------------------------- STRIPE ----------------------------------

// --------------------------- CHECKOUT USERS ---------------------------
export const createCheckoutSession = async orderData => {
  try {
    const { data } = await http.post(STRIPE_ENDPOINTS.CHECKOUT, orderData, {
      headers: { "Content-Type": "application/json" },
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la creazione della sessione di pagamento.";
    throw new Error(message);
  }
};

// --------------------------- CHECKOUT GUESTS ---------------------------
export const createCheckoutSessionGuest = async orderData => {
  try {
    const { data } = await http.post(STRIPE_ENDPOINTS.CHECKOUT_GUEST, orderData, {
      headers: { "Content-Type": "application/json" },
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la creazione della sessione di pagamento.";
    throw new Error(message);
  }
};

// --------------------------- ORDER SUMMARY ---------------------------
export const fetchOrderSummary = async sessionId => {
  const { data } = await http.get(`${STRIPE_ENDPOINTS.ORDER_SUMMARY}`, {
    params: { session_id: sessionId },
  });
  return data;
};
