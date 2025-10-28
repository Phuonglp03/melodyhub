import { Server } from 'socket.io';
import RoomChat from '../models/RoomChat.js';
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

    socket.on('send-message', async ({ roomId, message }) => {
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
        io.to(roomId).emit('new-message', result);

      } catch (err) {
        console.error(`[Socket.IO] Lỗi khi gửi tin nhắn: ${err.message}`);
        socket.emit('chat-error', 'Không thể gửi tin nhắn.');
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