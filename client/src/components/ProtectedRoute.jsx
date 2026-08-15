import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Spinner from "./Spinner.jsx";

export default function ProtectedRoute({ roles = [], children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner full />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles.length && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
