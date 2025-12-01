import { Server } from "socket.io";
import RoomChat from "../models/RoomChat.js";
import Conversation from "../models/Conversation.js";
import DirectMessage from "../models/DirectMessage.js";
import LiveRoom from "../models/LiveRoom.js";
import Project from "../models/Project.js";
import ProjectCollaborator from "../models/ProjectCollaborator.js";
import {
  uploadMessageText,
  downloadMessageText,
} from "../services/messageStorageService.js";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
let io;

// Track active collaborators per project: { projectId: Map<userId, { user, cursor, socketIds }> }
const projectCollaborators = new Map();

// Track viewers per room: { roomId: Set of userIds }
const roomViewers = new Map();

export const socketServer = (httpServer) => {
  const originsEnv =
    process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || "*";
  const allowedOrigins = originsEnv
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  console.log(
    "[Socket.IO] Allowed CORS origins:",
    allowedOrigins.length ? allowedOrigins : ["*"]
  );

  io = new Server(httpServer, {
    cors: {
      origin:
        allowedOrigins.length === 1 && allowedOrigins[0] === "*"
          ? "*"
          : allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const pubClient = createClient({
    url: process.env.REDIS_URL || "",
  });
  const subClient = pubClient.duplicate();
  Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      console.log("[Socket.IO] Đã kết nối Redis Adapter thành công");
    })
    .catch((err) => {
      console.error("[Socket.IO] Lỗi kết nối Redis:", err);
    });

  io.engine.on("connection_error", (err) => {
    console.error("[Socket.IO] connection_error:", {
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Client kết nối: ${socket.id}`);

    const tempUserId = socket.handshake.query.userId;
    if (tempUserId) {
      console.log(`[Socket.IO] User ID (tạm thời): ${tempUserId}`);
      socket.join(tempUserId);
    }
    socket.on("join-room", async (roomId) => {
      socket.join(roomId);
      console.log(
        `[Socket.IO] Client ${socket.id} (user: ${tempUserId}) đã tham gia phòng ${roomId}`
      );

      // Track viewer (exclude host) - only for LiveRooms, not posts
      if (tempUserId && roomId && !roomId.startsWith("post:")) {
        socket.currentRoomId = roomId; // Store for disconnect

        try {
          // Check if user is host
          const room = await LiveRoom.findById(roomId);
          const isHost = room && String(room.hostId) === String(tempUserId);

          if (!isHost) {
            // Only track non-host viewers
            if (!roomViewers.has(roomId)) {
              roomViewers.set(roomId, new Map());
            }
            const viewers = roomViewers.get(roomId);

            // Store user info with socket id
            if (!viewers.has(tempUserId)) {
              viewers.set(tempUserId, new Set());
            }
            viewers.get(tempUserId).add(socket.id);

            const currentCount = viewers.size;
            const viewerList = Array.from(viewers.keys());

            // Emit viewer count update
            io.to(roomId).emit("viewer-count-update", {
              roomId,
              currentViewers: currentCount,
              viewerIds: viewerList,
            });

            console.log(
              `[Socket.IO] Room ${roomId} now has ${currentCount} viewers (excluding host)`
            );
          } else {
            console.log(
              `[Socket.IO] Host joined room ${roomId}, not counted as viewer`
            );
          }
        } catch (err) {
          console.error("[Socket.IO] Error checking host:", err);
        }
      }
    });

    socket.on("send-message-liveroom", async ({ roomId, message }) => {
      if (!tempUserId) {
        return socket.emit("chat-error", "Xác thực không hợp lệ.");
      }

      try {
        // ✅ Check if user is banned
        const room = await LiveRoom.findById(roomId);
        if (!room) {
          return socket.emit("chat-error", "Phòng không tồn tại.");
        }

        const isBanned = room.bannedUsers.some(
          (bannedId) => String(bannedId) === String(tempUserId)
        );

        if (isBanned) {
          return socket.emit(
            "chat-error",
            "Bạn đã bị cấm bình luận trong phòng này."
          );
        }

        const chat = new RoomChat({
          roomId,
          userId: tempUserId,
          message,
          messageType: "text",
        });

        const savedChat = await chat.save();
        const result = await RoomChat.findById(savedChat._id).populate(
          "userId",
          "displayName avatarUrl"
        );
        io.to(roomId).emit("new-message-liveroom", result);
      } catch (err) {
        console.error(`[Socket.IO] Lỗi khi gửi tin nhắn: ${err.message}`);
        socket.emit("chat-error", "Không thể gửi tin nhắn.");
      }
    });

    // --- DM events ---
    socket.on("dm:join", (conversationId) => {
      if (!conversationId) return;
      socket.join(conversationId);
      console.log(`[Socket.IO] ${socket.id} dm:join ${conversationId}`);
    });

    socket.on("dm:typing", ({ conversationId, typing }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit("dm:typing", {
        conversationId,
        typing: !!typing,
        userId: tempUserId,
      });
      console.log(
        `[Socket.IO] dm:typing from ${tempUserId} -> room ${conversationId} typing=${!!typing}`
      );
    });

    socket.on("dm:send", async ({ conversationId, text }) => {
      try {
        if (!tempUserId) return socket.emit("dm:error", "Unauthorized");
        if (!conversationId || !text || !text.trim()) return;

        const convo = await Conversation.findById(conversationId);
        if (!convo) return socket.emit("dm:error", "Conversation not found");
        const isParticipant = convo.participants.some(
          (p) => String(p) === String(tempUserId)
        );
        if (!isParticipant) return socket.emit("dm:error", "Not a participant");
        if (convo.status !== "active") {
          const isRequester =
            String(convo.requestedBy || "") === String(tempUserId);
          if (!(convo.status === "pending" && isRequester)) {
            return socket.emit(
              "dm:error",
              "Conversation not active (only requester can send while pending)"
            );
          }
        }

        // Upload text to storage (Cloudinary if long, MongoDB if short)
        const messageId = `msg_${Date.now()}_${tempUserId}`;
        const storageResult = await uploadMessageText(text.trim(), messageId);

        // Create message with storage info
        const msg = await DirectMessage.create({
          conversationId,
          senderId: tempUserId,
          text: storageResult.text || null,
          textStorageId: storageResult.storageId || null,
          textStorageType: storageResult.storageType,
          textPreview: storageResult.textPreview,
        });

        const populatedMsg = await DirectMessage.findById(msg._id)
          .populate("senderId", "displayName username avatarUrl")
          .lean();

        // Download full text nếu lưu trong Cloudinary
        if (
          populatedMsg.textStorageType === "cloudinary" &&
          populatedMsg.textStorageId
        ) {
          populatedMsg.text = await downloadMessageText(
            populatedMsg.textStorageType,
            populatedMsg.textStorageId,
            populatedMsg.textPreview
          );
        } else {
          populatedMsg.text =
            populatedMsg.text || populatedMsg.textPreview || "";
        }

        const peer = convo.participants.find(
          (p) => String(p) !== String(tempUserId)
        );
        convo.lastMessage = storageResult.textPreview;
        convo.lastMessageAt = msg.createdAt;
        const currentUnread = Number(
          convo.unreadCounts?.get(String(peer)) || 0
        );
        convo.unreadCounts.set(String(peer), currentUnread + 1);
        await convo.save();

        console.log(
          `[Socket.IO] dm:send saved -> emit dm:new to room ${conversationId} and users ${tempUserId} / ${peer}`
        );
        io.to(conversationId).emit("dm:new", {
          conversationId,
          message: populatedMsg,
        });
        if (peer) {
          io.to(String(peer)).emit("dm:new", {
            conversationId,
            message: populatedMsg,
          });
          io.to(String(peer)).emit("dm:badge", { conversationId });
        }
        io.to(String(tempUserId)).emit("dm:badge", { conversationId });
      } catch (err) {
        console.error("[Socket.IO] dm:send error:", err.message);
        socket.emit("dm:error", "Cannot send message");
      }
    });

    socket.on("dm:seen", async ({ conversationId }) => {
      try {
        if (!tempUserId || !conversationId) return;
        const convo = await Conversation.findById(conversationId);
        if (!convo) return;
        const isParticipant = convo.participants.some(
          (p) => String(p) === String(tempUserId)
        );
        if (!isParticipant) return;
        convo.unreadCounts.set(String(tempUserId), 0);
        await convo.save();
        socket
          .to(conversationId)
          .emit("dm:seen", { conversationId, userId: tempUserId });
      } catch (err) {
        console.error("[Socket.IO] dm:seen error:", err.message);
      }
    });

    // ========== PROJECT COLLABORATION EVENTS ==========
    socket.on("project:join", async ({ projectId, userId }) => {
      if (!projectId || !userId) {
        return socket.emit("project:error", {
          message: "Missing projectId or userId",
        });
      }

      try {
        // Security: Check if user has access to this project
        const project = await Project.findById(projectId);
        if (!project) {
          return socket.emit("project:error", { message: "Project not found" });
        }

        // Check if user is owner or collaborator
        const isOwner = String(project.creatorId) === String(userId);
        const collaborator = await ProjectCollaborator.findOne({
          projectId,
          userId,
          role: { $in: ["admin", "editor", "viewer"] },
        });
        const hasAccess = isOwner || !!collaborator;

        if (!hasAccess) {
          return socket.emit("project:error", { message: "Access denied" });
        }

        // Join project room
        socket.join(`project:${projectId}`);
        socket.data.projectId = projectId;
        socket.data.userId = userId;

        // Track collaborator
        if (!projectCollaborators.has(projectId)) {
          projectCollaborators.set(projectId, new Map());
        }
        const collaborators = projectCollaborators.get(projectId);

        if (!collaborators.has(userId)) {
          collaborators.set(userId, {
            userId,
            cursor: null,
            socketIds: new Set(),
          });
        }
        collaborators.get(userId).socketIds.add(socket.id);

        // Get user info for presence
        const User = (await import("../models/User.js")).default;
        const user = await User.findById(userId).select(
          "displayName username avatarUrl"
        );

        if (user) {
          collaborators.get(userId).user = {
            _id: user._id,
            displayName: user.displayName || user.username,
            username: user.username,
            avatarUrl: user.avatarUrl,
          };
        }

        // Broadcast presence update to others in room
        const activeCollaborators = Array.from(collaborators.values()).map(
          (c) => ({
            userId: c.userId,
            user: c.user,
            cursor: c.cursor,
          })
        );

        socket.to(`project:${projectId}`).emit("project:presence", {
          type: "JOIN",
          userId,
          user: collaborators.get(userId)?.user,
          collaborators: activeCollaborators,
        });

        // Send current collaborators to the new joiner
        socket.emit("project:presence", {
          type: "SYNC",
          collaborators: activeCollaborators,
        });

        console.log(`[Socket.IO] User ${userId} joined project ${projectId}`);
      } catch (err) {
        console.error("[Socket.IO] project:join error:", err);
        socket.emit("project:error", { message: "Failed to join project" });
      }
    });

    socket.on("project:action", (payload) => {
      const { projectId } = socket.data;
      if (!projectId) {
        return socket.emit("project:error", {
          message: "Not in a project room",
        });
      }

      // Broadcast to all others in the project room (excluding sender)
      socket.to(`project:${projectId}`).emit("project:update", {
        ...payload,
        senderId: socket.data.userId,
        timestamp: Date.now(),
      });

      console.log(
        `[Socket.IO] project:action ${payload.type} from ${socket.data.userId} in project ${projectId}`
      );
    });

    socket.on("project:cursor", (data) => {
      const { projectId, userId } = socket.data;
      if (!projectId || !userId) return;

      // Update cursor for this user
      const collaborators = projectCollaborators.get(projectId);
      if (collaborators && collaborators.has(userId)) {
        collaborators.get(userId).cursor = data; // { sectionId, barIndex }
      }

      // Broadcast cursor update to others
      socket.to(`project:${projectId}`).emit("project:cursor_update", {
        userId,
        cursor: data,
      });
    });

    socket.on("project:editing_activity", (data) => {
      const { projectId, userId } = socket.data;
      if (!projectId || !userId) return;

      // Broadcast editing activity to others
      socket.to(`project:${projectId}`).emit("project:editing_activity", {
        userId,
        itemId: data.itemId,
        isEditing: data.isEditing,
      });
    });

    socket.on("project:leave", ({ projectId }) => {
      if (!projectId) return;
      socket.leave(`project:${projectId}`);

      const { userId } = socket.data;
      if (userId) {
        const collaborators = projectCollaborators.get(projectId);
        if (collaborators && collaborators.has(userId)) {
          collaborators.get(userId).socketIds.delete(socket.id);

          // If user has no more sockets, remove them
          if (collaborators.get(userId).socketIds.size === 0) {
            collaborators.delete(userId);

            // Broadcast leave event
            socket.to(`project:${projectId}`).emit("project:presence", {
              type: "LEAVE",
              userId,
            });
          }
        }

        // Clean up empty project
        if (collaborators && collaborators.size === 0) {
          projectCollaborators.delete(projectId);
        }
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Client ngắt kết nối: ${socket.id}`);

      // Remove viewer from tracking
      if (tempUserId && socket.currentRoomId) {
        const roomId = socket.currentRoomId;
        const viewers = roomViewers.get(roomId);

        if (viewers && viewers.has(tempUserId)) {
          const userSockets = viewers.get(tempUserId);
          userSockets.delete(socket.id);

          // If user has no more sockets, remove them
          if (userSockets.size === 0) {
            viewers.delete(tempUserId);
          }

          // Emit updated count
          const currentCount = viewers.size;
          const viewerList = Array.from(viewers.keys());
          io.to(roomId).emit("viewer-count-update", {
            roomId,
            currentViewers: currentCount,
            viewerIds: viewerList,
          });

          console.log(
            `[Socket.IO] Room ${roomId} now has ${currentCount} viewers (user left)`
          );

          // Clean up empty room
          if (viewers.size === 0) {
            roomViewers.delete(roomId);
          }
        }
      }

      // Handle project collaboration disconnect
      const { projectId, userId } = socket.data;
      if (projectId && userId) {
        const collaborators = projectCollaborators.get(projectId);
        if (collaborators && collaborators.has(userId)) {
          collaborators.get(userId).socketIds.delete(socket.id);

          if (collaborators.get(userId).socketIds.size === 0) {
            collaborators.delete(userId);

            socket.to(`project:${projectId}`).emit("project:presence", {
              type: "LEAVE",
              userId,
            });
          }
        }

        if (collaborators && collaborators.size === 0) {
          projectCollaborators.delete(projectId);
        }
      }
    });
  });

  return io;
};

export const getSocketIo = () => {
  if (!io) {
    throw new Error("Socket.io chưa được khởi tạo!");
  }
  return io;
};
