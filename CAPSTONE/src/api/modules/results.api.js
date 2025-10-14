const BASE = import.meta.env.VITE_API_BASE_URL;

// ---------------------------------- RESULTS ----------------------------------

// -------------------------- GET --------------------------
export async function fetchResults() {
  const res = await fetch(`${BASE}/results`);
  if (!res.ok) throw new Error("Impossibile recuperare i risultati!");

  const data = await res.json();
  return data.content || [];
}

// -------------------------- GET BY ID --------------------------
export async function fetchResultById(resultId) {
  const res = await fetch(`${BASE}/results/${resultId}`);
  if (!res.ok) throw new Error("Impossibile recuperare il risultato!");

  return await res.json();
}

// -------------------------- POST --------------------------
export const createResult = async (resultData, file, token) => {
  if (!token) throw new Error("Token mancante");

  const formData = new FormData();
  formData.append("data", new Blob([JSON.stringify(resultData)], { type: "application/json" }));

  if (file) {
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) throw new Error("Immagine troppo grande (max 5MB)");
    if (!file.type.startsWith("image/")) throw new Error("File non valido: carica un'immagine");

    formData.append("image", file);
  }

  const res = await fetch(`${BASE}/results`, {
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
    throw new Error(errBody.message || "Errore nella creazione del risultato");
  }
  try {
    const json = await res.json();
    return json;
  } catch {
    return null;
  }
};

// -------------------------- PUT --------------------------
export const updateResult = async (resultId, resultData, file, token) => {
  if (!token) throw new Error("Token mancante");

  const formData = new FormData();
  formData.append("data", new Blob([JSON.stringify(resultData)], { type: "application/json" }));

  if (file) {
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) throw new Error("Immagine troppo grande (max 5MB)");
    if (!file.type.startsWith("image/")) throw new Error("File non valido: carica un'immagine");

    formData.append("image", file);
  }

  const res = await fetch(`${BASE}/results/${resultId}`, {
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
    throw new Error(errBody.message || "Errore nell'aggiornamento del risultato");
  }

  try {
    return await res.json();
  } catch {
    return null;
  }
};

// -------------------------- DELETE --------------------------
export const deleteResult = async (resultId, token) => {
  if (!token) throw new Error("Token mancante");

  const res = await fetch(`${BASE}/results/${resultId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Errore eliminazione risultato: ${errorText}`);
  }

  return true;
};
