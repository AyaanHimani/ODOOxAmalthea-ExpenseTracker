// src/Components/Routes/EmployeeRoutes.jsx
import React from "react";
import { Route, Routes } from "react-router-dom";
import EmployeeDashboard from "../Employee/EmployeeDashboard"; // adjust path as needed

export default function EmployeeRoutes() {
  return (
    <Routes>
      <Route path="/" element={<EmployeeDashboard />} />
      {/* other employee routes */}
    </Routes>
  );
}
