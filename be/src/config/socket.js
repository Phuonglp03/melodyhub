import { Server } from 'socket.io';
import RoomChat from '../models/RoomChat.js';
import Conversation from '../models/Conversation.js';
import DirectMessage from '../models/DirectMessage.js';
import { uploadMessageText, downloadMessageText } from '../services/messageStorageService.js';
let io;

export const socketServer = (httpServer) => {
  const originsEnv = process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || '*';
  const allowedOrigins = originsEnv.split(',').map((o) => o.trim()).filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length === 1 && allowedOrigins[0] === '*' ? '*' : allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client kết nối: ${socket.id}`);
    
    const tempUserId = socket.handshake.query.userId;
    if (tempUserId) {
       console.log(`[Socket.IO] User ID (tạm thời): ${tempUserId}`);
       socket.join(tempUserId);
    }
    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      console.log(`[Socket.IO] Client ${socket.id} đã tham gia phòng ${roomId}`);
    });

    socket.on('send-message-liveroom', async ({ roomId, message }) => {
      if (!tempUserId) {
        return socket.emit('chat-error', 'Xác thực không hợp lệ.');
      }
      
      try {
        const chat = new RoomChat({
          roomId,
          userId: tempUserId, 
          message,
          messageType: 'text'
        });
        
        const savedChat = await chat.save();
        const result = await RoomChat.findById(savedChat._id).populate('userId', 'displayName avatarUrl');
        io.to(roomId).emit('new-message-liveroom', result);

      } catch (err) {
        console.error(`[Socket.IO] Lỗi khi gửi tin nhắn: ${err.message}`);
        socket.emit('chat-error', 'Không thể gửi tin nhắn.');
      }
    });

    // --- DM events ---
    socket.on('dm:join', (conversationId) => {
      if (!conversationId) return;
      socket.join(conversationId);
      console.log(`[Socket.IO] ${socket.id} dm:join ${conversationId}`);
    });

    socket.on('dm:typing', ({ conversationId, typing }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit('dm:typing', { conversationId, typing: !!typing, userId: tempUserId });
      console.log(`[Socket.IO] dm:typing from ${tempUserId} -> room ${conversationId} typing=${!!typing}`);
    });

    socket.on('dm:send', async ({ conversationId, text }) => {
      try {
        if (!tempUserId) return socket.emit('dm:error', 'Unauthorized');
        if (!conversationId || !text || !text.trim()) return;

        const convo = await Conversation.findById(conversationId);
        if (!convo) return socket.emit('dm:error', 'Conversation not found');
        const isParticipant = convo.participants.some((p) => String(p) === String(tempUserId));
        if (!isParticipant) return socket.emit('dm:error', 'Not a participant');
        if (convo.status !== 'active') {
          const isRequester = String(convo.requestedBy || '') === String(tempUserId);
          if (!(convo.status === 'pending' && isRequester)) {
            return socket.emit('dm:error', 'Conversation not active (only requester can send while pending)');
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
          textPreview: storageResult.textPreview
        });

        const populatedMsg = await DirectMessage.findById(msg._id)
          .populate('senderId', 'displayName username avatarUrl')
          .lean();

        // Download full text nếu lưu trong Cloudinary
        if (populatedMsg.textStorageType === 'cloudinary' && populatedMsg.textStorageId) {
          populatedMsg.text = await downloadMessageText(
            populatedMsg.textStorageType,
            populatedMsg.textStorageId,
            populatedMsg.textPreview
          );
        } else {
          populatedMsg.text = populatedMsg.text || populatedMsg.textPreview || '';
        }

        const peer = convo.participants.find((p) => String(p) !== String(tempUserId));
        convo.lastMessage = storageResult.textPreview;
        convo.lastMessageAt = msg.createdAt;
        const currentUnread = Number(convo.unreadCounts?.get(String(peer)) || 0);
        convo.unreadCounts.set(String(peer), currentUnread + 1);
        await convo.save();

        console.log(`[Socket.IO] dm:send saved -> emit dm:new to room ${conversationId} and users ${tempUserId} / ${peer}`);
        io.to(conversationId).emit('dm:new', { conversationId, message: populatedMsg });
        if (peer) {
          io.to(String(peer)).emit('dm:new', { conversationId, message: populatedMsg });
          io.to(String(peer)).emit('dm:badge', { conversationId });
        }
        io.to(String(tempUserId)).emit('dm:badge', { conversationId });
      } catch (err) {
        console.error('[Socket.IO] dm:send error:', err.message);
        socket.emit('dm:error', 'Cannot send message');
      }
    });

    socket.on('dm:seen', async ({ conversationId }) => {
      try {
        if (!tempUserId || !conversationId) return;
        const convo = await Conversation.findById(conversationId);
        if (!convo) return;
        const isParticipant = convo.participants.some((p) => String(p) === String(tempUserId));
        if (!isParticipant) return;
        convo.unreadCounts.set(String(tempUserId), 0);
        await convo.save();
        socket.to(conversationId).emit('dm:seen', { conversationId, userId: tempUserId });
      } catch (err) {
        console.error('[Socket.IO] dm:seen error:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client ngắt kết nối: ${socket.id}`);
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