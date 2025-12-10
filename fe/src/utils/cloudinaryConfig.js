// Cloudinary Configuration
export const CLOUDINARY_CONFIG = {
  cloud_name: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "dsrahn5bg",
  api_key: process.env.REACT_APP_CLOUDINARY_API_KEY || "343778731864161",
  api_secret:
    process.env.REACT_APP_CLOUDINARY_API_SECRET ||
    "a2ZgkZUy9UgSGXEaqmm2GLEmNdU",
  secure: true,
};

// Cloudinary upload preset (cần tạo trên Cloudinary Dashboard)
export const UPLOAD_PRESETS = {
  AUDIO: "melodyhub_audio", // Preset cho audio files
  IMAGE: "melodyhub_images", // Preset cho images
  AVATAR: "melodyhub_avatars", // Preset cho user avatars
  PLAYLIST_COVER: "melodyhub_playlists", // Preset cho playlist covers
};

// Helper function to get Cloudinary URL
export const getCloudinaryUrl = (publicId, options = {}) => {
  const {
    width,
    height,
    crop = "fill",
    quality = "auto",
    format = "auto",
    ...otherOptions
  } = options;

  let url = `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloud_name}/image/upload`;

  if (width || height || crop || quality || format) {
    const transformations = [];
    if (width) transformations.push(`w_${width}`);
    if (height) transformations.push(`h_${height}`);
    if (crop) transformations.push(`c_${crop}`);
    if (quality) transformations.push(`q_${quality}`);
    if (format) transformations.push(`f_${format}`);

    // Add other transformations
    Object.entries(otherOptions).forEach(([key, value]) => {
      transformations.push(`${key}_${value}`);
    });

    url += `/${transformations.join(",")}`;
  }

  url += `/${publicId}`;
  return url;
};

// Helper function to get audio URL
export const getCloudinaryAudioUrl = (publicId) => {
  return `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloud_name}/video/upload/${publicId}`;
};

