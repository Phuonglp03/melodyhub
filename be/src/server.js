import "dotenv/config";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import "express-async-errors";
import path from "path";
import { fileURLToPath } from "url";

import { connectToDatabase } from "./config/db.js";
import { corsMiddleware } from "./config/cors.js";
import "./config/cloudinary.js"; // Initialize Cloudinary configuration

// Import all models to ensure they are registered with Mongoose
import "./models/User.js";
import "./models/Role.js";
import "./models/Chord.js";
import "./models/ContentReport.js";
import "./models/ContentTag.js";
import "./models/Instrument.js";
import "./models/Lick.js";
import "./models/LickComment.js";
import "./models/LickLike.js";
import "./models/LickTag.js";
import "./models/LiveRoom.js";
import "./models/Notification.js";
import "./models/PlayingPattern.js";
import "./models/Playlist.js";
import "./models/PlaylistLick.js";
import "./models/Post.js";
import "./models/PostComment.js";
import "./models/PostLike.js";
import "./models/Project.js";
import "./models/ProjectCollaborator.js";
import "./models/ProjectComment.js";
import "./models/ProjectLike.js";
import "./models/ProjectTimelineItem.js";
import "./models/ProjectTrack.js";
import "./models/RoomChat.js";
import "./models/Tag.js";
import "./models/UserFollow.js";

// Import routes
// import authRoutes from './routes/authRoutes.js';
import postRoutes from "./routes/postRoutes.js";
import lickRoutes from "./routes/lickRoutes.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  })
);
app.use(corsMiddleware());
app.use(morgan("dev"));
// Add urlencoded parser for form-data (needed for multer to work properly)
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const uploadDir = process.env.UPLOAD_DIR || "uploads";
app.use("/static", express.static(path.join(__dirname, "..", uploadDir)));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "melodyhub-be",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
// app.use('/api/auth', authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/licks", lickRoutes);

const port = Number(process.env.PORT) || 9999;

async function start() {
  await connectToDatabase();
  app.listen(port, () => {
    console.log(`melodyhub-be listening on port ${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
