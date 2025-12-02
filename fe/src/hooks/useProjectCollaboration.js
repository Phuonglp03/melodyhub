// src/hooks/useProjectCollaboration.js
// Phase 2: Frontend Middleware - The Sync Bridge
// For ProjectDetailPage only (Studio collaboration removed)
import { useEffect, useRef, useCallback } from "react";
import { getSocket } from "../services/user/socketService";
import { fetchCollabState } from "../services/user/collabService";
import { collabChannel } from "../utils/collabChannel";
import { nanoid } from "nanoid";

const HEARTBEAT_INTERVAL =
  Number(process.env.REACT_APP_COLLAB_HEARTBEAT_MS) || 15000;
const RESYNC_RETRY_MS = Number(process.env.REACT_APP_COLLAB_RESYNC_MS) || 5000;
const STALE_RESYNC_MS = Number(process.env.REACT_APP_COLLAB_STALE_MS) || 45000;
const ACTIVITY_CHECK_INTERVAL =
  Number(process.env.REACT_APP_COLLAB_ACTIVITY_MS) || 15000;
const COLLAB_DEBUG =
  (process.env.REACT_APP_COLLAB_DEBUG || "").toLowerCase() === "true";
// Optimized throttle constants for responsiveness
// Continuous events (dragging/resizing) use trailing edge throttling
// Discrete events (clicks/mutes/drops) bypass throttling entirely
const BROADCAST_THROTTLE = {
  TIMELINE_ITEM_POSITION_UPDATE: 30, // Faster drag (30ms = ~30fps)
  TIMELINE_ITEM_UPDATE: 50, // Faster resize
  CHORD_PROGRESSION_UPDATE: 100, // Keep chord typing debounced
  // All other events (LICK_ADD_TO_TIMELINE, TRACK_UPDATE, etc.) are NOT throttled
};

const REMOTE_EVENT_MAP = {
  CHORD_PROGRESSION_UPDATE: "project:remote:chordProgression",
  LICK_ADD_TO_TIMELINE: "project:remote:lickAdd",
  TIMELINE_ITEM_UPDATE: "project:remote:timelineUpdate",
  TIMELINE_ITEM_DELETE: "project:remote:timelineDelete",
  TIMELINE_ITEMS_BULK_UPDATE: "project:remote:timelineBulkUpdate",
  TIMELINE_ITEM_POSITION_UPDATE: "project:remote:timelinePositionUpdate",
  PROJECT_SETTINGS_UPDATE: "project:remote:settingsUpdate",
  TRACK_ADD: "project:remote:trackAdd",
  TRACK_UPDATE: "project:remote:trackUpdate",
  TRACK_DELETE: "project:remote:trackDelete",
};

