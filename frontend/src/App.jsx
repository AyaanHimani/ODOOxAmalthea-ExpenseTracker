// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
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

// TEMP: direct import of Employee dashboard so we can view UI without auth
// Remove this import and the /employee-test route after you're done testing
import EmployeeDashboard from "./Components/Employee/EmployeeDashboard.jsx";

function ProtectedLayout() {
  // layout used for protected sections (shows navbar + nested routes)
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 16 }}>
        <Outlet />
      </main>
    </>
  );
}

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

    // axios interceptor to attach token to all requests
    if (authToken) {
      const req = axios.interceptors.request.use((config) => {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${authToken}`;
        return config;
      });
      return () => axios.interceptors.request.eject(req);
    }
  }, []);

  if (loading) return null; // or a spinner

  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route
          path="/signup"
          element={token && role ? <Navigate to={`/${role}`} replace /> : <Signup />}
        />
        <Route
          path="/login"
          element={token && role ? <Navigate to={`/${role}`} replace /> : <Login />}
        />

        {/* Root: redirect to role dashboard if logged in */}
        <Route
          path="/"
          element={
            token && role ? <Navigate to={`/${role}`} replace /> : <Navigate to="/login" replace />
          }
        />

        {/* -------------------------
            TEMP PUBLIC TEST ROUTE
            -------------------------
            Visit: /employee-test to view EmployeeDashboard without logging in.
            Remove this route + import when done testing.
        */}
        <Route path="/employee-test" element={<EmployeeDashboard />} />

        {/* Protected area (Navbar + nested protected routes) */}
        <Route element={<ProtectedLayout />}>
          {/* Admin */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminRoutes />
              </ProtectedRoute>
            }
          />

          {/* Manager */}
          <Route
            path="/manager/*"
            element={
              <ProtectedRoute requiredRole="manager">
                <ManagerRoutes />
              </ProtectedRoute>
            }
          />

          {/* Employee */}
          <Route
            path="/employee/*"
            element={
              <ProtectedRoute requiredRole="employee">
                <EmployeeRoutes />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
