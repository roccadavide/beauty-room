const BASE = import.meta.env.VITE_API_BASE_URL;

// ---------------------------------- PRODUCTS ----------------------------------

// -------------------------- GET --------------------------
export async function fetchProducts() {
  const res = await fetch(`${BASE}/products`);
  if (!res.ok) throw new Error("Impossibile recuperare i prodotti!");

  const data = await res.json();
  return data.content || [];
}

// -------------------------- GET BY ID --------------------------
export async function fetchProductById(productId) {
  const res = await fetch(`${BASE}/products/${productId}`);
  if (!res.ok) throw new Error("Impossibile recuperare il prodotto!");

  return await res.json();
}

// -------------------------- POST --------------------------
export const createProduct = async (productData, file, token) => {
  if (!token) throw new Error("Token mancante");

  const formData = new FormData();
  formData.append("data", new Blob([JSON.stringify(productData)], { type: "application/json" }));

  if (file) {
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) throw new Error("Immagine troppo grande (max 5MB)");
    if (!file.type.startsWith("image/")) throw new Error("File non valido: carica un'immagine");

    formData.append("image", file);
  }

  const res = await fetch(`${BASE}/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body: formData,
  });

  if (!res.ok) {
    let errBody;
    try {
      errBody = await res.json();
    } catch {
      errBody = { message: await res.text().catch(() => "Errore sconosciuto") };
    }
    throw new Error(errBody.message || "Errore nella creazione del prodotto");
  }
  try {
    const json = await res.json();
    return json;
  } catch {
    return null;
  }
};

// -------------------------- PUT --------------------------
export const updateProduct = async (productId, productData, file, token) => {
  if (!token) throw new Error("Token mancante");

  const formData = new FormData();
  formData.append("data", new Blob([JSON.stringify(productData)], { type: "application/json" }));

  if (file) {
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) throw new Error("Immagine troppo grande (max 5MB)");
    if (!file.type.startsWith("image/")) throw new Error("File non valido: carica un'immagine");

    formData.append("image", file);
  }

  const res = await fetch(`${BASE}/products/${productId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body: formData,
  });

  if (!res.ok) {
    let errBody;
    try {
      errBody = await res.json();
    } catch {
      errBody = { message: await res.text().catch(() => "Errore sconosciuto") };
    }
    throw new Error(errBody.message || "Errore nell'aggiornamento del prodotto");
  }

  try {
    return await res.json();
  } catch {
    return null;
  }
};

// -------------------------- DELETE --------------------------
export const deleteProduct = async (productId, token) => {
  if (!token) throw new Error("Token mancante");

  const res = await fetch(`${BASE}/products/${productId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Errore eliminazione prodotto: ${errorText}`);
  }

  return true;
};
