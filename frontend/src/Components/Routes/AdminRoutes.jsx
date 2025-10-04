// frontend\src\Components\Routes\AdminRoutes.jsx
import { Routes, Route, Navigate } from "react-router-dom";

// Admin Pages
import Dashboard from "../../admin/dashboard.jsx";
import Approvals from "../../Admin/ApprovalRuleEditor.jsx";

export default function AdminRoutes() {
  return (
    <Routes>
      {/* Default /admin redirects to dashboard */}
      <Route path="/" element={<Navigate to="dashboard" replace />} />

      {/* Admin Sub-Routes */}
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="approval-rule-editor" element={<Approvals />} />
      {/* Catch-all: redirect to dashboard */}
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
}