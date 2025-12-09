import api from "../api";

// Create new band settings
export const createBandSettings = async (bandSettingsData) => {
  try {
    const res = await api.post("/band-settings", bandSettingsData);
    return res.data;
  } catch (error) {
    console.error("Error creating band settings:", error);
    throw error;
  }
};

// Get band settings by ID
export const getBandSettingsById = async (id) => {
  try {
    const res = await api.get(`/band-settings/${id}`);
    return res.data;
  } catch (error) {
    console.error("Error fetching band settings:", error);
    throw error;
  }
};

// Get all user's band settings (includes public and default)
export const getUserBandSettings = async () => {
  try {
    const res = await api.get("/band-settings");
    return res.data;
  } catch (error) {
    console.error("Error fetching user band settings:", error);
    throw error;
  }
};

// Get public band settings
export const getPublicBandSettings = async () => {
  try {
    const res = await api.get("/band-settings/public");
    return res.data;
  } catch (error) {
    console.error("Error fetching public band settings:", error);
    throw error;
  }
};

// Update band settings
export const updateBandSettings = async (id, bandSettingsData) => {
  try {
    const res = await api.patch(`/band-settings/${id}`, bandSettingsData);
    return res.data;
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      "Failed to update band settings";
    console.error("Error updating band settings:", error?.response || error);
    throw new Error(message);
  }
};

// Delete band settings
export const deleteBandSettings = async (id) => {
  try {
    const res = await api.delete(`/band-settings/${id}`);
    return res.data;
  } catch (error) {
    console.error("Error deleting band settings:", error);
    throw error;
  }
};

