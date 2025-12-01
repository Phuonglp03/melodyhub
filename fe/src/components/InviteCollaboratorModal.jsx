// InviteCollaboratorModal - Component for managing project collaborators
import React, { useState, useEffect } from "react";
import { FaTimes, FaUserPlus, FaUserMinus, FaSearch } from "react-icons/fa";
import {
  inviteCollaborator,
  removeCollaborator,
  getProjectCollaborators,
} from "../services/user/projectService";

export default function InviteCollaboratorModal({
  isOpen,
  onClose,
  projectId,
  currentUserId,
  userRole, // "owner", "admin", "contributor", "viewer"
  onCollaboratorAdded,
  onCollaboratorRemoved,
}) {
  const [searchInput, setSearchInput] = useState("");
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load collaborators when modal opens
  useEffect(() => {
    if (isOpen && projectId) {
      loadCollaborators();
    }
  }, [isOpen, projectId]);

  const loadCollaborators = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getProjectCollaborators(projectId);
      if (response.success) {
        setCollaborators(
          response.data?.collaborators || response.collaborators || []
        );
      }
    } catch (err) {
      console.error("Error loading collaborators:", err);
      setError("Failed to load collaborators");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!searchInput.trim()) {
      setError("Please enter an email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(searchInput.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    try {
      setInviting(true);
      setError(null);
      setSuccess(null);

      const response = await inviteCollaborator(projectId, searchInput.trim());

      if (response.success) {
        setSuccess(`Successfully invited ${searchInput.trim()}`);
        setSearchInput("");
        // Reload collaborators list
        await loadCollaborators();
        // Notify parent component
        if (onCollaboratorAdded) {
          onCollaboratorAdded(response.data);
        }
      } else {
        setError(response.message || "Failed to invite collaborator");
      }
    } catch (err) {
      setError(err.message || "Failed to invite collaborator");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId) => {
    if (!window.confirm("Are you sure you want to remove this collaborator?")) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const response = await removeCollaborator(projectId, userId);

      if (response.success) {
        setSuccess("Collaborator removed successfully");
        // Reload collaborators list
        await loadCollaborators();
        // Notify parent component
        if (onCollaboratorRemoved) {
          onCollaboratorRemoved(userId);
        }
      } else {
        setError(response.message || "Failed to remove collaborator");
      }
    } catch (err) {
      setError(err.message || "Failed to remove collaborator");
    }
  };

  if (!isOpen) return null;

  // Filter out current user from collaborators list
  // Backend returns collaborators with populated userId field
  const otherCollaborators = collaborators.filter((collab) => {
    const userId = collab.userId?._id || collab.userId || collab._id;
    return userId && String(userId) !== String(currentUserId);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">
            Manage Collaborators
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Invite Section */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Invite by Email Address
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <FaSearch
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={14}
                />
                <input
                  type="email"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleInvite()}
                  placeholder="Enter email address"
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                onClick={handleInvite}
                disabled={inviting || !searchInput.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <FaUserPlus size={14} />
                {inviting ? "Inviting..." : "Invite"}
              </button>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-900/20 border border-green-700/50 rounded-lg text-green-400 text-sm">
              {success}
            </div>
          )}

          {/* Collaborators List */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">
              Current Collaborators ({otherCollaborators.length})
            </h3>
            {loading ? (
              <div className="text-center py-4 text-gray-400 text-sm">
                Loading...
              </div>
            ) : otherCollaborators.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                No other collaborators yet
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {otherCollaborators.map((collab) => {
                  // Backend returns userId as populated object or just the ID
                  const user =
                    collab.userId && typeof collab.userId === "object"
                      ? collab.userId
                      : collab.user || {};
                  const userId =
                    collab.userId?._id || collab.userId || collab._id;

                  return (
                    <div
                      key={userId || collab._id}
                      className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
                    >
                      <div className="flex items-center gap-3">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.displayName || user.username}
                            className="w-8 h-8 rounded-full border border-gray-700"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                            <span className="text-white text-xs font-semibold">
                              {(user.displayName ||
                                user.username ||
                                "U")[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="text-white text-sm font-medium">
                            {user.displayName ||
                              user.username ||
                              "Unknown User"}
                          </div>
                          {user.email && (
                            <div className="text-gray-400 text-xs">
                              {user.email}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            {collab.role && (
                              <div className="text-gray-500 text-xs capitalize">
                                {collab.role}
                              </div>
                            )}
                            {collab.status === "pending" && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                Pending
                              </span>
                            )}
                            {collab.status === "accepted" && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                                Accepted
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Remove button - only for owners and admins */}
                      {(userRole === "owner" || userRole === "admin") && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(userId);
                          }}
                          className="p-2 text-gray-500 hover:text-red-400 rounded-lg transition-colors"
                          title="Remove collaborator"
                        >
                          <FaUserMinus size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
