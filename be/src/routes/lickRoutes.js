import express from "express";
import {
  getCommunityLicks,
  getMyLicks,
  getLickById,
  toggleLickLike,
  createLick,
  playLickAudio,
  generateTab,
  // getLickComments,
  // addLickComment,
} from "../controllers/lickController.js";
import { uploadAudio } from "../middleware/file.js";

const jsonParser = express.json({ limit: "2mb" });

console.log("[LICK ROUTES] Loading lick routes...");
console.log("[LICK ROUTES] createLick function:", typeof createLick);
console.log("[LICK ROUTES] uploadAudio middleware:", typeof uploadAudio);

const router = express.Router();

// GET /api/licks/community - Get community licks with search, filter, sort, and pagination
router.get("/community", getCommunityLicks);

// GET /api/licks/user/:userId - Get user's own licks (My Licks) with search, filter, and status
router.get("/user/:userId", getMyLicks);

// POST /api/licks - Create a new lick (with audio file upload)
// IMPORTANT: This route must come BEFORE /:lickId routes
router.post("/", uploadAudio, createLick);

// POST /api/licks/generate-tab - Generate guitar tab from audio using AI
// IMPORTANT: Must come BEFORE /:lickId routes to avoid being caught by them
router.post("/generate-tab", uploadAudio, generateTab);

// GET /api/licks/:lickId/play - Play/stream lick audio
router.get("/:lickId/play", playLickAudio);

// GET /api/licks/:lickId - Get lick by ID with full details
router.get("/:lickId", getLickById);

// POST /api/licks/:lickId/like - Like/Unlike a lick
router.post("/:lickId/like", jsonParser, toggleLickLike);

console.log("[LICK ROUTES] All routes registered successfully");

export default router;
