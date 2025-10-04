import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ element, requiredRole }) {
  const token = localStorage.getItem("authToken");
  const role = localStorage.getItem("userRole");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to={`/${role}`} replace />;
  }

  return element;
}
