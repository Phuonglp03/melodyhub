import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus,
  FaTrash,
  FaEdit,
  FaMusic,
  FaCheck,
  FaTimes,
} from "react-icons/fa";
import {
  getUserProjects,
  deleteProject,
} from "../../../services/user/projectService";
import {
  acceptProjectInvitation,
  declineProjectInvitation,
} from "../../../services/user/notificationService";
import {
  getNotifications,
  markNotificationAsRead,
} from "../../../services/user/notificationService";
import { createPost as createPostApi } from "../../../services/user/post";
import { FaPlay, FaPause, FaShareAlt } from "react-icons/fa";
import { useSelector } from "react-redux";

const ProjectListPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [processingInvitation, setProcessingInvitation] = useState(null);
  const [playingProjectId, setPlayingProjectId] = useState(null);
  const [sharingProjectId, setSharingProjectId] = useState(null);
  const audioRef = useRef(null);

  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    fetchProjects();
  }, [filter]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getUserProjects(filter);
      // Handle different response structures
      if (response?.success) {
        setProjects(response.data || []);
        setPendingInvitations(response.pendingInvitations || []);
      } else if (Array.isArray(response?.data)) {
        setProjects(response.data);
        setPendingInvitations(response.pendingInvitations || []);
      } else if (Array.isArray(response)) {
        setProjects(response);
        setPendingInvitations([]);
      } else {
        setProjects([]);
        setPendingInvitations([]);
        setError(response?.message || "Failed to load projects");
      }
    } catch (err) {
      console.error("Error fetching projects:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load projects"
      );
      // Reset to empty arrays on error
      setProjects([]);
      setPendingInvitations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (projectId) => {
    try {
      setDeleting(true);
      const response = await deleteProject(projectId);
      if (response.success) {
        setDeleteConfirm(null);
        fetchProjects(); // Refresh list
      } else {
        setError(response.message || "Failed to delete project");
      }
    } catch (err) {
      console.error("Error deleting project:", err);
      setError(err.message || "Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handlePlayPreview = async (project, e) => {
    if (e) e.stopPropagation();
    if (!project?.audioUrl) return;

    try {
      // Stop any existing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Toggle off if clicking the same project
      if (playingProjectId === project._id) {
        setPlayingProjectId(null);
        return;
      }

      const audio = new Audio(project.audioUrl);
      audioRef.current = audio;
      setPlayingProjectId(project._id);

      audio.onended = () => {
        setPlayingProjectId(null);
        audioRef.current = null;
      };

      await audio.play();
    } catch (err) {
      console.error("(NO $) [DEBUG][ProjectList] Preview play failed:", err);
      setPlayingProjectId(null);
    }
  };

  const handleShareProject = async (project, e) => {
    if (e) e.stopPropagation();
    if (!project?._id || !project?.audioUrl) return;

    try {
      setSharingProjectId(project._id);

      const origin =
        typeof window !== "undefined" && window.location
          ? window.location.origin
          : "";
      const projectUrl = origin
        ? `${origin}/projects/${project._id}`
        : `/projects/${project._id}`;
      const title = project?.title || "My exported project";
      const textContent = `🎵 ${title}\n${projectUrl}`;

      await createPostApi({
        postType: "status_update",
        textContent,
      });
      // Optional: toast via alert for now
      alert("Shared project to your feed.");
    } catch (error) {
      console.error("(NO $) [DEBUG][ProjectList] Share project failed:", error);
      alert(error?.message || "Failed to share project.");
    } finally {
      setSharingProjectId(null);
    }
  };

  const handleAcceptInvitation = async (projectId, e) => {
    if (e) e.stopPropagation();
    try {
      setProcessingInvitation(projectId);
      await acceptProjectInvitation(projectId);

      // Mark related notifications as read
      try {
        const notifications = await getNotifications({ page: 1, limit: 100 });
        const relatedNotifications =
          notifications.data?.notifications?.filter(
            (n) =>
              n.type === "project_invite" &&
              n.linkUrl?.includes(`/projects/${projectId}`) &&
              !n.isRead
          ) || [];

        for (const notif of relatedNotifications) {
          await markNotificationAsRead(notif._id);
        }
      } catch (err) {
        console.error("Error marking notifications as read:", err);
      }

      // Remove from pending list and refresh
      setPendingInvitations((prev) =>
        prev.filter((inv) => inv._id !== projectId)
      );
      fetchProjects(); // Refresh to show in collaborations
    } catch (error) {
      console.error("Error accepting invitation:", error);
      alert(error?.response?.data?.message || "Failed to accept invitation");
    } finally {
      setProcessingInvitation(null);
    }
  };

  const handleDeclineInvitation = async (projectId, e) => {
    if (e) e.stopPropagation();
    try {
      setProcessingInvitation(projectId);
      await declineProjectInvitation(projectId);

      // Mark related notifications as read
      try {
        const notifications = await getNotifications({ page: 1, limit: 100 });
        const relatedNotifications =
          notifications.data?.notifications?.filter(
            (n) =>
              n.type === "project_invite" &&
              n.linkUrl?.includes(`/projects/${projectId}`) &&
              !n.isRead
          ) || [];

        for (const notif of relatedNotifications) {
          await markNotificationAsRead(notif._id);
        }
      } catch (err) {
        console.error("Error marking notifications as read:", err);
      }

      // Remove from pending list
      setPendingInvitations((prev) =>
        prev.filter((inv) => inv._id !== projectId)
      );
    } catch (error) {
      console.error("Error declining invitation:", error);
      alert(error?.response?.data?.message || "Failed to decline invitation");
    } finally {
      setProcessingInvitation(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Page Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Projects</h1>
          <p className="text-gray-400">Manage your music projects</p>
        </div>
        <button
          onClick={() => navigate("/projects/create")}
          className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-2 rounded-md text-sm font-semibold flex items-center hover:opacity-90 transition-opacity"
        >
          <FaPlus className="mr-2" /> New Project
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchProjects}
            className="mt-2 text-sm text-orange-400 hover:text-orange-300"
          >
            Try again
          </button>
        </div>
      )}

      {/* Filter Buttons */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === "all"
                ? "bg-orange-500 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
            onClick={() => setFilter("all")}
          >
            All Projects
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === "my-projects"
                ? "bg-orange-500 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
            onClick={() => setFilter("my-projects")}
          >
            My Projects
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === "collaborations"
                ? "bg-orange-500 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
            onClick={() => setFilter("collaborations")}
          >
            Collaborations
          </button>
        </div>
      </div>

      {/* Pending Invitations Section - Show in Collaborations tab */}
      {filter === "collaborations" && pendingInvitations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Pending Invitations
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-6">
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation._id}
                className="bg-yellow-900/20 border-2 border-yellow-500/50 rounded-xl overflow-hidden"
              >
                {/* Invitation Header */}
                <div className="relative h-32 bg-gradient-to-br from-yellow-500/20 to-orange-600/20 flex items-center justify-center overflow-hidden">
                  <div className="text-4xl text-yellow-600">
                    <FaMusic />
                  </div>
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-1 rounded-full bg-yellow-500/30 text-yellow-400 text-xs font-semibold border border-yellow-500/50">
                      Pending
                    </span>
                  </div>
                </div>

                {/* Invitation Info */}
                <div className="p-4">
                  <h3 className="text-base font-semibold text-white mb-1 truncate">
                    {invitation.title}
                  </h3>
                  {invitation.description && (
                    <p className="text-sm text-gray-400 mb-2 line-clamp-2">
                      {invitation.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>
                      by{" "}
                      {invitation.creatorId?.displayName ||
                        invitation.creatorId?.username ||
                        "Unknown"}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">
                      {invitation.invitationRole}
                    </span>
                  </div>

                  {/* Accept/Decline Buttons */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => handleAcceptInvitation(invitation._id, e)}
                      disabled={processingInvitation === invitation._id}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {processingInvitation === invitation._id ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        <>
                          <FaCheck size={12} />
                          Accept
                        </>
                      )}
                    </button>
                    <button
                      onClick={(e) =>
                        handleDeclineInvitation(invitation._id, e)
                      }
                      disabled={processingInvitation === invitation._id}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {processingInvitation === invitation._id ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        <>
                          <FaTimes size={12} />
                          Decline
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {projects.length === 0 &&
      (filter !== "collaborations" || pendingInvitations.length === 0) ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <FaMusic className="mx-auto mb-4 opacity-50" size={48} />
          <h5 className="text-xl font-semibold text-white mb-2">
            No projects found
          </h5>
          <p className="text-gray-400 mb-6">
            {filter === "all"
              ? "You haven't created or joined any projects yet."
              : filter === "my-projects"
              ? "You haven't created any projects yet."
              : filter === "collaborations" && pendingInvitations.length === 0
              ? "You haven't joined any projects as a collaborator yet."
              : "No accepted collaborations yet."}
          </p>
          <button
            className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-3 rounded-md font-semibold hover:opacity-90 transition-opacity inline-flex items-center"
            onClick={() => navigate("/projects/create")}
          >
            <FaPlus className="mr-2" />
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {projects.map((project) => {
            const isOwner =
              project.creatorId?._id === user?.id ||
              project.creatorId?._id === user?._id;
            const canPreview = project.status === "active" && project.audioUrl;
            return (
              <div
                key={project._id}
                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 hover:shadow-lg transition-all cursor-pointer group"
                onClick={() => navigate(`/projects/${project._id}`)}
              >
                {/* Project Header */}
                <div className="relative h-32 bg-gradient-to-br from-orange-500/20 to-red-600/20 flex items-center justify-center overflow-hidden">
                  {project.audioUrl && project.waveformData ? (
                    <div className="absolute inset-0 flex items-end gap-[1px] px-2 pb-1">
                      {project.waveformData.slice(0, 40).map((height, idx) => (
                        <div
                          key={idx}
                          className="w-[2px] flex-1 bg-orange-400 rounded-t-sm"
                          style={{ height: `${height * 100}%` }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-4xl text-gray-600">
                      <FaMusic />
                    </div>
                  )}
                  {isOwner && (
                    <div className="absolute top-2 right-2 flex items-center gap-2">
                      <button
                        className="bg-gray-800/80 hover:bg-gray-700 text-white p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${project._id}`);
                        }}
                        title="Edit"
                      >
                        <FaEdit size={10} />
                      </button>
                      <button
                        className="bg-red-500/80 hover:bg-red-600 text-white p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(project._id);
                        }}
                        title="Delete"
                      >
                        <FaTrash size={10} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Project Info */}
                <div className="p-4">
                  <h3 className="text-base font-semibold text-white mb-1 truncate">
                    {project.title}
                  </h3>
                  {project.description && (
                    <p className="text-sm text-gray-400 mb-2 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>
                      by{" "}
                      {project.creatorId?.displayName ||
                        project.creatorId?.username ||
                        "Unknown"}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full ${
                        project.status === "active"
                          ? "bg-green-500/20 text-green-400"
                          : project.status === "completed"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      Updated: {formatDate(project.updatedAt)}
                    </div>
                    {canPreview && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handlePlayPreview(project, e)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white hover:bg-orange-400 text-xs shadow-md"
                          title={
                            playingProjectId === project._id
                              ? "Pause preview"
                              : "Play export"
                          }
                        >
                          {playingProjectId === project._id ? (
                            <FaPause size={10} />
                          ) : (
                            <FaPlay size={10} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleShareProject(project, e)}
                          disabled={sharingProjectId === project._id}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium ${
                            sharingProjectId === project._id
                              ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                              : "bg-purple-600 text-white hover:bg-purple-500"
                          }`}
                          title="Share project to your feed"
                        >
                          <FaShareAlt size={10} />
                          {sharingProjectId === project._id
                            ? "Sharing..."
                            : "Share"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !deleting && setDeleteConfirm(null)}
          />
          <div className="relative z-10 w-full max-w-md mx-4 bg-gray-900 border border-gray-800 rounded-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">
                Delete Project
              </h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-gray-300 text-sm">
                Are you sure you want to delete this project? This action cannot
                be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50 transition-colors"
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectListPage;
