import { io } from 'socket.io-client';

// URL của server (cổng Express/Socket.IO)
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:9999';


const getUserIdFromStorage = () => {
  const userString = localStorage.getItem('user'); //
  if (userString) {
    const user = JSON.parse(userString);
    return user._id || user.id || null;
  }
  return null;
};

let socket;

export const initSocket = () => {
  if (socket) {
    socket.disconnect();
  }
  const userId = getUserIdFromStorage();
  if (userId) {
    socket = io(SOCKET_URL, {
      query: { userId: userId }, 
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Đã kết nối:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] Đã ngắt kết nối:', reason);
    });
  } else {
    console.warn('[Socket.IO] Người dùng chưa đăng nhập, không kết nối socket.');
  }
};

export const getSocket = () => {
  // Sửa: Phải kiểm tra 'socket' có tồn tại không trước khi dùng
  if (!socket) {
    // Nếu chưa init (ví dụ: F5 trang), hãy init
    initSocket();
  }
  // Có thể vẫn là null nếu user không đăng nhập
  return socket; 
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// --- Emitters (Gửi sự kiện) ---
export const joinRoom = (roomId) => {
  getSocket().emit('join-room', roomId);
};

export const sendMessage = (roomId, message) => {
  getSocket().emit('send-message-liveroom', { roomId, message });
};

// --- Listeners (Lắng nghe sự kiện) ---
const safeOn = (event, callback) => {
  const s = getSocket();
  if (s) {
    s.on(event, callback);
  }
};
export const onStreamPreviewReady = (callback) => {
  getSocket().on('stream-preview-ready', callback);
};

export const onStreamStatusLive = (callback) => {
  getSocket().on('stream-status-live', callback);
};

export const onStreamEnded = (callback) => {
  getSocket().on('stream-status-ended', callback);
};

export const onStreamDetailsUpdated = (callback) => {
  getSocket().on('stream-details-updated', callback);
};

export const onNewMessage = (callback) => {
  getSocket().on('new-message-liveroom', callback);
};

export const onStreamPrivacyUpdated = (callback) => {
  getSocket().on('stream-privacy-updated', callback);
};
// Hủy tất cả lắng nghe (dùng khi unmount)
export const offSocketEvents = () => {
  const s = getSocket();
  s.off('stream-preview-ready');
  s.off('stream-status-live');
  s.off('stream-status-ended');
  s.off('stream-details-updated');
  s.off('new-message-liveroom');
  s.off('stream-privacy-updated');
};