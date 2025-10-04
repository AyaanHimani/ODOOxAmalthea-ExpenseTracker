// src/routes/ManagerRoutes.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ManagerDashboard from "../manager/ManagerDashboard";
// import TeamExpenses from "../../manager/TeamExpenses";
// import PendingApprovals from "../../manager/PendingApprovals";
// import ManagerProfile from "../../manager/ManagerProfile";

const ManagerRoutes = () => {
  return (
    <Routes>
      {/* Default route -> redirect to dashboard */}
      <Route path="/" element={<Navigate to="dashboard" replace />} />

      {/* Main Manager pages */}
      <Route path="dashboard" element={<ManagerDashboard />} />
      {/* <Route path="team" element={<TeamExpenses />} />
      <Route path="approvals" element={<PendingApprovals />} />
      <Route path="profile" element={<ManagerProfile />} /> */}

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
};

export default ManagerRoutes;