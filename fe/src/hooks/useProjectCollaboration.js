// src/hooks/useProjectCollaboration.js
// Phase 2: Frontend Middleware - The Sync Bridge
// For ProjectDetailPage only (Studio collaboration removed)
import { useEffect, useRef, useCallback } from "react";
import { getSocket } from "../services/user/socketService";

export const useProjectCollaboration = (projectId, user) => {
  const isRemoteUpdate = useRef(false);
  const socketRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const resolvedUserId =
    user?._id ??
    user?.id ??
    user?.user?._id ??
    user?.user?.id ??
    user?.userId ??
    user?.user?.userId ??
    null;

  useEffect(() => {
    if (!projectId || !resolvedUserId) return;

    const socket = getSocket();
    if (!socket) {
      console.warn("[Collaboration] Socket not available");
      return;
    }

    socketRef.current = socket;
    hasJoinedRef.current = false;

    // Helper function to join project room (connection-aware)
    const joinProject = () => {
      if (!socket || !projectId || !resolvedUserId) return;

      if (socket.connected) {
        console.log("[Collaboration] Joining project:", projectId);
        socket.emit("project:join", { projectId, userId: resolvedUserId });
        hasJoinedRef.current = true;
      } else {
        console.log(
          "[Collaboration] Socket not connected, waiting for connection..."
        );
        // Will be handled by connect event listener
      }
    };

    // Try to join immediately if already connected
    if (socket.connected) {
      joinProject();
    }

    // Listen for remote updates
    socket.on("project:update", (payload) => {
      console.log("[Collaboration] Received remote update:", payload.type);
      // Ignore our own updates
      if (payload.senderId === resolvedUserId) return;
      if (isRemoteUpdate.current) return;

      isRemoteUpdate.current = true;

      try {
        switch (payload.type) {
          // ProjectDetailPage actions
          case "CHORD_PROGRESSION_UPDATE":
            // This will be handled by ProjectDetailPage's own handler
            window.dispatchEvent(
              new CustomEvent("project:remote:chordProgression", {
                detail: payload.data,
              })
            );
            break;

          case "LICK_ADD_TO_TIMELINE":
            window.dispatchEvent(
              new CustomEvent("project:remote:lickAdd", {
                detail: payload.data,
              })
            );
            break;

          case "TIMELINE_ITEM_UPDATE":
            window.dispatchEvent(
              new CustomEvent("project:remote:timelineUpdate", {
                detail: payload.data,
              })
            );
            break;

          case "TIMELINE_ITEM_DELETE":
            window.dispatchEvent(
              new CustomEvent("project:remote:timelineDelete", {
                detail: payload.data,
              })
            );
            break;

          case "TIMELINE_ITEMS_BULK_UPDATE":
            window.dispatchEvent(
              new CustomEvent("project:remote:timelineBulkUpdate", {
                detail: payload.data,
              })
            );
            break;

          case "TIMELINE_ITEM_POSITION_UPDATE":
            window.dispatchEvent(
              new CustomEvent("project:remote:timelinePositionUpdate", {
                detail: payload.data,
              })
            );
            break;

          case "PROJECT_SETTINGS_UPDATE":
            window.dispatchEvent(
              new CustomEvent("project:remote:settingsUpdate", {
                detail: payload.data,
              })
            );
            break;

          case "TRACK_ADD":
            window.dispatchEvent(
              new CustomEvent("project:remote:trackAdd", {
                detail: payload.data,
              })
            );
            break;

          case "TRACK_UPDATE":
            window.dispatchEvent(
              new CustomEvent("project:remote:trackUpdate", {
                detail: payload.data,
              })
            );
            break;

          case "TRACK_DELETE":
            window.dispatchEvent(
              new CustomEvent("project:remote:trackDelete", {
                detail: payload.data,
              })
            );
            break;

          default:
            console.warn("[Collaboration] Unknown update type:", payload.type);
        }
      } catch (err) {
        console.error("[Collaboration] Error applying remote update:", err);
      } finally {
        isRemoteUpdate.current = false;
      }
    });

    // Listen for presence updates
    socket.on("project:presence", (data) => {
      console.log(
        "[Collaboration] Presence update:",
        data.type || "update",
        data
      );
      // ProjectDetailPage - use custom events
      window.dispatchEvent(
        new CustomEvent("project:remote:presence", { detail: data })
      );
    });

    // Listen for cursor updates
    socket.on("project:cursor_update", (data) => {
      if (data.userId !== resolvedUserId) {
        window.dispatchEvent(
          new CustomEvent("project:remote:cursor", { detail: data })
        );
      }
    });

    // Listen for editing activity updates
    socket.on("project:editing_activity", (data) => {
      if (data.userId !== resolvedUserId) {
        window.dispatchEvent(
          new CustomEvent("project:remote:editingActivity", { detail: data })
        );
      }
    });

    // Listen for errors
    socket.on("project:error", (error) => {
      console.error("[Collaboration] Error:", error);
      window.dispatchEvent(
        new CustomEvent("project:remote:error", {
          detail: { error, projectId },
        })
      );
    });

    // Listen for connection status
    socket.on("connect", () => {
      console.log("[Collaboration] Socket connected");
      window.dispatchEvent(
        new CustomEvent("project:remote:connection", {
          detail: { connected: true },
        })
      );

      // Rejoin project if we were previously joined
      if (hasJoinedRef.current && projectId && resolvedUserId) {
        console.log(
          "[Collaboration] Reconnecting, rejoining project:",
          projectId
        );
        socket.emit("project:join", { projectId, userId: resolvedUserId });
      } else if (!hasJoinedRef.current && projectId && resolvedUserId) {
        // First time connection - join project
        joinProject();
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("[Collaboration] Socket disconnected:", reason);
      hasJoinedRef.current = false;
      window.dispatchEvent(
        new CustomEvent("project:remote:connection", {
          detail: { connected: false },
        })
      );
    });

    // Check initial connection status (socket may already be connected)
    if (socket.connected) {
      window.dispatchEvent(
        new CustomEvent("project:remote:connection", {
          detail: { connected: true },
        })
      );
    }

    return () => {
      if (hasJoinedRef.current) {
        socket.emit("project:leave", { projectId });
        hasJoinedRef.current = false;
      }
      socket.off("project:update");
      socket.off("project:presence");
      socket.off("project:cursor_update");
      socket.off("project:error");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [projectId, resolvedUserId]);

  // Broadcast change to other collaborators
  const broadcast = useCallback(
    (type, data) => {
      if (isRemoteUpdate.current || !socketRef.current) return;

      if (!socketRef.current.connected) {
        console.warn(
          "[Collaboration] Cannot broadcast - socket not connected",
          type
        );
        return;
      }

      console.log("[Collaboration] Broadcasting:", type, data);
      socketRef.current.emit("project:action", {
        type,
        data,
        projectId,
      });
    },
    [projectId]
  );

  // Broadcast cursor position
  const broadcastCursor = useCallback((sectionId, barIndex) => {
    if (!socketRef.current) return;

    if (!socketRef.current.connected) {
      console.warn(
        "[Collaboration] Cannot broadcast cursor - socket not connected"
      );
      return;
    }

    socketRef.current.emit("project:cursor", {
      sectionId,
      barIndex,
    });
  }, []);

  // Broadcast editing activity (who is editing what)
  const broadcastEditingActivity = useCallback(
    (itemId, isEditing) => {
      if (!socketRef.current || isRemoteUpdate.current) return;

      if (!socketRef.current.connected) {
        console.warn(
          "[Collaboration] Cannot broadcast editing activity - socket not connected"
        );
        return;
      }

      socketRef.current.emit("project:editing_activity", {
        itemId,
        isEditing,
        projectId,
      });
    },
    [projectId]
  );

  return { broadcast, broadcastCursor, broadcastEditingActivity };
};
