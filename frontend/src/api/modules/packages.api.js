import http from "../httpClient";

export const fetchPackages = async () => {
  try {
    const { data } = await http.get("/service-items/options/packages");
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Impossibile recuperare i pacchetti.";
    throw new Error(message);
  }
};

export const createPackage = (serviceId, dto, token) =>
  http.post(`/service-items/${serviceId}/options`, dto, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.data);

export const updatePackage = (optionId, dto, token) =>
  http.put(`/service-items/options/${optionId}`, dto, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.data);

export const deletePackage = (optionId, token) =>
  http.delete(`/service-items/options/${optionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
