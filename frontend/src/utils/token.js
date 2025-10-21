const TOKEN_KEY = "auth_token";

// -------------------------- SAVE --------------------------
export const saveToken = token => {
  if (!token) return;
  localStorage.setItem(TOKEN_KEY, token);
};

// -------------------------- GET --------------------------
export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

// -------------------------- CLEAR --------------------------
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

// -------------------------- CHECK --------------------------
export const hasValidToken = () => {
  const token = getToken();
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp * 1000;
    return Date.now() < exp;
  } catch (err) {
    console.warn("JWT non valido:", err);
    return false;
  }
};

// -------------------------- DECODE (opzionale) --------------------------
export const decodeToken = () => {
  const token = getToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
};
