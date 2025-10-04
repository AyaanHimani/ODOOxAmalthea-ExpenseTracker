import { Routes, Route, Navigate } from "react-router-dom";

// Admin Pages
import Dashboard from "../../admin/dashboard.jsx";

export default function AdminRoutes() {
  return (
    <Routes>
      {/* Default /admin redirects to dashboard */}
      <Route path="/" element={<Navigate to="dashboard" replace />} />

      {/* Admin Sub-Routes */}
      <Route path="dashboard" element={<Dashboard />} />

      {/* Catch-all: redirect to dashboard */}
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
}