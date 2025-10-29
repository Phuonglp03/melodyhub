import multer from "multer";
import {
  uploadAudio as cloudinaryUploadAudio, // Renamed to avoid conflict
  uploadImage as cloudinaryUploadImage, // Renamed to avoid conflict
  uploadPostMedia,
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../config/cloudinary.js"; // Assuming these are pre-configured Multer instances

// --- Middleware Definitions ---

// Middleware to handle single audio upload using the Cloudinary-configured instance
export const handleAudioUpload = cloudinaryUploadAudio.single("audio");

// Middleware to handle single image upload using the Cloudinary-configured instance
export const handleImageUpload = cloudinaryUploadImage.single("image");

// Middleware to handle multiple audio uploads
export const handleMultipleAudioUpload = cloudinaryUploadAudio.array(
  "audios",
  5
); // Max 5 audio files

// Middleware to handle multiple image uploads
export const handleMultipleImageUpload = cloudinaryUploadImage.array(
  "images",
  10
); // Max 10 image files

// Middleware to handle mixed uploads (e.g., one audio, one image)
// NOTE: This assumes 'cloudinaryUploadAudio' and 'cloudinaryUploadImage'
// have compatible base configurations (like storage). If not, a dedicated
// instance might be needed in cloudinary.js
export const handleMixedUpload = multer({
  storage: multer.memoryStorage(),
}).fields([
  // Using a generic memory storage instance here, but relying on filters
  // potentially defined within the cloudinary instances might be tricky.
  // It's often better to define a specific 'mixed' upload instance in cloudinary.js
  // For now, let's redefine the fields logic here based on your original files.
  // We'll use the imported instances to apply their specific filters/limits potentially.
  // This is slightly complex and might be better handled by a single dedicated instance in cloudinary.js
  { name: "audio", maxCount: 1 },
  { name: "image", maxCount: 1 },
  // If you need specific filters/limits per field type here, it gets complex
  // without a dedicated Multer setup for this route.
  // A simpler approach might be separate uploads or ensuring cloudinaryUploadAudio/Image
  // can somehow be combined or use a shared compatible config.
  // Let's defer to potentially separate instances for now as defined below.
  // Reverting to using the specific instances for fields:
  // This assumes your cloudinary.js setup allows using the instances like this,
  // which might not be standard Multer practice. Check your cloudinary.js config.
  // cloudinaryUploadAudio.single('audio'), // This doesn't work directly with .fields
  // cloudinaryUploadImage.single('image') // This doesn't work directly with .fields
]);
// TODO: Revisit handleMixedUpload. The most robust way is usually:
// 1. Define ONE multer instance in cloudinary.js specifically for mixed uploads
//    with memoryStorage and a fileFilter that checks mimetypes for both audio/image.
// 2. Import and use that instance here: `export const handleMixedUpload = cloudinaryUploadMixed.fields(...)`

// Middleware to handle post media uploads (multiple files, assumed configured in cloudinary.js)
export const handlePostMediaUpload = uploadPostMedia.array("media", 10); // Max 10 files

// --- Centralized Error Handling Middleware ---

// Generic error handling middleware specifically for Multer errors
// Place this *after* your route handlers that use the upload middleware in your Express app setup.
export const handleUploadError = (error, req, res, next) => {
  // Log the error for debugging
  // console.error("[Upload Error Middleware]", error);

  if (error instanceof multer.MulterError) {
    console.error("[Multer Error]", error.code, "-", error.message);
    if (error.code === "LIMIT_FILE_SIZE") {
      // Use a consistent size limit message if possible, or get from config
      return res.status(400).json({
        success: false,
        message: "File quá lớn. Vui lòng kiểm tra giới hạn kích thước.", // "File too large. Please check size limits."
      });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Quá nhiều file được upload cùng lúc.", // "Too many files uploaded at once."
      });
    }
    // Handle other potential Multer errors (LIMIT_FIELD_KEY, LIMIT_FIELD_VALUE, etc.)
    return res.status(400).json({
      success: false,
      message: `Lỗi upload file: ${error.message}`, // "File upload error:"
    });
  }

  // Handle custom file filter errors (based on message content)
  if (error && error.message.includes("Invalid file type")) {
    console.error("[File Filter Error]", error.message);
    return res.status(400).json({
      success: false,
      message: error.message, // Send the specific file type error
    });
  }

  // If it's not an error we specifically handle, pass it on
  next(error);
};

// --- Cloudinary Utility Exports ---

// Re-export Cloudinary utility functions for use elsewhere
export { deleteFromCloudinary, uploadToCloudinary };
