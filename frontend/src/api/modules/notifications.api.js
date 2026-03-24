import http from "../httpClient";

export const fetchUnreadNotifCount = () =>
  http.get("/admin/notifications/unread-count").then(r => r.data.count);

export const fetchNotifications = (page = 0, size = 30) =>
  http.get("/admin/notifications", { params: { page, size } }).then(r => r.data);

export const markNotifAsRead = id =>
  http.post(`/admin/notifications/${id}/read`);

export const markAllNotifsAsRead = () =>
  http.post("/admin/notifications/mark-all-read").then(r => r.data);