export const useProjectCollaboration = (projectId, user) => {
  const isRemoteUpdate = useRef(false);
  const socketRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const versionRef = useRef(0);
  const heartbeatTimerRef = useRef(null);
  const resyncTimeoutRef = useRef(null);
  const resyncInFlightRef = useRef(false);
  const throttleTimersRef = useRef({});
  const throttlePayloadRef = useRef({});
  const lastActivityRef = useRef(Date.now());
  const activityIntervalRef = useRef(null);
  const debugEventsRef = useRef([]);
  const resolvedUserId =
    user?._id ??
    user?.id ??
    user?.user?._id ??
    user?.user?.id ??
    user?.userId ??
    user?.user?.userId ??
    null;

  const emitChannelEvent = useCallback((event, detail) => {
    collabChannel.emit(event, detail);
  }, []);

  const recordDebugEvent = useCallback((label, data = {}) => {
    if (!COLLAB_DEBUG) return;
    const entry = {
      ts: new Date().toISOString(),
      label,
      ...data,
    };
    debugEventsRef.current = [...debugEventsRef.current.slice(-99), entry];
    if (typeof window !== "undefined") {
      window.__COLLAB_DEBUG_LOGS__ = debugEventsRef.current;
    }
    // eslint-disable-next-line no-console
    console.log("[CollabDebug]", label, data);
  }, []);

  const cleanupHeartbeat = () => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  };

  const cleanupActivityWatcher = () => {
    if (activityIntervalRef.current) {
      clearInterval(activityIntervalRef.current);
      activityIntervalRef.current = null;
    }
  };

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const startHeartbeat = () => {
    cleanupHeartbeat();
    heartbeatTimerRef.current = setInterval(() => {
      if (socketRef.current?.connected && projectId && resolvedUserId) {
        socketRef.current.emit("project:heartbeat", { projectId });
      }
    }, HEARTBEAT_INTERVAL);
  };

  // OPTIMIZED: Resync only when absolutely necessary
  const performResync = useCallback(async () => {
    if (!projectId) return;
    if (resyncInFlightRef.current) return;
    if (resyncTimeoutRef.current) {
      clearTimeout(resyncTimeoutRef.current);
      resyncTimeoutRef.current = null;
    }
    resyncInFlightRef.current = true;
    const resyncStartedAt = performance.now();

    if (COLLAB_DEBUG) {
      recordDebugEvent("resync:start", {
        projectId,
        fromVersion: versionRef.current,
        viaSocket: !!socketRef.current?.connected,
      });
    }

    const fromVersion = versionRef.current;
    let result = null;

    const socket = socketRef.current;

    if (socket?.connected) {
      result = await new Promise((resolve) => {
        try {
          socket
            .timeout(4000)
            .emit("project:resync", { projectId, fromVersion }, (response) => {
              resolve(response);
            });
        } catch (err) {
          if (COLLAB_DEBUG) {
            console.error("[Collaboration] resync request failed:", err);
            recordDebugEvent("resync:error", {
              projectId,
              source: "socket",
              error: err?.message,
            });
          }
          resolve(null);
        }
      });
    }

    if (!result?.success) {
      try {
        const apiData = await fetchCollabState(projectId, fromVersion);
        if (apiData) {
          result = {
            success: true,
            version: apiData.version,
            snapshot: apiData.snapshot,
            ops: apiData.ops,
            source: "rest",
          };
        }
      } catch (err) {
        if (COLLAB_DEBUG) {
          console.error("[Collaboration] REST resync failed:", err);
          recordDebugEvent("resync:error", {
            projectId,
            source: "rest",
            error: err?.message,
          });
        }
      }
    }

    if (result?.success) {
      if (result.snapshot) {
        emitChannelEvent("project:remote:snapshot", result.snapshot);
      }
      if (result.version && result.version > versionRef.current) {
        versionRef.current = result.version;
      }
      if (Array.isArray(result.ops)) {
        result.ops.forEach((op) => {
          if (!op || op.version <= versionRef.current) return;
          versionRef.current = op.version;
          if (op.senderId === resolvedUserId) return;
          emitChannelEvent(REMOTE_EVENT_MAP[op.type] ?? op.type, op.payload);
        });
      }
      markActivity();

      if (COLLAB_DEBUG) {
        recordDebugEvent("resync:success", {
          projectId,
          source: result.source || (socket?.connected ? "socket" : "rest"),
          version: result.version,
          opsApplied: result.ops?.length || 0,
          durationMs: Math.round(performance.now() - resyncStartedAt),
        });
      }
    } else {
      if (COLLAB_DEBUG) {
        recordDebugEvent("resync:failed", {
          projectId,
          durationMs: Math.round(performance.now() - resyncStartedAt),
        });
      }
    }

    resyncInFlightRef.current = false;
  }, [
    emitChannelEvent,
    projectId,
    resolvedUserId,
    markActivity,
    recordDebugEvent,
  ]);

  const scheduleResync = useCallback(() => {
    if (resyncInFlightRef.current) return;
    if (resyncTimeoutRef.current) return;
    resyncTimeoutRef.current = setTimeout(() => {
      resyncTimeoutRef.current = null;
      performResync();
    }, RESYNC_RETRY_MS);
    if (COLLAB_DEBUG) {
      recordDebugEvent("resync:scheduled", {
        projectId,
        delayMs: RESYNC_RETRY_MS,
      });
    }
  }, [performResync, projectId, recordDebugEvent]);

  const applyRemotePayload = useCallback(
    (payload) => {
      if (!payload?.type) return;
      const eventName = REMOTE_EVENT_MAP[payload.type];
      if (!eventName) {
        console.warn("[Collaboration] Unknown update type:", payload.type);
        return;
      }
      isRemoteUpdate.current = true;
      try {
        emitChannelEvent(eventName, payload.data);
      } catch (err) {
        console.error("[Collaboration] Error applying remote update:", err);
      } finally {
        isRemoteUpdate.current = false;
      }
    },
    [emitChannelEvent]
  );

  useEffect(() => {
    if (!projectId || !resolvedUserId) return;

    const socket = getSocket();
    if (!socket) {
      if (COLLAB_DEBUG) {
        console.warn("[Collaboration] Socket not available");
      }
      return;
    }

    socketRef.current = socket;
    hasJoinedRef.current = false;

    const joinProject = () => {
      if (!socket || !projectId || !resolvedUserId) return;

      if (socket.connected) {
        if (COLLAB_DEBUG) {
          console.log("[Collaboration] Joining project:", projectId);
        }
        socket.emit("project:join", { projectId, userId: resolvedUserId });
        hasJoinedRef.current = true;
        startHeartbeat();
      }
    };

    if (socket.connected) {
      joinProject();
    }

    socket.on("project:update", (payload) => {
      markActivity();
      if (COLLAB_DEBUG) {
        recordDebugEvent("recv:project:update", {
          type: payload?.type,
          version: payload?.version,
          collabOpId: payload?.collabOpId,
        });
      }
      if (!payload?.version) return;
      const currentVersion = versionRef.current;
      if (payload.version <= currentVersion) return;

      // Only resync if version gap is significant (>1)
      // Small gaps can be handled by normal update flow
      if (payload.version > currentVersion + 1) {
        if (COLLAB_DEBUG) {
          console.warn(
            "[Collaboration] Version gap detected, requesting resync",
            currentVersion,
            payload.version
          );
          recordDebugEvent("recv:project:update:gap", {
            currentVersion,
            incomingVersion: payload.version,
          });
        }
        performResync();
        return;
      }

      versionRef.current = payload.version;
      if (payload.senderId === resolvedUserId) return;
      applyRemotePayload(payload);
    });

    socket.on("project:ack", ({ version, collabOpId }) => {
      markActivity();
      if (COLLAB_DEBUG) {
        recordDebugEvent("recv:project:ack", {
          version,
          collabOpId,
        });
      }
      if (typeof version === "number") {
        versionRef.current = Math.max(versionRef.current, version);
      }
    });

    socket.on("project:presence", (data) => {
      markActivity();
      if (COLLAB_DEBUG) {
        recordDebugEvent("recv:project:presence", {
          type: data?.type,
          count: data?.collaborators?.length,
        });
      }
      emitChannelEvent("project:remote:presence", data);
    });

    socket.on("project:cursor_update", (data) => {
      if (data.userId !== resolvedUserId) {
        emitChannelEvent("project:remote:cursor", data);
      }
      markActivity();
      if (COLLAB_DEBUG) {
        recordDebugEvent("recv:project:cursor", {
          userId: data?.userId,
        });
      }
    });

    socket.on("project:editing_activity", (data) => {
      if (data.userId !== resolvedUserId) {
        emitChannelEvent("project:remote:editingActivity", data);
      }
      markActivity();
      if (COLLAB_DEBUG) {
        recordDebugEvent("recv:project:editing_activity", data);
      }
    });

    socket.on("project:error", (error) => {
      emitChannelEvent("project:remote:error", { error, projectId });
      if (COLLAB_DEBUG) {
        recordDebugEvent("recv:project:error", error);
      }
    });

    socket.on("project:resync:response", (payload) => {
      if (!payload?.success) return;
      if (payload.version && payload.version > versionRef.current) {
        versionRef.current = payload.version;
      }
      if (Array.isArray(payload.ops)) {
        payload.ops.forEach((op) => {
          if (!op || op.senderId === resolvedUserId) return;
          emitChannelEvent(REMOTE_EVENT_MAP[op.type] ?? op.type, op.payload);
        });
      }
      markActivity();
      if (COLLAB_DEBUG) {
        recordDebugEvent("recv:project:resync:response", {
          version: payload.version,
          ops: payload.ops?.length,
        });
      }
    });

    socket.on("connect", () => {
      if (COLLAB_DEBUG) {
        console.log("[Collaboration] Socket connected");
      }
      emitChannelEvent("project:remote:connection", {
        connected: true,
      });
      markActivity();
      if (COLLAB_DEBUG) {
        recordDebugEvent("socket:connect", { socketId: socket.id });
      }

      if (hasJoinedRef.current && projectId && resolvedUserId) {
        if (COLLAB_DEBUG) {
          console.log(
            "[Collaboration] Reconnecting, rejoining project:",
            projectId
          );
        }
        socket.emit("project:join", { projectId, userId: resolvedUserId });
      } else if (!hasJoinedRef.current) {
        joinProject();
      }
      performResync();
    });

    socket.on("disconnect", (reason) => {
      if (COLLAB_DEBUG) {
        console.log("[Collaboration] Socket disconnected:", reason);
      }
      hasJoinedRef.current = false;
      cleanupHeartbeat();
      cleanupActivityWatcher();
      emitChannelEvent("project:remote:connection", {
        connected: false,
      });
      scheduleResync();
      if (COLLAB_DEBUG) {
        recordDebugEvent("socket:disconnect", { reason });
      }
    });

    if (socket.connected) {
      emitChannelEvent("project:remote:connection", {
        connected: true,
      });
      markActivity();
      if (COLLAB_DEBUG) {
        recordDebugEvent("socket:connected-initial", { socketId: socket.id });
      }
    }

    cleanupActivityWatcher();
    activityIntervalRef.current = setInterval(() => {
      if (!socketRef.current?.connected) return;
      if (Date.now() - lastActivityRef.current >= STALE_RESYNC_MS) {
        if (COLLAB_DEBUG) {
          recordDebugEvent("resync:idle-trigger", {
            idleMs: Date.now() - lastActivityRef.current,
          });
        }
        performResync();
      }
    }, ACTIVITY_CHECK_INTERVAL);

    return () => {
      cleanupHeartbeat();
      cleanupActivityWatcher();
      if (resyncTimeoutRef.current) {
        clearTimeout(resyncTimeoutRef.current);
        resyncTimeoutRef.current = null;
      }
      if (hasJoinedRef.current) {
        socket.emit("project:leave", { projectId });
        hasJoinedRef.current = false;
      }
      Object.values(throttleTimersRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
      throttleTimersRef.current = {};
      throttlePayloadRef.current = {};
      socket.off("project:update");
      socket.off("project:presence");
      socket.off("project:cursor_update");
      socket.off("project:editing_activity");
      socket.off("project:error");
      socket.off("project:resync:response");
      socket.off("project:ack");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [
    projectId,
    resolvedUserId,
    applyRemotePayload,
    emitChannelEvent,
    performResync,
    scheduleResync,
    markActivity,
    recordDebugEvent,
  ]);

  // OPTIMIZED: Direct Send (No Throttling Logic Overhead)
  const sendAction = useCallback(
    (type, data, options = {}) => {
      if (!socketRef.current?.connected) {
        if (COLLAB_DEBUG) {
          console.warn(
            "[Collaboration] Cannot broadcast - socket not connected",
            type
          );
        }
        return;
      }
      markActivity();
      // Remove heavy logging/debug overhead in production
      if (COLLAB_DEBUG) {
        recordDebugEvent("emit:project:action", {
          type,
          payloadBytes: data ? JSON.stringify(data).length : 0,
        });
      }
      const collabOpId = options.collabOpId || nanoid();
      socketRef.current.emit("project:action", {
        type,
        data,
        projectId,
        collabOpId,
      });
      return collabOpId;
    },
    [projectId, markActivity, recordDebugEvent]
  );

  // OPTIMIZED: Smart Broadcast with Trailing Edge Throttling
  const broadcast = useCallback(
    (type, data) => {
      if (isRemoteUpdate.current) return;

      const throttleMs = BROADCAST_THROTTLE[type];

      // 1. Immediate Send (Discrete Events)
      // If no throttle is defined, send INSTANTLY.
      // This fixes the "click delay" on buttons, mutes, drops, etc.
      if (!throttleMs) {
        sendAction(type, data);
        return;
      }

      // 2. Throttled Send (Continuous Events like Dragging)
      // We store the *latest* data in the ref so when the timer fires,
      // it sends the most recent state, not the stale one.
      // This is "trailing edge" throttling - we always send the latest value.
      throttlePayloadRef.current[type] = {
        data,
        collabOpId: nanoid(),
      };

      if (throttleTimersRef.current[type]) return; // Timer already running

      throttleTimersRef.current[type] = setTimeout(() => {
        // Flush the LATEST data
        const payload = throttlePayloadRef.current[type];
        if (payload) {
          sendAction(type, payload.data, { collabOpId: payload.collabOpId });
        }

        // Cleanup
        delete throttlePayloadRef.current[type];
        throttleTimersRef.current[type] = null;
      }, throttleMs);
    },
    [sendAction]
  );

  const broadcastCursor = useCallback((sectionId, barIndex) => {
    if (!socketRef.current?.connected) {
      if (COLLAB_DEBUG) {
        console.warn(
          "[Collaboration] Cannot broadcast cursor - socket not connected"
        );
      }
      return;
    }

    socketRef.current.emit("project:cursor", {
      sectionId,
      barIndex,
    });
  }, []);

  const broadcastEditingActivity = useCallback(
    (itemId, isEditing) => {
      if (!socketRef.current?.connected || isRemoteUpdate.current) {
        if (COLLAB_DEBUG) {
          console.warn(
            "[Collaboration] Cannot broadcast editing activity - socket not connected"
          );
        }
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
