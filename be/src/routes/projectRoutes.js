import express from "express";
import { body, validationResult } from "express-validator";
import {
  createProject,
  getUserProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addLickToTimeline,
  updateTimelineItem,
  deleteTimelineItem,
  updateChordProgression,
  addTrack,
  updateTrack,
  deleteTrack,
} from "../controllers/projectController.js";
import middlewareController from "../middleware/auth.js";
const { verifyToken } = middlewareController;

const router = express.Router();

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

// All routes require authentication
router.use(verifyToken);

// Project CRUD routes
router.post(
  "/",
  [
    body("title")
      .trim()
      .notEmpty()
      .withMessage("Project title is required")
      .isLength({ min: 1, max: 200 })
      .withMessage("Title must be between 1 and 200 characters"),
    body("description").optional().isLength({ max: 1000 }),
    body("tempo").optional().isInt({ min: 20, max: 300 }),
    body("timeSignature").optional().matches(/^\d+\/\d+$/),
  ],
  validate,
  createProject
);

router.get("/", getUserProjects);

router.get("/:projectId", getProjectById);

router.put(
  "/:projectId",
  [
    body("title").optional().trim().isLength({ min: 1, max: 200 }),
    body("description").optional().isLength({ max: 1000 }),
    body("tempo").optional().isInt({ min: 20, max: 300 }),
    body("timeSignature").optional().matches(/^\d+\/\d+$/),
    body("status").optional().isIn(["draft", "active", "completed", "inactive"]),
  ],
  validate,
  updateProject
);

router.delete("/:projectId", deleteProject);

// Timeline operations
router.post(
  "/:projectId/timeline/items",
  [
    body("trackId").notEmpty().withMessage("trackId is required"),
    body("lickId").notEmpty().withMessage("lickId is required"),
    body("startTime").isNumeric().withMessage("startTime must be a number"),
    body("duration").isNumeric().withMessage("duration must be a number"),
  ],
  validate,
  addLickToTimeline
);

router.put(
  "/:projectId/timeline/items/:itemId",
  [
    body("startTime").optional().isNumeric(),
    body("duration").optional().isNumeric(),
    body("trackId").optional().notEmpty(),
  ],
  validate,
  updateTimelineItem
);

router.delete("/:projectId/timeline/items/:itemId", deleteTimelineItem);

// Chord progression
router.put(
  "/:projectId/chords",
  [
    body("chordProgression")
      .isArray()
      .withMessage("chordProgression must be an array"),
  ],
  validate,
  updateChordProgression
);

// Track operations
router.post(
  "/:projectId/tracks",
  [
    body("trackName").optional().trim().isLength({ min: 1, max: 100 }),
  ],
  validate,
  addTrack
);

router.put(
  "/:projectId/tracks/:trackId",
  [
    body("trackName").optional().trim().isLength({ min: 1, max: 100 }),
    body("volume").optional().isFloat({ min: 0, max: 1 }),
    body("pan").optional().isFloat({ min: -1, max: 1 }),
    body("muted").optional().isBoolean(),
    body("solo").optional().isBoolean(),
    body("trackOrder").optional().isInt({ min: 0 }),
  ],
  validate,
  updateTrack
);

router.delete("/:projectId/tracks/:trackId", deleteTrack);

export default router;

