import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Loading from "../common/Loading.jsx";

export default function PrivateRoute({ children, roles = [] }) {
  const { user, accessToken, initialized } = useSelector(state => state.auth);

  if (!initialized) {
    return <Loading message="Verifica sessione in corso..." />;
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length && !roles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
