// src/routes/appRoutes.js
import React, { useState } from "react"; // Import thêm useState
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import MainLayout from "../layouts/userLayout";
import "bootstrap/dist/css/bootstrap.min.css";
import NewsFeed from "../pages/user/NewFeed";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";

const AppRoutes = () => {
  // Dùng useState thay vì biến const
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("token")
  );

  // Hàm này sẽ được gọi từ component Login
  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };
  return (
    <BrowserRouter>
      <Routes>
        {/* Authentication Routes */}
        <Route
          path="/login"
          element={
            !isAuthenticated ? (
              <Login onLoginSuccess={handleLoginSuccess} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/register"
          element={
            !isAuthenticated ? <Register /> : <Navigate to="/" replace />
          }
        />

        {/* Protected Application Routes */}
        <Route
          path="/"
          // Pass handleLogout to MainLayout if it contains a logout button
          element={
            isAuthenticated ? (
              <MainLayout onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          {/* Nested routes accessible when authenticated */}
          <Route index element={<NewsFeed />} />
          <Route path="licks" element={<LickCommunity />} />
          <Route path="licks/:lickId" element={<LickDetail />} />
          <Route path="licks/upload" element={<LickUploadPage />} />
          {/* Example Admin Route - You might add further role-based checks here or within the component */}
          <Route path="admin/cloudinary" element={<CloudinaryExplorerPage />} />

          {/* Add other nested routes here */}
        </Route>

        {/* Optional: Catch-all route for 404 Not Found */}
        <Route
          path="*"
          element={
            isAuthenticated ? (
              <div>Page Not Found</div>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
