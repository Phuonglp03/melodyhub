import React, { useEffect } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { refreshUser } from "../redux/authSlice";
import MainLayout from "../layouts/userLayout";
import AdminLayout from "../layouts/adminLayout";
import "bootstrap/dist/css/bootstrap.min.css";
import NewsFeed from "../pages/user/NewFeed";
import PersonalFeed from "../pages/user/NewFeed/Personal";
import UserFeed from "../pages/user/NewFeed/UserFeed";
import ProfilePage from "../pages/user/Profile";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import VerifyOTP from "../pages/auth/VerifyOTP";
import ForgotPassword from "../pages/auth/ForgotPassword";
import ResetPassword from "../pages/auth/ResetPassword";
import ProtectedRoute from "../components/common/ProtectedRoute";
import AdminProtectedRoute from "../components/common/AdminProtectedRoute";
import LiveStreamCreate from "../pages/user/LiveRoomCreate";
import LiveStreamLive from "../pages/user/LiveRoomLive";
import LiveListPage from "../pages/user/LiveListPage";
import LiveViewPage from "../pages/user/LiveViewPage";
import { initSocket } from "../services/user/socketService";
import LickLibraryLayout from "../layouts/LickLibraryLayout";
import MyLicksPage from "../pages/user/MyLicks";
import LickCommunityPage from "../pages/user/LickCommunity";
import LickUploadPage from "../pages/user/LickUpload";
import LickDetailPage from "../pages/user/LickDetail";
import ChatPage from "../pages/user/Chat";
import MyPlaylistsPage from "../pages/user/MyPlaylists";
import PlaylistDetailPage from "../pages/user/PlaylistDetail";
import PlaylistCommunityPage from "../pages/user/PlaylistCommunity";

// Admin Pages
import AdminDashboard from "../pages/admin/AdminSite/AdminDashboard";
import AdminCreateAdmin from "../pages/admin/AdminSite/CreateAdmin";
import AdminUserManagement from "../pages/admin/AdminSite/UserManagement";
import AdminReportsManagement from "../pages/admin/AdminSite/ReportsManagement";
import AdminLiveroomManagement from "../pages/admin/AdminSite/LiveRoomManagement";
import AdminLickApprovement from "../pages/admin/AdminSite/LickApprovement";

const AppRoutes = () => {
  const dispatch = useDispatch();
  const { user, isLoading } = useSelector((state) => state.auth);

  useEffect(() => {
    // Try to refresh user session on app load
    dispatch(refreshUser());
  }, [dispatch]);

  // Initialize socket globally when user is available
  useEffect(() => {
    const uid = user?.id || user?._id;
    if (uid) {
      initSocket(uid);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
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
          element={!user ? <Login /> : <Navigate to="/" replace />}
        />
        <Route
          path="/register"
          element={!user ? <Register /> : <Navigate to="/" replace />}
        />
        <Route
          path="/verify-otp"
          element={!user ? <VerifyOTP /> : <Navigate to="/" replace />}
        />
        <Route
          path="/forgot-password"
          element={!user ? <ForgotPassword /> : <Navigate to="/" replace />}
        />
        <Route
          path="/reset-password"
          element={!user ? <ResetPassword /> : <Navigate to="/" replace />}
        />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="create-admin" element={<AdminCreateAdmin />} />
          <Route path="user-management" element={<AdminUserManagement />} />
          <Route path="reports-management" element={<AdminReportsManagement />} />
          <Route path="liveroom-management" element={<AdminLiveroomManagement />} />
          <Route path="lick-approvement" element={<AdminLickApprovement />} />
        </Route>

        {/* Protected routes */}
        <Route path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<NewsFeed />} />
          <Route path="live/:roomId" element={<LiveViewPage />} />
          <Route path="live" element={<LiveListPage />} />
          <Route path="livestream/setup/:roomId" element={<LiveStreamCreate />}  />
          <Route path="livestream/live/:roomId" element={<LiveStreamLive />} />
          <Route path="newfeedspersonal" element={<PersonalFeed />} />
          <Route path="users/:userId/newfeeds" element={<UserFeed />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="chat" element={<ChatPage />} />
          {/* Lick detail & upload */}
          <Route path="licks/upload" element={<LickUploadPage />} />
          <Route path="licks/:lickId" element={<LickDetailPage />} />
          {/* Lick Library */}
          <Route path="library" element={ <LickLibraryLayout /> } >
            <Route index element={<Navigate to="my-licks" replace />} />
            <Route path="my-licks" element={<MyLicksPage />} />
            <Route path="community" element={<LickCommunityPage />} />
          </Route>
          {/* Playlists */}
          <Route path="playlists" element={ <LickLibraryLayout /> }  >
            <Route index element={<MyPlaylistsPage />} />
            <Route path="community" element={<PlaylistCommunityPage />} />
            <Route path=":playlistId" element={<PlaylistDetailPage />} />
          </Route>
        </Route>

        {/* 404 - Not Found */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;