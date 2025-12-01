// src/hooks/useProjectCollaboration.js
// Phase 2: Frontend Middleware - The Sync Bridge
// For ProjectDetailPage only (Studio collaboration removed)
import { useEffect, useRef, useCallback } from "react";
import { getSocket } from "../services/user/socketService";

export const useProjectCollaboration = (projectId, user) => {
  const isRemoteUpdate = useRef(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!projectId || !user?._id) return;

    const socket = getSocket();
    if (!socket) {
      console.warn("[Collaboration] Socket not available");
      return;
    }

    socketRef.current = socket;

    // Join project room
    socket.emit("project:join", { projectId, userId: user._id });

    // Listen for remote updates
    socket.on("project:update", (payload) => {
      // Ignore our own updates
      if (payload.senderId === user._id) return;
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
      // ProjectDetailPage - use custom events
      window.dispatchEvent(
        new CustomEvent("project:remote:presence", { detail: data })
      );
    });

    // Listen for cursor updates
    socket.on("project:cursor_update", (data) => {
      if (data.userId !== user._id) {
        window.dispatchEvent(
          new CustomEvent("project:remote:cursor", { detail: data })
        );
      }
    });

    // Listen for editing activity updates
    socket.on("project:editing_activity", (data) => {
      if (data.userId !== user._id) {
        window.dispatchEvent(
          new CustomEvent("project:remote:editingActivity", { detail: data })
        );
      }
    });

    // Listen for errors
    socket.on("project:error", (error) => {
      console.error("[Collaboration] Error:", error);
    });

    // Listen for connection status
    socket.on("connect", () => {
      window.dispatchEvent(
        new CustomEvent("project:remote:connection", {
          detail: { connected: true },
        })
      );
    });

    socket.on("disconnect", () => {
      window.dispatchEvent(
        new CustomEvent("project:remote:connection", {
          detail: { connected: false },
        })
      );
    });

    return () => {
      socket.emit("project:leave", { projectId });
      socket.off("project:update");
      socket.off("project:presence");
      socket.off("project:cursor_update");
      socket.off("project:error");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [projectId, user?._id]);

  // Broadcast change to other collaborators
  const broadcast = useCallback(
    (type, data) => {
      if (isRemoteUpdate.current || !socketRef.current) return;

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

    socketRef.current.emit("project:cursor", {
      sectionId,
      barIndex,
    });
  }, []);

  // Broadcast editing activity (who is editing what)
  const broadcastEditingActivity = useCallback(
    (itemId, isEditing) => {
      if (!socketRef.current || isRemoteUpdate.current) return;

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
