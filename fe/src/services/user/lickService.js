import { mockLicks, mockComments, mockUser } from "./mockData";
import { API_CONFIG } from "../../config/api";

const API_BASE_URL = API_CONFIG.API_BASE_URL;
// Normalize to always include '/api'
const API_BASE = (() => {
  const t = (API_BASE_URL || "").replace(/\/$/, "");
  return t.endsWith("/api") ? t : `${t}/api`;
})();
const USE_MOCK_DATA = API_CONFIG.USE_MOCK_DATA;

// Get community licks with search, filter, sort, and pagination
export const getCommunityLicks = async (params = {}) => {
  if (USE_MOCK_DATA) {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, API_CONFIG.MOCK_DELAY));

    const {
      search = "",
      tags = "",
      sortBy = "newest",
      page = 1,
      limit = 20,
    } = params;

    let filteredLicks = [...mockLicks];

    // Apply search filter
    if (search) {
      filteredLicks = filteredLicks.filter(
        (lick) =>
          lick.title.toLowerCase().includes(search.toLowerCase()) ||
          lick.description.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply tag filter
    if (tags) {
      const tagNames = tags.split(",").map((tag) => tag.trim().toLowerCase());
      filteredLicks = filteredLicks.filter((lick) =>
        lick.tags.some((tag) => tagNames.includes(tag.tag_name.toLowerCase()))
      );
    }

    // Apply sorting
    switch (sortBy) {
      case "newest":
        filteredLicks.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        break;
      case "popular":
        filteredLicks.sort((a, b) => b.likes_count - a.likes_count);
        break;
      case "trending":
        filteredLicks.sort(
          (a, b) =>
            b.likes_count +
            b.comments_count -
            (a.likes_count + a.comments_count)
        );
        break;
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLicks = filteredLicks.slice(startIndex, endIndex);

    return {
      success: true,
      data: paginatedLicks,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(filteredLicks.length / limit),
        totalItems: filteredLicks.length,
        hasNextPage: endIndex < filteredLicks.length,
        hasPrevPage: page > 1,
      },
    };
  }

  try {
    const {
      search = "",
      tags = "",
      sortBy = "newest",
      page = 1,
      limit = 20,
    } = params;

    const queryParams = new URLSearchParams({
      search,
      tags,
      sortBy,
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await fetch(
      `${API_BASE}/licks/community?${queryParams}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching community licks:", error);
    throw error;
  }
};

// Get lick by ID with full details
export const getLickById = async (lickId) => {
  if (USE_MOCK_DATA) {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, API_CONFIG.MOCK_DELAY));

    const lick = mockLicks.find((l) => l.lick_id === lickId);
    if (!lick) {
      throw new Error("Lick not found");
    }

    return {
      success: true,
      data: lick,
    };
  }

  try {
    const response = await fetch(`${API_BASE}/licks/${lickId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching lick by ID:", error);
    throw error;
  }
};

// Like/Unlike a lick
export const toggleLickLike = async (lickId, userId) => {
  if (USE_MOCK_DATA) {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, API_CONFIG.MOCK_DELAY));

    // Mock like toggle - in real app this would be handled by backend
    return {
      success: true,
      message: "Lick liked successfully",
      data: { liked: true },
    };
  }

  try {
    const response = await fetch(`${API_BASE}/licks/${lickId}/like`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error toggling lick like:", error);
    throw error;
  }
};

// Get comments for a lick
export const getLickComments = async (lickId, page = 1, limit = 10) => {
  if (USE_MOCK_DATA) {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, API_CONFIG.MOCK_DELAY));

    const comments = mockComments[lickId] || [];
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedComments = comments.slice(startIndex, endIndex);

    return {
      success: true,
      data: paginatedComments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(comments.length / limit),
        totalItems: comments.length,
        hasNextPage: endIndex < comments.length,
        hasPrevPage: page > 1,
      },
    };
  }

  try {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await fetch(
      `${API_BASE}/licks/${lickId}/comments?${queryParams}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching lick comments:", error);
    throw error;
  }
};

// Add comment to a lick
export const addLickComment = async (lickId, commentData) => {
  if (USE_MOCK_DATA) {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, API_CONFIG.MOCK_DELAY));

    const { userId, comment, parentCommentId, timestamp } = commentData;

    // Create new comment
    const newComment = {
      comment_id: `comment_${Date.now()}`,
      lick_id: lickId,
      user_id: userId,
      username: mockUser.username,
      display_name: mockUser.display_name,
      avatar_url: mockUser.avatar_url,
      comment: comment,
      timestamp: timestamp || 0,
      parent_comment_id: parentCommentId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return {
      success: true,
      message: "Comment added successfully",
      data: newComment,
    };
  }

  try {
    const { userId, comment, parentCommentId, timestamp } = commentData;

    const response = await fetch(`${API_BASE}/licks/${lickId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        comment,
        parentCommentId,
        timestamp,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error adding lick comment:", error);
    throw error;
  }
};

// Play Lick Audio - Get audio URL for playback
export const playLickAudio = async (lickId, userId = null) => {
  if (USE_MOCK_DATA) {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, API_CONFIG.MOCK_DELAY));

    const lick = mockLicks.find((l) => l.lick_id === lickId);
    if (!lick) {
      throw new Error("Lick not found");
    }

    return {
      success: true,
      data: {
        audio_url: lick.audio_url,
        title: lick.title,
        duration: lick.duration,
        lick_id: lick.lick_id,
      },
      message: "Audio URL retrieved successfully",
    };
  }

  try {
    const queryParams = userId
      ? new URLSearchParams({ userId: userId.toString() })
      : "";

    const response = await fetch(
      `${API_BASE}/licks/${lickId}/play${
        queryParams ? `?${queryParams}` : ""
      }`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error playing lick audio:", error);
    throw error;
  }
};

// Create a new lick with audio file
export const createLick = async (formData) => {
  try {
    const response = await fetch(`${API_BASE}/licks`, {
      method: "POST",
      body: formData, // Send FormData directly (no Content-Type header needed)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || `HTTP error! status: ${response.status}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error creating lick:", error);
    throw error;
  }
};

// Update a lick
export const updateLick = async (lickId, lickData) => {
  if (USE_MOCK_DATA) {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, API_CONFIG.MOCK_DELAY));
    return {
      success: true,
      message: "Lick updated successfully",
    };
  }

  try {
    const response = await fetch(`${API_BASE}/licks/${lickId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(lickData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || `HTTP error! status: ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating lick:", error);
    throw error;
  }
};

// Delete a lick
export const deleteLick = async (lickId) => {
  if (USE_MOCK_DATA) {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, API_CONFIG.MOCK_DELAY));
    return {
      success: true,
      message: "Lick deleted successfully",
    };
  }

  try {
    const response = await fetch(`${API_BASE}/licks/${lickId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.message || `HTTP error! status: ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error deleting lick:", error);
    throw error;
  }
};