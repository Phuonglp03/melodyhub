import express from "express";
import {
  createBandSettings,
  getBandSettingsById,
  getUserBandSettings,
  getPublicBandSettings,
  updateBandSettings,
  deleteBandSettings,
} from "../controllers/bandSettingsController.js";
import middlewareController from "../middleware/auth.js";
const { verifyToken } = middlewareController;

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Create new band settings
router.post("/", createBandSettings);

// Get all user's band settings (includes public and default)
router.get("/", getUserBandSettings);

// Get public band settings
router.get("/public", getPublicBandSettings);

// Get band settings by ID
router.get("/:id", getBandSettingsById);

// Update band settings
router.patch("/:id", updateBandSettings);

// Delete band settings
router.delete("/:id", deleteBandSettings);

export default router;

