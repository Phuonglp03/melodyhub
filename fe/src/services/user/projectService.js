import api from "../api";

// Create a new project
export const createProject = async (projectData) => {
  try {
    const res = await api.post("/projects", projectData);
    return res.data;
  } catch (error) {
    console.error("Error creating project:", error);
    throw error;
  }
};

// Get all projects for the current user
export const getUserProjects = async (filter = "all", status = null) => {
  try {
    const params = { filter };
    if (status) {
      params.status = status;
    }
    const res = await api.get("/projects", {
      params,
    });
    return res.data;
  } catch (error) {
    console.error("Error fetching user projects:", error);
    throw error;
  }
};

// Get project by ID with full details
export const getProjectById = async (projectId) => {
  try {
    const res = await api.get(`/projects/${projectId}`);
    return res.data;
  } catch (error) {
    console.error("Error fetching project:", error);
    throw error;
  }
};

// Update project
export const updateProject = async (projectId, projectData) => {
  try {
    const res = await api.put(`/projects/${projectId}`, projectData);
    return res.data;
  } catch (error) {
    console.error("Error updating project:", error);
    throw error;
  }
};

// Delete project
export const deleteProject = async (projectId) => {
  try {
    const res = await api.delete(`/projects/${projectId}`);
    return res.data;
  } catch (error) {
    console.error("Error deleting project:", error);
    throw error;
  }
};

// Add lick to timeline
export const addLickToTimeline = async (projectId, timelineData) => {
  try {
    const res = await api.post(
      `/projects/${projectId}/timeline/items`,
      timelineData
    );
    return res.data;
  } catch (error) {
    console.error("Error adding lick to timeline:", error);
    throw error;
  }
};

// Update timeline item
export const updateTimelineItem = async (projectId, itemId, updateData) => {
  try {
    const res = await api.put(
      `/projects/${projectId}/timeline/items/${itemId}`,
      updateData
    );
    return res.data;
  } catch (error) {
    console.error("Error updating timeline item:", error);
    throw error;
  }
};

// Bulk update timeline items (buffered autosave)
export const bulkUpdateTimelineItems = async (projectId, items) => {
  try {
    const res = await api.put(`/projects/${projectId}/timeline/items/bulk`, {
      items,
    });
    return res.data;
  } catch (error) {
    console.error("Error bulk updating timeline items:", error);
    throw error;
  }
};

// Delete timeline item
export const deleteTimelineItem = async (projectId, itemId) => {
  try {
    const res = await api.delete(
      `/projects/${projectId}/timeline/items/${itemId}`
    );
    return res.data;
  } catch (error) {
    console.error("Error deleting timeline item:", error);
    throw error;
  }
};

// Update chord progression
export const updateChordProgression = async (projectId, chordProgression) => {
  try {
    const res = await api.put(`/projects/${projectId}/chords`, {
      chordProgression,
    });
    return res.data;
  } catch (error) {
    console.error("Error updating chord progression:", error);
    throw error;
  }
};

// Add track to project
export const addTrack = async (projectId, trackData) => {
  try {
    const res = await api.post(`/projects/${projectId}/tracks`, trackData);
    return res.data;
  } catch (error) {
    console.error("Error adding track:", error);
    throw error;
  }
};

// Update track
export const updateTrack = async (projectId, trackId, trackData) => {
  try {
    const res = await api.put(
      `/projects/${projectId}/tracks/${trackId}`,
      trackData
    );
    return res.data;
  } catch (error) {
    console.error("Error updating track:", error);
    throw error;
  }
};

// Delete track
export const deleteTrack = async (projectId, trackId) => {
  try {
    const res = await api.delete(`/projects/${projectId}/tracks/${trackId}`);
    return res.data;
  } catch (error) {
    console.error("Error deleting track:", error);
    throw error;
  }
};

// Get available instruments
export const getInstruments = async () => {
  try {
    const res = await api.get("/projects/instruments");
    return res.data;
  } catch (error) {
    console.error("Error fetching instruments:", error);
    // Provide more specific error message
    const errorMessage = error?.response?.data?.message || error?.message || "Failed to fetch instruments";
    throw new Error(errorMessage);
  }
};

// Get rhythm patterns
export const getRhythmPatterns = async () => {
  try {
    const res = await api.get("/projects/rhythm-patterns");
    return res.data;
  } catch (error) {
    console.error("Error fetching rhythm patterns:", error);
    throw error;
  }
};

// Apply rhythm pattern to timeline item
export const applyRhythmPattern = async (projectId, itemId, rhythmPatternId) => {
  try {
    const res = await api.put(
      `/projects/${projectId}/timeline/items/${itemId}/apply-pattern`,
      { rhythmPatternId }
    );
    return res.data;
  } catch (error) {
    console.error("Error applying rhythm pattern:", error);
    throw error;
  }
};

// Generate backing track from chord progression
export const generateBackingTrack = async (projectId, data) => {
  try {
    const res = await api.post(`/projects/${projectId}/generate-backing`, data);
    return res.data;
  } catch (error) {
    console.error("Error generating backing track:", error);
    throw error;
  }
};

// Generate AI backing track with Suno
export const generateAIBackingTrack = async (projectId, data) => {
  try {
    const res = await api.post(`/projects/${projectId}/generate-ai-backing`, data);
    return res.data;
  } catch (error) {
    console.error("Error generating AI backing track:", error);
    throw error;
  }
};

