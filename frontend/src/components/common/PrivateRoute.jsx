import { Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Loading from "../common/Loading.jsx";
import { hasValidToken } from "../../utils/token";
import { logout } from "../../features/auth/slices/auth.slice";

export default function PrivateRoute({ children, roles = [] }) {
  const dispatch = useDispatch();
  const { user, accessToken, initialized } = useSelector(state => state.auth);

  if (!initialized) {
    return <Loading message="Verifica sessione in corso..." />;
  }

  // Token assente o scaduto: pulisci lo stato auth e rimanda al login
  if (!accessToken || !hasValidToken()) {
    if (accessToken) {
      dispatch(logout());
    }
    return <Navigate to="/login" replace />;
  }

  if (roles.length && !roles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
