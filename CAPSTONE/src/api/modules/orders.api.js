const BASE = import.meta.env.VITE_API_BASE_URL;

// ---------------------------------- ORDERS ----------------------------------

// -------------------------- GET --------------------------
export async function fetchOrders(token) {
  const res = await fetch(`${BASE}/orders`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Impossibile recuperare l'ordine");
  return res.json();
}

// -------------------------- GET MY --------------------------
export async function fetchMyOrders(token, email) {
  const res = await fetch(`${BASE}/orders/email/${email}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Impossibile recuperare l'ordine");
  return res.json();
}

// -------------------------- POST --------------------------
export async function createOrder(payload, token) {
  const res = await fetch(`${BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  try {
    return res.ok ? JSON.parse(text) : Promise.reject(JSON.parse(text));
  } catch {
    return res.ok ? text : Promise.reject(text);
  }
}

// -------------------------- DELETE --------------------------
export const deleteOrder = async (orderId, token) => {
  if (!token) throw new Error("Token mancante");

  const res = await fetch(`${BASE}/orders/${orderId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Errore eliminazione servizio: ${errorText}`);
  }

  return true;
};
