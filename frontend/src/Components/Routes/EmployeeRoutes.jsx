// src/Components/Routes/EmployeeRoutes.jsx
import React from "react";
import { Route, Routes } from "react-router-dom";
import EmployeeDashboard from "../../Components/Employee/EmployeeDashboard.jsx";

export default function EmployeeRoutes() {
  return (
    <Routes>
      <Route path="/" element={<EmployeeDashboard />} />
      {/* other employee routes */}
    </Routes>
  );
}
