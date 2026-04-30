import http from "../httpClient";

export const postLike = (entityType, entityId) =>
  http.post(`/api/likes/${entityType.toLowerCase()}/${entityId}`)
      .then(r => r.data.likesCount);

export const deleteLike = (entityType, entityId) =>
  http.delete(`/api/likes/${entityType.toLowerCase()}/${entityId}`)
      .then(r => r.data.likesCount);
