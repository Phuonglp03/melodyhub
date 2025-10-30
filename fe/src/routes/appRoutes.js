import React, { useEffect } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { refreshUser } from '../redux/features/auth/authSlice';
import MainLayout from '../layouts/userLayout';
import 'bootstrap/dist/css/bootstrap.min.css';
import NewsFeed from '../pages/user/NewFeed';
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import VerifyOTP from '../pages/auth/VerifyOTP';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';
import ProtectedRoute from '../components/common/ProtectedRoute';

import LiveStreamCreate from '../pages/user/LiveRoomCreate';
import LiveStreamLive from '../pages/user/LiveRoomLive';
const AppRoutes = () => {
  const dispatch = useDispatch();
  const { user, isLoading } = useSelector((state) => state.auth);

  useEffect(() => {
    // Try to refresh user session on app load
    dispatch(refreshUser());
  }, [dispatch]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={
            !user ? (
              <Login />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/register" 
          element={
            !user ? (
              <Register />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/verify-otp" 
          element={
            !user ? (
              <VerifyOTP />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/forgot-password" 
          element={
            !user ? (
              <ForgotPassword />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/reset-password" 
          element={
            !user ? (
              <ResetPassword />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        
        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<NewsFeed />} />
          <Route path="livestream/setup/:roomId" element={<LiveStreamCreate />} />
          <Route path="livestream/live/:roomId" element={<LiveStreamLive />} />
        </Route>

        {/* 404 - Not Found */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;