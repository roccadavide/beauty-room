import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { hasValidToken, getToken, saveToken } from "../../utils/token";
import { loginSuccess } from "../../features/auth/slices/auth.slice";
import { fetchCurrentUser } from "../../api/modules/users.api";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export default function PrivateRoute({ children, roles = [] }) {
  const { user, token } = useSelector(state => state.auth);
  const dispatch = useDispatch();
  const [checking, setChecking] = useState(!hasValidToken() && !!getToken());

  useEffect(() => {
    if (!hasValidToken() && getToken()) {
      axios.post(`${API_BASE}/auth/refresh`, null, { withCredentials: true, timeout: 10000 })
        .then(async res => {
          const newToken = res.data?.accessToken;
          if (newToken) {
            saveToken(newToken);
            const freshUser = await fetchCurrentUser();
            dispatch(loginSuccess({ user: freshUser, token: newToken }));
          }
        })
        .catch(() => {
          window.dispatchEvent(new Event("auth:unauthorized"));
        })
        .finally(() => setChecking(false));
    } else if (!getToken()) {
      setChecking(false);
    }
  }, [dispatch]);

  if (checking) return null;

  const valid = token && hasValidToken();

  if (!valid) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length && !roles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
