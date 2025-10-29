/**
 * Basic-Pitch Tab Generation Service (Frontend)
 * Calls backend API for ML-powered tab generation
 */

import axios from "axios";
import { generateTabFromAudio as generateWithYIN } from "./aiTabGenerator";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

/**
 * Check if Basic-Pitch API is available
 */
export const isBasicPitchAvailable = async () => {
  try {
    // Could add a health check endpoint later
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Get Basic-Pitch status
 */
export const getBasicPitchStatus = () => {
  return {
    available: true,
    status: "ready",
    algorithm: "Basic-Pitch ML (Backend API)",
    description: "ML-powered pitch detection via backend service",
  };
};

/**
 * Pre-load (no-op for backend API)
 */
export const preloadBasicPitch = async () => {
  console.log("[TAB-GEN] Backend API ready!");
  return true;
};

/**
 * Generate guitar tab from audio using backend API
 */
export const generateTabWithML = async (audioFile, options = {}) => {
  try {
    console.log("[TAB-GEN] Uploading audio to backend for ML processing...");

    // Create form data
    const formData = new FormData();
    formData.append("audio", audioFile);

    // Call backend API
    const response = await axios.post(
      `${API_BASE_URL}/api/licks/generate-tab`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 30000, // 30 second timeout
      }
    );

    console.log("[TAB-GEN] ✅ Backend processing complete!", response.data);

    return response.data.data;
  } catch (error) {
    console.error("[TAB-GEN] Backend API failed:", error);

    // Fallback to YIN algorithm if backend fails
    console.log("[TAB-GEN] Falling back to YIN algorithm...");

    try {
      const result = await generateWithYIN(audioFile, options);

      return {
        ...result,
        metadata: {
          ...result.metadata,
          method: "yin-algorithm-fallback",
          mlUsed: false,
          mlAttempted: true,
          mlError: error.response?.data?.message || error.message,
          algorithm: "YIN Algorithm (Fallback)",
        },
      };
    } catch (yinError) {
      console.error("[TAB-GEN] YIN fallback also failed:", yinError);
      throw new Error("Both ML and YIN tab generation failed");
    }
  }
};

export default {
  generateTabWithML,
  isBasicPitchAvailable,
  getBasicPitchStatus,
  preloadBasicPitch,
};
