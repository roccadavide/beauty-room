import http from "../httpClient";
import { STRIPE_ENDPOINTS } from "../endpoints";

// ---------------------------------- STRIPE ----------------------------------

// --------------------------- CHECKOUT ORDER USERS ---------------------------
export const createCheckoutSession = async orderData => {
  try {
    const { data } = await http.post(STRIPE_ENDPOINTS.CHECKOUT, orderData);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la creazione della sessione di pagamento.";
    throw new Error(message);
  }
};

// --------------------------- CHECKOUT ORDER GUESTS ---------------------------
export const createCheckoutSessionGuest = async orderData => {
  try {
    const { data } = await http.post(STRIPE_ENDPOINTS.CHECKOUT_GUEST, orderData);
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

// --------------------------- CHECKOUT BOOKING ADMIN ---------------------------
export const createBookingCheckoutSessionAuth = async payload => {
  try {
    const { data } = await http.post(STRIPE_ENDPOINTS.CHECKOUT_BOOKING, payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la creazione della sessione di pagamento.";
    throw new Error(message);
  }
};

// --------------------------- CHECKOUT BOOKING GUESTS ---------------------------
export const createBookingCheckoutSessionGuest = async payload => {
  try {
    const { data } = await http.post(STRIPE_ENDPOINTS.CHECKOUT_BOOKING_GUEST, payload);
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Errore durante la creazione della sessione di pagamento.";
    throw new Error(message);
  }
};

// --------------------------- BOOKING SUMMARY ---------------------------
export const fetchBookingSummary = async sessionId => {
  const { data } = await http.get(STRIPE_ENDPOINTS.BOOKING_SUMMARY, {
    params: { session_id: sessionId },
  });
  return data;
};
