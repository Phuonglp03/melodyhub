import React, { useState, useEffect, useRef } from "react";
import {
  FaSearch,
  FaHeart,
  FaComment,
  FaPlay,
  FaPause,
  FaEdit,
  FaTrash,
  FaPlus,
  FaFilter,
} from "react-icons/fa";
import axios from "axios";
import { playLickAudio, deleteLick, updateLick as apiUpdateLick } from "../../../services/user/lickService";

// --- MyLickCard Component ---
const MyLickCard = ({ lick, onEdit, onDelete, onClick }) => {
  const {
    lick_id,
    title,
    created_at,
    likes_count,
    comments_count,
    tags,
    waveform_data,
    duration,
    difficulty,
    status,
    is_public,
    audio_url,
  } = lick;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0); // Track playback progress (0-1)
  const audioRef = useRef(null);

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "bg-green-900 text-green-300";
      case "draft":
        return "bg-yellow-900 text-yellow-300";
      case "inactive":
        return "bg-gray-800 text-gray-400";
      default:
        return "bg-gray-800 text-gray-400";
    }
  };

  // Handle play/pause
  const handlePlayPause = async (e) => {
    e.stopPropagation();

    // If already playing, pause
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    try {
      setIsLoading(true);

      // Get audio URL from API
      const response = await playLickAudio(lick_id);
      console.log("Audio URL response:", response);

      if (response.success && response.data.audio_url) {
        // Create or update audio element
        if (!audioRef.current) {
          audioRef.current = new Audio();

          // Track playback progress
          audioRef.current.addEventListener("timeupdate", () => {
            const currentProgress =
              audioRef.current.currentTime / audioRef.current.duration;
            setProgress(currentProgress);
          });

          audioRef.current.addEventListener("ended", () => {
            setIsPlaying(false);
            setProgress(0); // Reset progress
          });

          audioRef.current.addEventListener("error", (error) => {
            console.error("Audio playback error:", error);
            alert("Failed to play audio. Check console for details.");
            setIsPlaying(false);
            setIsLoading(false);
            setProgress(0);
          });

          audioRef.current.addEventListener("loadeddata", () => {
            console.log("Audio loaded successfully");
          });
        }

        // Set the source and load
        audioRef.current.src = response.data.audio_url;
        audioRef.current.load();

        // Wait for the audio to be ready and then play
        await audioRef.current.play();
        setIsPlaying(true);
        console.log("Playing audio:", response.data.audio_url);
      } else {
        console.error("No audio URL in response:", response);
        alert("Audio URL not available");
      }
    } catch (error) {
      console.error("Error playing lick:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 hover:border-gray-700 transition-all duration-200 group relative">
      {/* Action Buttons (Show on Hover) */}
      <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(lick_id);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md transition-colors"
          title="Edit"
        >
          <FaEdit size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(lick_id);
          }}
          className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-md transition-colors"
          title="Delete"
        >
          <FaTrash size={14} />
        </button>
      </div>

      <div>
        <div className="flex justify-between items-start mb-3 pr-20">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(lick_id);
                }}
                className="text-xl font-semibold text-white hover:text-orange-400 transition-colors cursor-pointer"
              >
                {title}
              </h3>
              <span
                className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
                  status
                )}`}
              >
                {status}
              </span>
              {!is_public && (
                <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-400">
                  Private
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400">
              Created {formatDate(created_at)}
            </p>
          </div>
          {difficulty && (
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                difficulty === "beginner"
                  ? "bg-green-900 text-green-300"
                  : difficulty === "intermediate"
                  ? "bg-yellow-900 text-yellow-300"
                  : "bg-red-900 text-red-300"
              }`}
            >
              {difficulty}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-4 text-sm text-gray-400 mb-4">
          <span className="flex items-center">
            <FaHeart className="text-red-500 mr-1.5" /> {likes_count}
          </span>
          <span className="flex items-center">
            <FaComment className="text-gray-500 mr-1.5" /> {comments_count}
          </span>
          {duration && (
            <span className="flex items-center">
              <FaPlay className="text-gray-500 mr-1.5" size={12} />{" "}
              {duration.toFixed(1)}s
            </span>
          )}
        </div>

        {/* Waveform Visualization - Clickable */}
        <div
          className="relative h-28 bg-gradient-to-b from-orange-800 to-orange-900 rounded-lg overflow-hidden cursor-pointer hover:from-orange-700 hover:to-orange-800 transition-all group/waveform"
          onClick={handlePlayPause}
        >
          <span className="absolute top-2.5 left-2.5 bg-black/70 text-white text-xs px-2 py-1 rounded-md font-medium backdrop-blur-sm">
            Lick
          </span>

          {/* Play/Pause Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/waveform:opacity-100 transition-opacity bg-black/20">
            {isLoading ? (
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
            ) : (
              <button className="bg-black/60 hover:bg-black/80 text-white rounded-full p-4 transition-all">
                {isPlaying ? <FaPause size={20} /> : <FaPlay size={20} />}
              </button>
            )}
          </div>

          {/* Render Waveform */}
          {waveform_data && waveform_data.length > 0 ? (
            <div className="flex items-center justify-center h-full px-4">
              <div className="flex items-center justify-center space-x-0.5 h-full w-full">
                {waveform_data.map((amplitude, index) => {
                  // Calculate if this bar should be highlighted based on progress
                  const barProgress = index / waveform_data.length;
                  const isPlayed = barProgress <= progress;

                  return (
                    <div
                      key={index}
                      className="w-1 transition-all duration-100"
                      style={{
                        backgroundColor:
                          isPlaying && isPlayed ? "#fbbf24" : "#fdba74",
                        height: `${Math.max(amplitude * 100, 2)}%`,
                        opacity:
                          isPlaying && isPlayed ? 1 : 0.7 + amplitude * 0.3,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-orange-300 opacity-30 text-sm">
                No waveform data
              </span>
            </div>
          )}
        </div>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag.tag_id}
                  className="text-xs text-gray-400 hover:text-orange-400"
                >
                  #{tag.tag_name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main My Licks Page ---
const MyLicksPage = () => {
  // Replace with actual user ID from auth context/redux
  const userId = "507f1f77bcf86cd799439011"; // TODO: Get from auth

  const [licks, setLicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  // Edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingLick, setEditingLick] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    tabNotation: "",
    key: "",
    tempo: "",
    difficulty: "",
    status: "",
    isPublic: false,
    isFeatured: false,
  });
  const [saving, setSaving] = useState(false);

  // Fetch user's licks from API
  const fetchMyLicks = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit: 20,
      };

      if (searchTerm) {
        params.search = searchTerm;
      }

      if (selectedTags) {
        params.tags = selectedTags;
      }

      if (statusFilter) {
        params.status = statusFilter;
      }

      const response = await axios.get(
        `http://localhost:9999/api/licks/user/${userId}`,
        {
          params,
        }
      );

      if (response.data.success) {
        setLicks(response.data.data);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      console.error("Error fetching my licks:", err);
      setError(err.response?.data?.message || "Failed to load your licks");
    } finally {
      setLoading(false);
    }
  };

  // Fetch licks when filters or page changes
  useEffect(() => {
    fetchMyLicks();
  }, [page, statusFilter]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchMyLicks();
      } else {
        setPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedTags]);

  // Handle lick click
  const handleLickClick = (lickId) => {
    window.location.href = `/lick/${lickId}`;
  };

  // Handle edit
  const handleEdit = (lickId) => {
    const lick = licks.find((l) => l.lick_id === lickId);
    if (!lick) return;

    setEditingLick(lick);
    setEditForm({
      title: lick.title || "",
      description: lick.description || "",
      tabNotation: lick.tab_notation || "",
      key: lick.key || "",
      tempo: lick.tempo || "",
      difficulty: lick.difficulty || "",
      status: lick.status || "",
      isPublic: !!lick.is_public,
      isFeatured: !!lick.is_featured,
    });
    setIsEditOpen(true);
  };

  // Handle delete
  const handleDelete = async (lickId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this lick? This action cannot be undone."
      )
    ) {
      try {
        await deleteLick(lickId);
        setLicks((prevLicks) => prevLicks.filter((lick) => lick.lick_id !== lickId));
      } catch (err) {
        console.error("Error deleting lick:", err);
        alert("Failed to delete lick");
      }
    }
  };

  // Handle upload
  const handleUpload = () => {
    window.location.href = "/licks/upload";
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingLick) return;
    setSaving(true);
    try {
      const payload = {
        title: editForm.title,
        description: editForm.description,
        tabNotation: editForm.tabNotation,
        key: editForm.key,
        tempo: editForm.tempo,
        difficulty: editForm.difficulty,
        status: editForm.status,
        isPublic: editForm.isPublic,
        isFeatured: editForm.isFeatured,
      };

      const res = await apiUpdateLick(editingLick.lick_id, payload);
      if (res?.success) {
        const updated = res.data || {};
        setLicks((prev) =>
          prev.map((l) =>
            l.lick_id === editingLick.lick_id
              ? {
                  ...l,
                  title: updated.title ?? editForm.title,
                  description: updated.description ?? editForm.description,
                  tab_notation: updated.tabNotation ?? editForm.tabNotation,
                  key: updated.key ?? editForm.key,
                  tempo: updated.tempo ?? editForm.tempo,
                  difficulty: updated.difficulty ?? editForm.difficulty,
                  status: updated.status ?? editForm.status,
                  is_public:
                    typeof updated.isPublic === "boolean"
                      ? updated.isPublic
                      : editForm.isPublic,
                  is_featured:
                    typeof updated.isFeatured === "boolean"
                      ? updated.isFeatured
                      : editForm.isFeatured,
                }
              : l
          )
        );
        setIsEditOpen(false);
        setEditingLick(null);
      } else {
        alert(res?.message || "Failed to update lick");
      }
    } catch (err) {
      console.error("Error updating lick:", err);
      alert(err?.message || "Failed to update lick");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Page Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My Licks</h1>
          <p className="text-gray-400">Manage your personal lick library</p>
        </div>
        <button
          onClick={handleUpload}
          className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-2 rounded-md text-sm font-semibold flex items-center hover:opacity-90 transition-opacity"
        >
          <FaPlus className="mr-2" /> Upload New Lick
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <FaSearch size={14} />
            </span>
            <input
              type="text"
              placeholder="Search your licks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white w-full rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Tags Filter */}
          <div className="relative flex-1 min-w-[150px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <FaFilter size={12} />
            </span>
            <input
              type="text"
              placeholder="Filter by tags..."
              value={selectedTags}
              onChange={(e) => setSelectedTags(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white w-full rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Results Count */}
        {pagination && (
          <div className="text-sm text-gray-400">
            {pagination.totalItems}{" "}
            {pagination.totalItems === 1 ? "lick" : "licks"}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchMyLicks}
            className="mt-2 text-sm text-orange-400 hover:text-orange-300"
          >
            Try again
          </button>
        </div>
      )}

      {/* Lick Cards List */}
      {!loading && !error && licks.length > 0 && (
        <div className="space-y-4">
          {licks.map((lick) => (
            <MyLickCard
              key={lick.lick_id}
              lick={lick}
              onClick={handleLickClick}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && licks.length === 0 && (
        <div className="text-center py-20">
          <div className="text-gray-500 mb-4">
            <FaPlus size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-xl font-semibold">No licks yet</p>
            <p className="text-sm mt-2 mb-6">
              Start building your lick library by uploading your first lick
            </p>
            <button
              onClick={handleUpload}
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-3 rounded-md font-semibold hover:opacity-90 transition-opacity inline-flex items-center"
            >
              <FaPlus className="mr-2" /> Upload Your First Lick
            </button>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination && pagination.totalPages > 1 && (
        <div className="mt-8 flex justify-center items-center space-x-4">
          <button
            onClick={() => setPage(page - 1)}
            disabled={!pagination.hasPrevPage}
            className="px-4 py-2 bg-gray-800 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
          >
            Previous
          </button>

          <span className="text-gray-400">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>

          <button
            onClick={() => setPage(page + 1)}
            disabled={!pagination.hasNextPage}
            className="px-4 py-2 bg-gray-800 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              if (!saving) {
                setIsEditOpen(false);
                setEditingLick(null);
              }
            }}
          />
          <div className="relative z-10 w-full max-w-2xl mx-4 bg-gray-900 border border-gray-800 rounded-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Edit Lick</h2>
              <button
                className="text-gray-400 hover:text-white"
                onClick={() => {
                  if (!saving) {
                    setIsEditOpen(false);
                    setEditingLick(null);
                  }
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Title</label>
                <input
                  name="title"
                  value={editForm.title}
                  onChange={handleEditChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Description</label>
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleEditChange}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Key</label>
                  <input
                    name="key"
                    value={editForm.key}
                    onChange={handleEditChange}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Tempo (BPM)</label>
                  <input
                    name="tempo"
                    value={editForm.tempo}
                    onChange={handleEditChange}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Difficulty</label>
                  <select
                    name="difficulty"
                    value={editForm.difficulty}
                    onChange={handleEditChange}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Status</label>
                  <select
                    name="status"
                    value={editForm.status}
                    onChange={handleEditChange}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select</option>
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Tab Notation (optional)</label>
                <textarea
                  name="tabNotation"
                  value={editForm.tabNotation}
                  onChange={handleEditChange}
                  rows={4}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    name="isPublic"
                    checked={editForm.isPublic}
                    onChange={handleEditChange}
                    className="form-checkbox h-4 w-4 text-orange-500 bg-gray-800 border-gray-700"
                  />
                  Public
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    name="isFeatured"
                    checked={editForm.isFeatured}
                    onChange={handleEditChange}
                    className="form-checkbox h-4 w-4 text-orange-500 bg-gray-800 border-gray-700"
                  />
                  Featured
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700"
                  onClick={() => {
                    if (!saving) {
                      setIsEditOpen(false);
                      setEditingLick(null);
                    }
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLicksPage;
