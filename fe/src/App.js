import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { FaSearch, FaBell, FaComment, FaPlus } from "react-icons/fa";
import LickLibraryLayout from "./layouts/LickLibraryLayout";
import LickCommunityPage from "./pages/user/LickCommunity/LickCommunityPage";
import MyLicksPage from "./pages/user/MyLicks/MyLicksPage";
import LickDetailPage from "./pages/user/LickDetail/index";
import LickUploadPage from "./pages/user/LickUpload/LickUploadPage";
import { preloadBasicPitch } from "./services/basicPitchService";

// --- Header Component ---
const Header = () => {
  const navigate = useNavigate();

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex justify-between items-center fixed w-full top-0 z-10">
      {/* Left Section */}
      <div className="flex items-center">
        <h1
          className="text-2xl font-bold text-white mr-8 cursor-pointer"
          onClick={() => navigate("/")}
        >
          MelodyHub
        </h1>
        <a href="#" className="text-gray-400 hover:text-white mr-5">
          Join Live
        </a>
        <a href="/library/community" className="text-white font-semibold mr-5">
          Library
        </a>
      </div>

      {/* Center Search */}
      <div className="flex-1 max-w-lg mx-4">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <FaSearch />
          </span>
          <input
            type="text"
            placeholder="Search"
            className="bg-gray-800 text-white w-full rounded-full pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-4">
        <button className="text-gray-300 hover:text-white">
          <FaBell size={20} />
        </button>
        <button className="text-gray-300 hover:text-white">
          <FaComment size={20} />
        </button>
        <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-600">
          <span className="text-white text-sm font-semibold">U</span>
        </div>
        <button className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-red-700">
          LiveStream
        </button>
        <button
          onClick={() => navigate("/licks/upload")}
          className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-2 rounded-md text-sm font-semibold flex items-center hover:opacity-90"
        >
          <FaPlus className="mr-1.5" /> Create
        </button>
      </div>
    </nav>
  );
};

// --- App Component (Main) ---
function App() {
  // Initialize tab generation service
  useEffect(() => {
    console.log("[APP] Initializing AI tab generation (Backend API)...");
    preloadBasicPitch()
      .then((success) => {
        if (success) {
          console.log("[APP] ✅ AI tab generation ready! 🎸");
        }
      })
      .catch((error) => {
        console.error("[APP] Error initializing:", error);
      });
  }, []);

  return (
    <Router>
      <div className="flex flex-col h-screen bg-gray-950 text-white">
        <Header />

        <Routes>
          {/* Redirect root to community */}
          <Route
            path="/"
            element={<Navigate to="/library/community" replace />}
          />

          {/* Lick Upload Page (Full Screen - No Layout) */}
          <Route path="/licks/upload" element={<LickUploadPage />} />

          {/* Lick Detail Page (Full Screen - No Layout) */}
          <Route path="/licks/:lickId" element={<LickDetailPage />} />

          {/* Library Routes with Layout */}
          <Route
            path="/library/*"
            element={
              <LickLibraryLayout>
                <Routes>
                  <Route path="community" element={<LickCommunityPage />} />
                  <Route path="my-licks" element={<MyLicksPage />} />
                  <Route
                    path="*"
                    element={<Navigate to="/library/community" replace />}
                  />
                </Routes>
              </LickLibraryLayout>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
