import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

// Public Pages
import Login from "./Components/login.jsx";
import Signup from "./Components/signup.jsx";

// Layout + Protected Routes
import ProtectedRoute from "./Components/ProtectedRoutes/ProtectedRoute.jsx";
import Navbar from "./Components/Navbar/Navbar.jsx";

// Dashboards (Role-Based)
import AdminRoutes from "./Components/Routes/AdminRoutes.jsx";
import ManagerRoutes from "./Components/Routes/ManagerRoutes.jsx";
import EmployeeRoutes from "./Components/Routes/EmployeeRoutes.jsx";

function App() {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true); // wait for localStorage check

  useEffect(() => {
    const authToken = localStorage.getItem("authToken");
    const userRole = localStorage.getItem("userRole");
    setToken(authToken);
    setRole(userRole);
    setLoading(false);
  }, []);

  if (loading) return null; // or spinner

  return (
    <Router>
      <Routes>
        {/* ✅ Public Routes */}
        <Route
          path="/signup"
          element={
            // If logged in, redirect to role-based dashboard
            token && role ? <Navigate to={`/${role}`} replace /> : <Signup />
          }
        />
        <Route
          path="/login"
          element={
            token && role ? <Navigate to={`/${role}`} replace /> : <Login />
          }
        />

        {/* ✅ Role-based root redirect */}
        <Route
          path="/"
          element={
            token && role ? <Navigate to={`/${role}`} replace /> : <Navigate to="/login" replace />
          }
        />

        {/* ✅ Protected Routes with Navbar */}
        <Route element={<Navbar />}>
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute element={<AdminRoutes />} requiredRole="admin" />
            }
          />
          <Route
            path="/manager/*"
            element={
              <ProtectedRoute element={<ManagerRoutes />} requiredRole="manager" />
            }
          />
          <Route
            path="/employee/*"
            element={
              <ProtectedRoute element={<EmployeeRoutes />} requiredRole="employee" />
            }
          />
        </Route>

        {/* ✅ Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;