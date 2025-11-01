import mongoose from "mongoose";
import Lick from "../models/Lick.js";
import User from "../models/User.js";
import LickLike from "../models/LickLike.js";
import LickComment from "../models/LickComment.js";
import LickTag from "../models/LickTag.js";
import Tag from "../models/Tag.js";
import { uploadFromBuffer } from "../utils/cloudinaryUploader.js";
import {
  extractWaveformFromUrl,
  extractWaveformFromBuffer,
} from "../utils/waveformExtractor.js";
import { generateTabFromAudio } from "../utils/basicPitchService.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get community licks with search, filter, sort, and pagination
export const getCommunityLicks = async (req, res) => {
  try {
    const { search, tags, sortBy = "newest", page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // --- 1. Build $match stage ---
    const matchStage = { isPublic: true };

    // Use text index for search (much faster than $regex)
    if (search) {
      matchStage.$text = { $search: search };
    }

    // --- 2. Build Sort stage ---
    let sortStage = {};
    switch (sortBy) {
      case "popular":
        // Sort by likes count (calculated in aggregation)
        sortStage = { likesCount: -1, createdAt: -1 };
        break;
      case "newest":
      default:
        sortStage = { createdAt: -1 };
    }

    // --- 3. Build Aggregation Pipeline ---
    let pipeline = [{ $match: matchStage }];

    // Add Tag Filtering (if tags are specified)
    if (tags) {
      const tagNames = tags.split(",").map((tag) => tag.trim());
      pipeline.push(
        {
          $lookup: {
            from: "licktags",
            localField: "_id",
            foreignField: "lickId",
            as: "lickTagsJoin",
          },
        },
        {
          $lookup: {
            from: "tags",
            localField: "lickTagsJoin.tagId",
            foreignField: "_id",
            as: "tagsJoin",
          },
        },
        {
          $match: { "tagsJoin.tagName": { $in: tagNames } },
        }
      );
    }

    // --- 4. Add remaining lookups & formatting ---
    pipeline.push(
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "creator",
        },
      },
      {
        $lookup: {
          from: "licklikes",
          localField: "_id",
          foreignField: "lickId",
          as: "likes",
        },
      }
    );

    // Only add tag lookups if not already added by filter
    if (!tags) {
      pipeline.push(
        {
          $lookup: {
            from: "licktags",
            localField: "_id",
            foreignField: "lickId",
            as: "lickTags",
          },
        },
        {
          $lookup: {
            from: "tags",
            localField: "lickTags.tagId",
            foreignField: "_id",
            as: "tags",
          },
        }
      );
    }

    pipeline.push(
      {
        $addFields: {
          likesCount: { $size: "$likes" },
          creator: { $arrayElemAt: ["$creator", 0] },
          // Use tagsJoin if filtering by tags, otherwise use tags
          tags: tags ? "$tagsJoin" : "$tags",
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          audioUrl: 1,
          waveformData: 1,
          duration: 1,
          tabNotation: 1,
          key: 1,
          tempo: 1,
          difficulty: 1,
          isFeatured: 1,
          createdAt: 1,
          updatedAt: 1,
          creator: {
            _id: 1,
            username: 1,
            displayName: 1,
            avatarUrl: 1,
          },
          tags: {
            _id: 1,
            tagName: 1,
            tagType: 1,
          },
          likesCount: 1,
        },
      }
    );

    // --- 5. Use $facet to get Data AND Total Count in ONE query ---
    const results = await Lick.aggregate([
      ...pipeline,
      {
        $facet: {
          // Branch 1: Get the paginated data
          licks: [{ $sort: sortStage }, { $skip: skip }, { $limit: limitNum }],
          // Branch 2: Get the total count
          totalCount: [{ $count: "count" }],
        },
      },
    ]);

    const licks = results[0].licks;
    const totalLicks = results[0].totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalLicks / limitNum);

    // --- 6. Format and Send Response ---
    const formattedLicks = licks.map((lick) => ({
      lick_id: lick._id,
      title: lick.title,
      description: lick.description,
      audio_url: lick.audioUrl,
      waveform_data: lick.waveformData,
      duration: lick.duration,
      tab_notation: lick.tabNotation,
      key: lick.key,
      tempo: lick.tempo,
      difficulty: lick.difficulty,
      is_featured: lick.isFeatured,
      creator: {
        user_id: lick.creator?._id,
        display_name: lick.creator?.displayName,
        avatar_url: lick.creator?.avatarUrl,
      },
      tags: (lick.tags || []).map((tag) => ({
        tag_id: tag._id,
        tag_name: tag.tagName,
        tag_type: tag.tagType,
      })),
      likes_count: lick.likesCount,
      created_at: lick.createdAt,
      updated_at: lick.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedLicks,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalItems: totalLicks,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching community licks:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// UC-12: Get user's own licks (My Licks) with search, filter, and status
export const getMyLicks = async (req, res) => {
  try {
    const { userId } = req.params; // or req.user.id from auth middleware
    const {
      search,
      tags,
      status,
      sortBy = "newest",
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build base query - only licks created by this user
    let query = { userId: new mongoose.Types.ObjectId(userId) };

    // Apply search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Apply status filter (draft, active, inactive)
    if (status) {
      query.status = status;
    }

    // Apply tag filter
    let tagFilter = {};
    if (tags) {
      const tagNames = tags.split(",").map((tag) => tag.trim());

      // Find tag IDs by tag names
      const tagDocs = await Tag.find({
        tagName: { $in: tagNames },
      }).select("_id");

      if (tagDocs.length > 0) {
        const tagIds = tagDocs.map((tag) => tag._id);

        // Find lick IDs that have these tags
        const lickTagDocs = await LickTag.find({
          tagId: { $in: tagIds },
        }).select("lickId");

        if (lickTagDocs.length > 0) {
          const lickIds = lickTagDocs.map((doc) => doc.lickId);
          tagFilter = { _id: { $in: lickIds } };
        } else {
          // No licks found with these tags
          tagFilter = { _id: { $in: [] } };
        }
      } else {
        // No tags found with these names
        tagFilter = { _id: { $in: [] } };
      }
    }

    // Combine base query with tag filter
    const finalQuery = { ...query, ...tagFilter };

    // Build sort criteria
    let sortCriteria = {};
    switch (sortBy) {
      case "newest":
        sortCriteria = { createdAt: -1 };
        break;
      case "popular":
        // For popular, we'll sort by likes count (we'll calculate this in aggregation)
        sortCriteria = { createdAt: -1 }; // Fallback to newest
        break;
      case "trending":
        // For trending, we'll sort by recent likes/comments (we'll calculate this in aggregation)
        sortCriteria = { createdAt: -1 }; // Fallback to newest
        break;
      default:
        sortCriteria = { createdAt: -1 };
    }

    // Get licks with aggregation to include like and comment counts
    const licks = await Lick.aggregate([
      { $match: finalQuery },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "creator",
        },
      },
      {
        $lookup: {
          from: "licklikes",
          localField: "_id",
          foreignField: "lickId",
          as: "likes",
        },
      },
      {
        $lookup: {
          from: "lickcomments",
          localField: "_id",
          foreignField: "lickId",
          as: "comments",
        },
      },
      {
        $lookup: {
          from: "licktags",
          localField: "_id",
          foreignField: "lickId",
          as: "lickTags",
        },
      },
      {
        $lookup: {
          from: "tags",
          localField: "lickTags.tagId",
          foreignField: "_id",
          as: "tags",
        },
      },
      {
        $addFields: {
          likesCount: { $size: "$likes" },
          commentsCount: { $size: "$comments" },
          creator: { $arrayElemAt: ["$creator", 0] },
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          audioUrl: 1,
          waveformData: 1,
          duration: 1,
          tabNotation: 1,
          key: 1,
          tempo: 1,
          difficulty: 1,
          status: 1, // Include status for My Licks
          isPublic: 1, // Include isPublic status
          isFeatured: 1,
          createdAt: 1,
          updatedAt: 1,
          creator: {
            _id: 1,
            username: 1,
            displayName: 1,
            avatarUrl: 1,
          },
          tags: {
            _id: 1,
            tagName: 1,
            tagType: 1,
          },
          likesCount: 1,
          commentsCount: 1,
        },
      },
      { $sort: { createdAt: -1 } }, // Sort by newest first
      { $skip: skip },
      { $limit: limitNum },
    ]);

    // Get total count for pagination
    const totalLicks = await Lick.countDocuments(finalQuery);
    const totalPages = Math.ceil(totalLicks / limitNum);

    // Format response
    const formattedLicks = licks.map((lick) => ({
      lick_id: lick._id,
      title: lick.title,
      description: lick.description,
      audio_url: lick.audioUrl,
      waveform_data: lick.waveformData,
      duration: lick.duration,
      tab_notation: lick.tabNotation,
      key: lick.key,
      tempo: lick.tempo,
      difficulty: lick.difficulty,
      status: lick.status, // draft, active, inactive
      is_public: lick.isPublic,
      is_featured: lick.isFeatured,
      creator: {
        user_id: lick.creator?._id,
        display_name: lick.creator?.displayName,
        avatar_url: lick.creator?.avatarUrl,
      },
      tags: (lick.tags || []).map((tag) => ({
        tag_id: tag._id,
        tag_name: tag.tagName,
        tag_type: tag.tagType,
      })),
      likes_count: lick.likesCount,
      comments_count: lick.commentsCount,
      created_at: lick.createdAt,
      updated_at: lick.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedLicks,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalItems: totalLicks,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching user's licks:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get lick by ID with full details
export const getLickById = async (req, res) => {
  try {
    const { lickId } = req.params;

    const lick = await Lick.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(lickId), isPublic: true } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "creator",
        },
      },
      {
        $lookup: {
          from: "licklikes",
          localField: "_id",
          foreignField: "lickId",
          as: "likes",
        },
      },
      {
        $lookup: {
          from: "lickcomments",
          localField: "_id",
          foreignField: "lickId",
          as: "comments",
        },
      },
      {
        $lookup: {
          from: "licktags",
          localField: "_id",
          foreignField: "lickId",
          as: "lickTags",
        },
      },
      {
        $lookup: {
          from: "tags",
          localField: "lickTags.tagId",
          foreignField: "_id",
          as: "tags",
        },
      },
      {
        $addFields: {
          likesCount: { $size: "$likes" },
          commentsCount: { $size: "$comments" },
          creator: { $arrayElemAt: ["$creator", 0] },
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          audioUrl: 1,
          waveformData: 1,
          duration: 1,
          tabNotation: 1,
          key: 1,
          tempo: 1,
          difficulty: 1,
          isFeatured: 1,
          createdAt: 1,
          updatedAt: 1,
          creator: {
            _id: 1,
            username: 1,
            displayName: 1,
            avatarUrl: 1,
          },
          tags: {
            _id: 1,
            tagName: 1,
            tagType: 1,
          },
          likesCount: 1,
          commentsCount: 1,
        },
      },
    ]);

    if (!lick || lick.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lick not found",
      });
    }

    // Waveform data is already extracted during upload, just use it from database
    const waveformData = lick[0].waveformData || [];

    // Format creator data, handle case where user doesn't exist
    let creatorData = null;
    if (lick[0].creator && lick[0].creator._id) {
      creatorData = {
        user_id: lick[0].creator._id,
        display_name: lick[0].creator.displayName || "Unknown User",
        avatar_url: lick[0].creator.avatarUrl || null,
      };
    }

    const formattedLick = {
      lick_id: lick[0]._id,
      title: lick[0].title,
      description: lick[0].description,
      audio_url: lick[0].audioUrl,
      waveform_data: waveformData,
      duration: lick[0].duration,
      tab_notation: lick[0].tabNotation,
      key: lick[0].key,
      tempo: lick[0].tempo,
      difficulty: lick[0].difficulty,
      is_featured: lick[0].isFeatured,
      creator: creatorData,
      tags: lick[0].tags.map((tag) => ({
        tag_id: tag._id,
        tag_name: tag.tagName,
        tag_type: tag.tagType,
      })),
      likes_count: lick[0].likesCount,
      comments_count: lick[0].commentsCount,
      created_at: lick[0].createdAt,
      updated_at: lick[0].updatedAt,
    };

    res.status(200).json({
      success: true,
      data: formattedLick,
    });
  } catch (error) {
    console.error("Error fetching lick:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Like/Unlike a lick
export const toggleLickLike = async (req, res) => {
  try {
    const { lickId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    // Check if lick exists and is public
    const lick = await Lick.findOne({ _id: lickId, isPublic: true });
    if (!lick) {
      return res.status(404).json({
        success: false,
        message: "Lick not found",
      });
    }

    // Check if user already liked this lick
    const existingLike = await LickLike.findOne({ lickId, userId });

    if (existingLike) {
      // Unlike - remove the like
      await LickLike.findByIdAndDelete(existingLike._id);

      res.status(200).json({
        success: true,
        message: "Lick unliked successfully",
        data: { liked: false },
      });
    } else {
      // Like - create new like
      const newLike = new LickLike({ lickId, userId });
      await newLike.save();

      res.status(200).json({
        success: true,
        message: "Lick liked successfully",
        data: { liked: true },
      });
    }
  } catch (error) {
    console.error("Error toggling lick like:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Play Lick Audio - Stream audio or redirect to Cloudinary URL
export const playLickAudio = async (req, res) => {
  try {
    const { lickId } = req.params;
    const { userId } = req.query; // Optional: for tracking plays per user

    // Find the lick
    const lick = await Lick.findById(lickId);

    if (!lick) {
      return res.status(404).json({
        success: false,
        message: "Lick not found",
      });
    }

    // Check if lick is public or if user is the owner
    if (!lick.isPublic && lick.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to play this lick",
      });
    }

    // TODO: Track play count (optional)
    // You can create a LickPlay model to track plays for analytics
    // const play = new LickPlay({ lickId, userId, playedAt: new Date() });
    // await play.save();

    // Return the audio URL with CORS headers for streaming
    res.status(200).json({
      success: true,
      data: {
        audio_url: lick.audioUrl,
        title: lick.title,
        duration: lick.duration,
        lick_id: lick._id,
      },
      message: "Audio URL retrieved successfully",
    });
  } catch (error) {
    console.error("Error playing lick audio:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete a lick and its related data
export const deleteLick = async (req, res) => {
  try {
    const { lickId } = req.params;

    const lick = await Lick.findById(lickId);
    if (!lick) {
      return res.status(404).json({
        success: false,
        message: "Lick not found",
      });
    }

    // Remove related records
    await Promise.all([
      LickLike.deleteMany({ lickId }),
      LickComment.deleteMany({ lickId }),
      LickTag.deleteMany({ lickId }),
    ]);

    await Lick.findByIdAndDelete(lickId);

    return res.status(200).json({
      success: true,
      message: "Lick deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting lick:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Create a lick
export const createLick = async (req, res) => {
  try {
    console.log("[CREATE LICK] Request received");
    console.log("[CREATE LICK] Body:", req.body);
    console.log("[CREATE LICK] File:", req.file ? "Present" : "Missing");

    // 1. Check if a file was uploaded by multer
    // With .single('audio'), file is in req.file
    const audioFile = req.file;

    if (!audioFile) {
      console.error("[CREATE LICK] No audio file in request");
      return res
        .status(400)
        .json({ success: false, message: "No audio file uploaded." });
    }

    console.log(
      `[CREATE LICK] Processing audio file: ${audioFile.originalname}`
    );
    console.log(`[CREATE LICK] File size: ${audioFile.size} bytes`);

    // 2. Get text data from the form body
    const {
      userId,
      title,
      description,
      tabNotation,
      key,
      tempo,
      difficulty,
      isPublic,
      status,
      isFeatured,
    } = req.body;
    // const userId = req.user.id; // Get this from your auth middleware

    // 3. Upload the audio file to Cloudinary
    // IMPORTANT: Use 'video' as the resource_type for audio files
    const audioResult = await uploadFromBuffer(
      audioFile.buffer,
      "licks_audio", // This will create a folder named 'licks_audio' in Cloudinary
      "video"
    );

    // 3.5. Extract waveform data from the audio buffer
    let waveformData = [];
    try {
      waveformData = await extractWaveformFromBuffer(audioFile.buffer, 200);
      console.log(
        "Waveform extracted successfully:",
        waveformData.length,
        "samples"
      );
    } catch (waveformError) {
      console.error("Error extracting waveform during upload:", waveformError);
      // Continue without waveform data if extraction fails
    }

    // 4. Create the new Lick in your database
    const newLick = new Lick({
      userId: userId || req.user?.id, // Get from body or auth middleware
      title,
      description,
      audioUrl: audioResult.secure_url, // URL from Cloudinary
      duration: audioResult.duration, // Cloudinary provides duration
      waveformData: waveformData, // Generated from audio file
      tabNotation,
      key,
      tempo,
      difficulty,
      status: status || "draft", // Default to 'draft' if not provided
      isPublic: isPublic === "true", // Convert from string
      isFeatured: isFeatured === "true" || false, // Convert from string, default to false
    });

    await newLick.save();

    console.log("[CREATE LICK] Lick saved successfully:", newLick._id);

    res.status(201).json({
      success: true,
      message: "Lick created successfully!",
      data: newLick,
    });
  } catch (error) {
    console.error("[CREATE LICK] Error:", error.message);
    console.error("[CREATE LICK] Stack:", error.stack);

    res.status(500).json({
      success: false,
      message: "Failed to create lick",
      error: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// Update a lick
export const updateLick = async (req, res) => {
  try {
    const { lickId } = req.params;

    const allowedFields = [
      "title",
      "description",
      "tabNotation",
      "key",
      "tempo",
      "difficulty",
      "status",
      "isPublic",
      "isFeatured",
    ];

    const update = {};
    for (const field of allowedFields) {
      if (field in req.body) {
        update[field] = req.body[field];
      }
    }

    // Normalize booleans if sent as strings
    if ("isPublic" in update && typeof update.isPublic === "string") {
      update.isPublic = update.isPublic === "true";
    }
    if ("isFeatured" in update && typeof update.isFeatured === "string") {
      update.isFeatured = update.isFeatured === "true";
    }

    const updated = await Lick.findByIdAndUpdate(lickId, update, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Lick not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Lick updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating lick:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Generate guitar tab from audio using Basic-Pitch AI
 * POST /api/licks/generate-tab
 */
export const generateTab = async (req, res) => {
  let tempFilePath = null;

  try {
    console.log("[GENERATE-TAB] Request received");

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No audio file uploaded",
      });
    }

    // Save uploaded file temporarily
    const tempDir = path.join(__dirname, "../../temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    tempFilePath = path.join(tempDir, `${Date.now()}_${req.file.originalname}`);
    fs.writeFileSync(tempFilePath, req.file.buffer);

    console.log("[GENERATE-TAB] Processing audio file:", tempFilePath);

    // Generate tab using Basic-Pitch
    const tabData = await generateTabFromAudio(tempFilePath);

    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    console.log("[GENERATE-TAB] Tab generated successfully");

    res.json({
      success: true,
      data: tabData,
    });
  } catch (error) {
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    console.error("[GENERATE-TAB] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate tab",
      error: error.message,
    });
  }
};

// Get comments for a lick with pagination
export const getLickComments = async (req, res) => {
  try {
    const { lickId } = req.params;
    const page = parseInt(req.query.page ?? 1);
    const limit = parseInt(req.query.limit ?? 10);
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      LickComment.find({ lickId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LickComment.countDocuments({ lickId }),
    ]);

    res.status(200).json({
      success: true,
      data: comments.map((c) => ({
        comment_id: c._id,
        lick_id: c.lickId,
        user_id: c.userId,
        comment: c.comment,
        parent_comment_id: c.parentCommentId,
        timestamp: c.timestamp ?? 0,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNextPage: skip + comments.length < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching lick comments:", error);
    res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

// Add a comment to a lick
export const addLickComment = async (req, res) => {
  try {
    const { lickId } = req.params;
    const { userId, comment, parentCommentId, timestamp } = req.body;

    if (!userId || !comment) {
      return res.status(400).json({ success: false, message: "userId and comment are required" });
    }

    const lick = await Lick.findById(lickId);
    if (!lick) {
      return res.status(404).json({ success: false, message: "Lick not found" });
    }

    const newComment = new LickComment({
      lickId,
      userId,
      comment,
      parentCommentId: parentCommentId || null,
      timestamp: typeof timestamp === "number" ? timestamp : 0,
    });
    await newComment.save();

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: {
        comment_id: newComment._id,
        lick_id: newComment.lickId,
        user_id: newComment.userId,
        comment: newComment.comment,
        parent_comment_id: newComment.parentCommentId,
        timestamp: newComment.timestamp,
        created_at: newComment.createdAt,
        updated_at: newComment.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error adding lick comment:", error);
    res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};
