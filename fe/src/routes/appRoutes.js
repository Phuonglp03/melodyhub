// src/routes/appRoutes.js
import React, { useState } from 'react'; // Import thêm useState
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/userLayout';
import 'bootstrap/dist/css/bootstrap.min.css';
import NewsFeed from '../pages/user/NewFeed';
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';

const AppRoutes = () => {
  // Dùng useState thay vì biến const
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

  // Hàm này sẽ được gọi từ component Login
  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={!isAuthenticated ? <Login onLoginSuccess={handleLoginSuccess} /> : <Navigate to="/" />} 
        />
        <Route 
          path="/register" 
          element={!isAuthenticated ? <Register /> : <Navigate to="/" />} 
        />
        <Route 
          path="/" 
          element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" />}
        >
          <Route index element={<NewsFeed />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;