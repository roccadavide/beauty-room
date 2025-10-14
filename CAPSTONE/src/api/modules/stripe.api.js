const BASE = import.meta.env.VITE_API_BASE_URL;

// ---------------------------------- STRIPE ----------------------------------

export async function createCheckoutSession(orderData) {
  const res = await fetch(`${BASE}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderData),
  });

  if (!res.ok) {
    throw new Error("Errore durante la creazione della sessione di pagamento.");
  }

  return res.json();
}
