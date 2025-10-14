const BASE = import.meta.env.VITE_API_BASE_URL;

// ---------------------------------- SERVICES ----------------------------------

// -------------------------- GET --------------------------
export async function fetchServices() {
  const res = await fetch(`${BASE}/service-items`);
  if (!res.ok) throw new Error("Impossibile recuperare i servizi!");

  const data = await res.json();
  return data.content || [];
}

// -------------------------- GET BY ID --------------------------
export async function fetchServiceById(serviceId) {
  const res = await fetch(`${BASE}/service-items/${serviceId}`);
  if (!res.ok) throw new Error("Impossibile recuperare il servizio!");

  return await res.json();
}

// -------------------------- POST --------------------------
export const createService = async (serviceData, file, token) => {
  if (!token) throw new Error("Token mancante");

  const formData = new FormData();
  formData.append("data", new Blob([JSON.stringify(serviceData)], { type: "application/json" }));

  if (file) {
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) throw new Error("Immagine troppo grande (max 5MB)");
    if (!file.type.startsWith("image/")) throw new Error("File non valido: carica un'immagine");

    formData.append("image", file);
  }

  const res = await fetch(`${BASE}/service-items`, {
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
    throw new Error(errBody.message || "Errore nella creazione del servizio");
  }
  try {
    const json = await res.json();
    return json;
  } catch {
    return null;
  }
};

// -------------------------- PUT --------------------------
export const updateService = async (serviceId, serviceData, file, token) => {
  if (!token) throw new Error("Token mancante");

  const formData = new FormData();
  formData.append("data", new Blob([JSON.stringify(serviceData)], { type: "application/json" }));

  if (file) {
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) throw new Error("Immagine troppo grande (max 5MB)");
    if (!file.type.startsWith("image/")) throw new Error("File non valido: carica un'immagine");

    formData.append("image", file);
  }

  const res = await fetch(`${BASE}/service-items/${serviceId}`, {
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
    throw new Error(errBody.message || "Errore nell'aggiornamento del servizio");
  }

  try {
    return await res.json();
  } catch {
    return null;
  }
};

// -------------------------- DELETE --------------------------
export const deleteService = async (serviceId, token) => {
  if (!token) throw new Error("Token mancante");

  const res = await fetch(`${BASE}/service-items/${serviceId}`, {
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
