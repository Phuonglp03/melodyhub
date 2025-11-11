import { io } from 'socket.io-client';
import { store } from '../../redux/store';
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

export const initSocket = (explicitUserId) => {
  if (socket) {
    socket.disconnect();
  }
  const userId = explicitUserId || store.getState().auth.user?.user?.id;
  if (userId) {
    socket = io(SOCKET_URL, {
      query: { userId: userId },
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Đã kết nối:', socket.id, 'as user', userId);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket.IO] connect_error', err?.message);
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
  safeOn('stream-preview-ready', callback);
};

export const onStreamStatusLive = (callback) => {
  safeOn('stream-status-live', callback);
};

export const onStreamEnded = (callback) => {
  safeOn('stream-status-ended', callback);
};

export const onStreamDetailsUpdated = (callback) => {
  safeOn('stream-details-updated', callback);
};

export const onNewMessage = (callback) => {
  safeOn('new-message-liveroom', callback);
};

export const onStreamPrivacyUpdated = (callback) => {
  safeOn('stream-privacy-updated', callback);
};
export const onUserBanned = (callback) => {
  safeOn('user-banned', callback);
};
export const onMessageRemoved = (callback) => {
  safeOn('message-removed', callback);
};
// Hủy tất cả lắng nghe (dùng khi unmount)
export const offSocketEvents = () => {
  safeOff('stream-preview-ready');
  safeOff('stream-status-live');
  safeOff('stream-status-ended');
  safeOff('stream-details-updated');
  safeOff('new-message-liveroom');
  safeOff('stream-privacy-updated');
  safeOff('user-banned');
  safeOff('message-removed');
};

// ========== DM helpers ==========
export const dmJoin = (conversationId) => {
  console.log('[DM] emit dm:join', conversationId);
  getSocket()?.emit('dm:join', conversationId);
};

export const dmTyping = (conversationId, typing) => {
  console.log('[DM] emit dm:typing', { conversationId, typing });
  getSocket()?.emit('dm:typing', { conversationId, typing: !!typing });
};

export const dmSend = (conversationId, text) => {
  console.log('[DM] emit dm:send', { conversationId, text });
  getSocket()?.emit('dm:send', { conversationId, text });
};

export const dmSeen = (conversationId) => {
  console.log('[DM] emit dm:seen', { conversationId });
  getSocket()?.emit('dm:seen', { conversationId });
};

export const onDmNew = (callback) => {
  console.log('[DM] listen dm:new');
  getSocket()?.on('dm:new', callback);
};

export const onDmTyping = (callback) => {
  console.log('[DM] listen dm:typing');
  getSocket()?.on('dm:typing', callback);
};

export const onDmSeen = (callback) => {
  console.log('[DM] listen dm:seen');
  getSocket()?.on('dm:seen', callback);
};

export const onDmBadge = (callback) => {
  console.log('[DM] listen dm:badge');
  getSocket()?.on('dm:badge', callback);
};

export const offDmNew = (callback) => {
  console.log('[DM] off dm:new');
  getSocket()?.off('dm:new', callback);
};

export const offDmTyping = (callback) => {
  console.log('[DM] off dm:typing');
  getSocket()?.off('dm:typing', callback);
};

export const offDmSeen = (callback) => {
  console.log('[DM] off dm:seen');
  getSocket()?.off('dm:seen', callback);
};

export const offDmBadge = (callback) => {
  console.log('[DM] off dm:badge');
  getSocket()?.off('dm:badge', callback);
};