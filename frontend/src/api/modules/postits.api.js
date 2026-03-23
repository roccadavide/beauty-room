import http from "../httpClient";

const BASE = "/admin/post-its";

export const fetchPostIts = async () => {
  const { data } = await http.get(BASE);
  return data;
};

export const fetchExpiringCount = async () => {
  const { data } = await http.get(`${BASE}/expiring-count`);
  return data.count ?? 0;
};

export const createPostIt = async (dto) => {
  const { data } = await http.post(BASE, dto);
  return data;
};

export const updatePostIt = async (id, dto) => {
  const { data } = await http.put(`${BASE}/${id}`, dto);
  return data;
};

export const togglePostItDone = async (id) => {
  const { data } = await http.patch(`${BASE}/${id}/done`);
  return data;
};

export const deletePostIt = async (id) => {
  await http.delete(`${BASE}/${id}`);
};
