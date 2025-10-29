import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import MainLayout from "../layouts/userLayout";
import "bootstrap/dist/css/bootstrap.min.css";
import NewsFeed from "../pages/user/NewFeed";
import LickCommunity from "../pages/user/LickCommunity";
import LickDetail from "../pages/user/LickDetail";
import LickUploadPage from "../pages/user/LickUpload";
import CloudinaryExplorerPage from "../pages/admin/CloudinaryExplorer";

const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<NewsFeed />} />
        <Route path="licks" element={<LickCommunity />} />
        <Route path="licks/:lickId" element={<LickDetail />} />
        <Route path="licks/upload" element={<LickUploadPage />} />
        <Route path="admin/cloudinary" element={<CloudinaryExplorerPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default AppRoutes;
