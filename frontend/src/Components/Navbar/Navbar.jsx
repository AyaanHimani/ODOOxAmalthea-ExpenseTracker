import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Outlet } from 'react-router-dom'; // <-- import Outlet

function Navbar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    console.log('Local storage cleared.');
    navigate('/');
  };

  return (
    <nav className="bg-white shadow-md w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <span className="text-xl font-bold text-gray-800">ExpenseManager</span>
          </div>
          <div>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
      <Outlet /> {/* <-- Add this line */}
    </nav>
  );
}

export default Navbar;