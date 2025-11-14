// src/services/livestreamService.js
import http from '../http';

const getUserIdFromStorage = () => {
  const userString = localStorage.getItem('user'); //
  if (userString) {
    const user = JSON.parse(userString);
    // Giả định user object có _id (từ MongoDB)
    return user._id || user.id || null; 
  }
  return null;
};


const createLiveStream = async () => {
  const { data } = await http.post('/livestreams', {});
  return data;
};

const getLiveStreamById = async (roomId) => {
  const userId = getUserIdFromStorage();
  let url = `/livestreams/${roomId}`;
  if (userId) {
    url += `?userId=${userId}`;
  }
  const { data } = await http.get(url);
  return data; 
};

const updateLiveStreamDetails = async (roomId, details) => {
  const { data } = await http.patch(`/livestreams/${roomId}/details`, details);
  return data;
};

const goLive = async (roomId) => {
  const { data } = await http.patch(`/livestreams/${roomId}/go-live`);
  return data;
};

const updatePrivacy = async (roomId, privacyType) => {
  const { data } = await http.patch(`/livestreams/${roomId}/privacy`, { privacyType });
  return data;
};

const endLiveStream = async (roomId) => {
  const { data } = await http.patch(`/livestreams/${roomId}/end`);
  return data;
};

const banUser = async (roomId, userId, { messageId }) => {
  const { data } = await http.post(`/livestreams/${roomId}/ban/${userId}`, { messageId });
  return data;
};

const getChatHistory = async (roomId) => {
  const { data } = await http.get(`/livestreams/${roomId}/chat`);
  return data;
};
export const livestreamService = {
  createLiveStream,
  getLiveStreamById,
  updateLiveStreamDetails,
  goLive,
  endLiveStream,
  updatePrivacy,
  getChatHistory,
  banUser,
};