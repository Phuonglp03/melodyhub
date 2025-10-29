import http from '../http';

export const getStoredUserId = () => {
  if (typeof window === 'undefined') return undefined;
  try {
    const storedUserRaw = localStorage.getItem('user');
    const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
    // Backend stores `id` in auth responses; fallback to `_id` if present
    return storedUser?.id || storedUser?._id || undefined;
  } catch {
    return undefined;
  }
};

export const listPosts = async ({ page = 1, limit = 10 } = {}) => {
  const { data } = await http.get('/posts', { params: { page, limit } });
  return data;
};

export const listMyPosts = async ({ page = 1, limit = 10 } = {}) => {
  const userId = getStoredUserId();
  if (!userId) {
    // Fallback to public posts if no user in localStorage
    const { data } = await http.get('/posts', { params: { page, limit } });
    return data;
  }
  const { data } = await http.get(`/posts/user/${userId}`, { params: { page, limit } });
  return data;
};

export const getPostById = async (postId) => {
  const { data } = await http.get(`/posts/${postId}`);
  return data;
};

export const listPostsByUser = async (userId, { page = 1, limit = 10 } = {}) => {
  const { data } = await http.get(`/posts/user/${userId}`, { params: { page, limit } });
  return data;
};

export const createPost = async (payload) => {
  // payload can be FormData for media upload or JSON for text-only
  const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
  // Ensure userId exists by defaulting from localStorage if missing
  let finalPayload = payload;
  if (!isFormData) {
    const userId = (payload && payload.userId) ? payload.userId : getStoredUserId();
    finalPayload = { ...payload, userId };
  } else {
    // For FormData, only append if not already present
    const hasUserId = payload.has && payload.has('userId');
    if (!hasUserId) {
      const userId = getStoredUserId();
      if (userId) payload.append('userId', userId);
    }
  }
  // Do NOT set Content-Type manually for FormData; Axios will add boundary
  const { data } = await http.post('/posts', finalPayload);
  return data;
};

export const updatePost = async (postId, payload) => {
  // Let Axios set correct headers when payload is FormData
  const { data } = await http.put(`/posts/${postId}`, payload);
  return data;
};

export const deletePost = async (postId) => {
  const { data } = await http.delete(`/posts/${postId}`);
  return data;
};

export default {
  listPosts,
  listMyPosts,
  getPostById,
  listPostsByUser,
  createPost,
  updatePost,
  deletePost,
  getStoredUserId,
};


