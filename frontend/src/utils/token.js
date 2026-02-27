let accessToken = null;

// -------------------------- IN-MEMORY ACCESS TOKEN --------------------------

export const setAccessToken = token => {
  accessToken = token || null;
};

export const getAccessToken = () => accessToken;

export const clearAccessToken = () => {
  accessToken = null;
};

// -------------------------- CHECK --------------------------

export const hasValidToken = () => {
  const token = accessToken;
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

// -------------------------- DECODE (optional) --------------------------

export const decodeToken = () => {
  const token = accessToken;
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
};
