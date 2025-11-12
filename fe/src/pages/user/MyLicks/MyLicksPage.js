import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch, FaPlus, FaFilter, FaLock } from "react-icons/fa";
import http from "../../../services/http";
import {
  deleteLick,
  updateLick as apiUpdateLick,
} from "../../../services/user/lickService";
import {
  upsertTags,
  replaceContentTags,
} from "../../../services/user/tagService";
import MyLickCard from "../../../components/MyLickCard";

// --- Main My Licks Page ---
const MyLicksPage = () => {
  // userId is resolved server-side via JWT on /user/me

  const navigate = useNavigate();
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
    key: "",
    tempo: "",
    difficulty: "",
    status: "",
    isPublic: false,
    isFeatured: false,
    tagsInput: "",
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState("");

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

      const res = await http.get(`/licks/user/me`, { params });

      if (res.data.success) {
        setLicks(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error("Error fetching my licks:", err);
      const status = err?.response?.status;
      const rawMsg = err?.response?.data?.message || err?.message || "";
      const msg = String(rawMsg);
      const normalized = msg.toLowerCase();
      const isAuthError =
        status === 401 ||
        status === 403 ||
        normalized.includes("token") ||
        normalized.includes("expired") ||
        normalized.includes("unauthorized") ||
        normalized.includes("forbidden") ||
        normalized.includes("hết hạn");
      if (isAuthError) {
        setError("You must login to see your licks");
      } else {
        setError(msg || "Failed to load your licks");
      }
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
    navigate(`/licks/${lickId}`);
  };

  // Handle edit
  const handleEdit = (lickId) => {
    const lick = licks.find((l) => l.lick_id === lickId);
    if (!lick) return;

    setEditingLick(lick);
    setEditForm({
      title: lick.title || "",
      description: lick.description || "",
      key: lick.key || "",
      tempo: lick.tempo || "",
      difficulty: lick.difficulty || "",
      status: lick.status || "",
      isPublic: !!lick.is_public,
      isFeatured: !!lick.is_featured,
      tagsInput: (lick.tags || [])
        .map((tag) => tag.tag_name || tag.tagName || tag.name || "")
        .filter(Boolean)
        .join(", "),
    });
    setIsEditOpen(true);
  };

  // Handle delete
  const handleDelete = (lickId) => {
    setConfirmTargetId(lickId);
    setConfirmError("");
    setConfirmOpen(true);
  };

  const performDelete = async () => {
    if (!confirmTargetId) return;
    try {
      setConfirmLoading(true);
      setConfirmError("");
      await deleteLick(confirmTargetId);
      setLicks((prevLicks) =>
        prevLicks.filter((lick) => lick.lick_id !== confirmTargetId)
      );
      setConfirmOpen(false);
      setConfirmTargetId(null);
    } catch (err) {
      console.error("Error deleting lick:", err);
      setConfirmError(err?.message || "Failed to delete lick");
    } finally {
      setConfirmLoading(false);
    }
  };

  // Handle upload
  const handleUpload = () => {
    navigate("/licks/upload");
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
        key: editForm.key,
        tempo: editForm.tempo,
        difficulty: editForm.difficulty,
        status: editForm.status,
        isPublic: editForm.isPublic,
        isFeatured: editForm.isFeatured,
      };

      const res = await apiUpdateLick(editingLick.lick_id, payload);
      let updatedTags = editingLick.tags || [];
      const parsedTags = Array.from(
        new Set(
          (editForm.tagsInput || "")
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0)
            .map((tag) => tag.toLowerCase())
        )
      );

      if (parsedTags.length > 0) {
        const existingTypeMap = {};
        (editingLick.tags || []).forEach((tag) => {
          const key = (
            tag.tag_name ||
            tag.tagName ||
            tag.name ||
            ""
          ).toLowerCase();
          if (key) {
            existingTypeMap[key] =
              tag.tag_type || tag.tagType || tag.type || "user_defined";
          }
        });

        const upsertPayload = parsedTags.map((name) => ({
          name,
          type: existingTypeMap[name] || "user_defined",
        }));

        try {
          const upsertRes = await upsertTags(upsertPayload);
          const tagDocs = upsertRes?.data || [];
          const tagIds = tagDocs.map((doc) => doc._id);
          await replaceContentTags("lick", editingLick.lick_id, tagIds);
          updatedTags = tagDocs.map((doc) => ({
            tag_id: doc._id,
            tag_name: doc.name || doc.tag_name || "",
            tag_type: doc.type || doc.tag_type || "user_defined",
          }));
        } catch (tagError) {
          console.error("Error updating tags:", tagError);
          alert(tagError?.message || "Failed to update tags");
        }
      } else {
        try {
          await replaceContentTags("lick", editingLick.lick_id, []);
          updatedTags = [];
        } catch (tagError) {
          console.error("Error clearing tags:", tagError);
          alert(tagError?.message || "Failed to clear tags");
        }
      }

      if (res?.success) {
        const updated = res.data || {};
        setEditingLick((prev) =>
          prev ? { ...prev, tags: updatedTags } : prev
        );
        setLicks((prev) =>
          prev.map((l) =>
            l.lick_id === editingLick.lick_id
              ? {
                  ...l,
                  title: updated.title ?? editForm.title,
                  description: updated.description ?? editForm.description,
                  tab_notation: updated.tabNotation ?? l.tab_notation,
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
                  tags: updatedTags,
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
      {error &&
        (() => {
          const normalizedError = error.toLowerCase();
          if (normalizedError.includes("login")) {
            return (
              <div className="max-w-xl mx-auto bg-gray-900/70 border border-gray-800 rounded-2xl p-10 text-center shadow-lg mb-6">
                <div className="mx-auto w-14 h-14 flex items-center justify-center rounded-full bg-orange-500/10 text-orange-400 mb-4">
                  <FaLock size={24} />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Sign in to see your licks
                </h2>
                <p className="text-gray-400 mb-6">
                  Your personal licks are protected. Please log in to continue
                  managing them.
                </p>
                <button
                  onClick={() => (window.location.href = "/login")}
                  className="px-6 py-2 rounded-md bg-gradient-to-r from-orange-500 to-red-600 text-white font-medium hover:opacity-90 transition"
                >
                  Go to login
                </button>
              </div>
            );
          }
          return (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
              <p className="text-red-400">{error}</p>
              <button
                onClick={fetchMyLicks}
                className="mt-2 text-sm text-orange-400 hover:text-orange-300"
              >
                Try again
              </button>
            </div>
          );
        })()}

      {/* Lick Cards Grid */}
      {!loading && !error && licks.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
                <label className="block text-sm text-gray-300 mb-1">
                  Title
                </label>
                <input
                  name="title"
                  value={editForm.title}
                  onChange={handleEditChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleEditChange}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Tags</label>
                <input
                  name="tagsInput"
                  value={editForm.tagsInput}
                  onChange={handleEditChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g. jazz, swing, upbeat"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Separate tags with commas. They will be saved as user-defined
                  tags if no type exists.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Key
                  </label>
                  <input
                    name="key"
                    value={editForm.key}
                    onChange={handleEditChange}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Tempo (BPM)
                  </label>
                  <input
                    name="tempo"
                    value={editForm.tempo}
                    onChange={handleEditChange}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Difficulty
                  </label>
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
                  <label className="block text-sm text-gray-300 mb-1">
                    Status
                  </label>
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

      {/* Delete Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              if (!confirmLoading) {
                setConfirmOpen(false);
                setConfirmTargetId(null);
              }
            }}
          />
          <div className="relative z-10 w-full max-w-md mx-4 bg-gray-900 border border-gray-800 rounded-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Delete Lick</h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-gray-300 text-sm">
                Are you sure you want to delete this lick? This action cannot be
                undone.
              </p>
              {confirmError && (
                <div className="text-red-400 text-sm">{confirmError}</div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700"
                onClick={() => {
                  if (!confirmLoading) {
                    setConfirmOpen(false);
                    setConfirmTargetId(null);
                  }
                }}
                disabled={confirmLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
                onClick={performDelete}
                disabled={confirmLoading}
              >
                {confirmLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLicksPage;
