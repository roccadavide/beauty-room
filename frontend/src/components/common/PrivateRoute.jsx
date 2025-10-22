import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

export default function PrivateRoute({ children, roles = [] }) {
  const { user, token } = useSelector(state => state.auth);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length && !roles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
