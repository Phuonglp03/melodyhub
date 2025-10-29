import multer from "multer";

// Configure multer to store files in memory (as buffers)
// This is suitable for uploading directly to Cloudinary
const storage = multer.memoryStorage();

// Create multer instance with file size limit
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Log detected MIME type for debugging
    console.log(
      `[FILE FILTER] File: ${file.originalname}, MIME type: ${file.mimetype}`
    );

    // Accept audio files (expanded list to handle various MIME type variations)
    const allowedMimes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/mpeg3",
      "audio/x-mpeg-3",
      "audio/wav",
      "audio/x-wav",
      "audio/wave",
      "audio/vnd.wave",
      "audio/mp4",
      "audio/x-m4a",
      "audio/m4a",
      "audio/ogg",
      "audio/webm",
      "application/octet-stream", // Some systems use this for WAV
    ];

    if (allowedMimes.includes(file.mimetype)) {
      console.log(`[FILE FILTER] File accepted: ${file.originalname}`);
      cb(null, true);
    } else {
      console.log(
        `[FILE FILTER] File rejected: ${file.originalname} (MIME: ${file.mimetype})`
      );
      cb(
        new Error(
          `Invalid file type: ${file.mimetype}. Only audio files (mp3, wav, m4a, ogg, webm) are allowed.`
        ),
        false
      );
    }
  },
});

// Helper to parse multipart without multer (for testing)
function parseMultipart(req, res, next) {
  // If multer already parsed it, skip
  if (req.files || req.file) {
    return next();
  }

  // Set empty files array for requests without files
  req.files = [];
  next();
}

// Export middleware for single file upload with error handling
export const uploadAudio = (req, res, next) => {
  // Use .single('audio') to accept the specific 'audio' field
  upload.single("audio")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum size is 10MB.",
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    } else if (err) {
      console.log("[UPLOAD] Multer error:", err.message);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    // Log successful file upload
    if (req.file) {
      console.log(
        `[UPLOAD] File received: ${req.file.originalname} (${req.file.size} bytes)`
      );
    } else {
      console.log("[UPLOAD] No file received in request");
    }

    next();
  });
};
