import http from "../http";

/**
 * Report a post
 * @param {string} postId - ID of the post to report
 * @param {object} reportData - Report data
 * @param {string} reportData.reason - Reason for reporting (spam, inappropriate, copyright, harassment, other)
 * @param {string} [reportData.description] - Optional description
 * @returns {Promise<object>} Response data
 */
export const reportPost = async (postId, reportData) => {
  const { data } = await http.post(`/reports/posts/${postId}`, reportData);
  return data;
};

/**
 * Get reports for a post (admin only)
 * @param {string} postId - ID of the post
 * @returns {Promise<object>} Response data with reports array
 */
export const getPostReports = async (postId) => {
  const { data } = await http.get(`/reports/posts/${postId}`);
  return data;
};

/**
 * Check if current user has reported a post
 * @param {string} postId - ID of the post
 * @returns {Promise<object>} Response data with hasReported boolean
 */
export const checkPostReport = async (postId) => {
  const { data } = await http.get(`/reports/posts/${postId}/check`);
  return data;
};

