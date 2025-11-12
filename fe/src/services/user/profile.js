import api from '../api';

const getToken = () => {
  if (typeof window === 'undefined') return undefined;
  try {
    return localStorage.getItem('token') || undefined;
  } catch {
    return undefined;
  }
};

export const getMyProfile = async () => {
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const { data } = await api.get('/users/profile', { headers });
  return data;
};

export const getProfileById = async (userId) => {
  if (!userId) throw new Error('userId is required');
  const { data } = await api.get(`/users/${userId}`);
  return data;
};

export const updateMyProfile = async (payload) => {
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const { data } = await api.put('/users/profile', payload, { headers });
  return data;
};

export const uploadMyAvatar = async (file) => {
  const token = getToken();
  // Với FormData, KHÔNG set Content-Type - browser sẽ tự set với boundary
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  
  // Antd Upload có thể trả về file wrapper, lấy originFileObj nếu có
  const fileToUpload = file?.originFileObj || file;
  
  if (!fileToUpload) {
    throw new Error('No file provided');
  }
  
  // CHỈ gửi file avatar với field name là 'avatar' (KHÔNG phải 'avatarUrl')
  // Multer ở BE chỉ nhận field name 'avatar'
  const form = new FormData();
  form.append('avatar', fileToUpload); // QUAN TRỌNG: field name phải là 'avatar'
  // KHÔNG append các field khác ở đây (sẽ gửi riêng qua JSON khi Save changes)
  
  // Debug: Log tất cả fields trong FormData để verify
  console.log('[Upload Avatar] FormData entries:');
  for (const [key, value] of form.entries()) {
    console.log(`  - ${key}:`, value instanceof File ? `File(${value.name}, ${value.size} bytes)` : value);
  }
  
  // Verify field name
  if (!form.has('avatar')) {
    throw new Error('FormData must have field "avatar" (not "avatarUrl")');
  }
  
  console.log('[Upload Avatar] Sending file only:', {
    name: fileToUpload.name,
    size: fileToUpload.size,
    type: fileToUpload.type
  });
  
  const { data } = await api.put('/users/profile', form, { 
    headers,
    // Không set Content-Type để browser tự động set multipart boundary
  });
  
  console.log('[Upload Avatar] Response:', data);
  return data;
};

export const followUser = async (userId) => {
  if (!userId) throw new Error('userId is required');
  const { data } = await api.post(`/users/${userId}/follow`);
  return data;
};

export const unfollowUser = async (userId) => {
  if (!userId) throw new Error('userId is required');
  const { data } = await api.delete(`/users/${userId}/follow`);
  return data;
};

export const getFollowSuggestions = async (limit = 5) => {
  const { data } = await api.get(`/users/suggestions/list`, { params: { limit } });
  return data;
};

export default { getMyProfile, updateMyProfile, uploadMyAvatar, followUser, unfollowUser, getFollowSuggestions };


