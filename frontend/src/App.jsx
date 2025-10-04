import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
// import { HOST } from "./utils/constants.js";

// Public Pages
import Login from "./components/login.jsx";
import Signup from "./components/signup.jsx";
// Layout + Protected Routes
import ProtectedRoute from "./components/ProtectedRoutes/ProtectedRoute.jsx";
import Navbar from "./components/Navbar/Navbar.jsx";

// Dashboards (Role-Based)
import AdminRoutes from "./components/Routes/AdminRoutes.jsx";
import ManagerRoutes from "./components/Routes/ManagerRoutes.jsx";
import EmployeeRoutes from "./components/Routes/EmployeeRoutes.jsx";

function App() {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const authToken = localStorage.getItem("authToken");
    const userRole = localStorage.getItem("userRole");
    setToken(authToken);
    setRole(userRole);
  }, []);

  // Optional: verify role with backend (same as your ref project)
  // useEffect(() => {
  //   const userId = localStorage.getItem("userId");
  //   const verifyUserRole = async () => {
  //     try {
  //       const response = await axios.get(`${HOST}/api/auth/verify-user-role`, {
  //         params: { userId },
  //       });
  //       if (response.data.role !== role) {
  //         localStorage.setItem("userRole", response.data.role);
  //         setRole(response.data.role);
  //       }
  //     } catch (error) {
  //       console.error("Error verifying user role:", error);
  //     }
  //   };

  //   if (token && role) verifyUserRole();
  // }, [token, role]);

  return (
    <Router>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        {/* ✅ PUBLIC ROUTES */}
        {!token || !role ? (
          <>
            <Route path="/login" element={<Login />} />
          </>
        ) : (
          // ✅ If logged in, redirect root based on role
          <Route
            path="/"
            element={<Navigate to={`/${role}`} replace />}
          />
        )}

        {/* ✅ PROTECTED ROUTES (with Navbar layout) */}
        <Route element={<Navbar />}>
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute
                element={<AdminRoutes />}
                requiredRole="admin"
              />
            }
          />
          <Route
            path="/manager/*"
            element={
              <ProtectedRoute
                element={<ManagerRoutes />}
                requiredRole="manager"
              />
            }
          />
          <Route
            path="/employee/*"
            element={
              <ProtectedRoute
                element={<EmployeeRoutes />}
                requiredRole="employee"
              />
            }
          />
        </Route>

        {/* ✅ Catch-all Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
