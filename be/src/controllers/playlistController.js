import mongoose from "mongoose";
import Playlist from "../models/Playlist.js";
import PlaylistLick from "../models/PlaylistLick.js";
import Lick from "../models/Lick.js";
import User from "../models/User.js";
import LickLike from "../models/LickLike.js";
import LickComment from "../models/LickComment.js";
import LickTag from "../models/LickTag.js";
import Tag from "../models/Tag.js";

// UC-15, Screen 29: Get user's playlists (My Playlists)
export const getMyPlaylists = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.params.userId;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Missing userId",
      });
    }

    const { search, isPublic, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    let query = { userId: new mongoose.Types.ObjectId(userId) };

    // Apply search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Apply isPublic filter
    if (isPublic !== undefined) {
      query.isPublic = isPublic === "true" || isPublic === true;
    }

    // Get playlists with lick counts
    const playlists = await Playlist.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "playlistlicks",
          localField: "_id",
          foreignField: "playlistId",
          as: "licks",
        },
      },
      {
        $addFields: {
          licksCount: { $size: "$licks" },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          coverImageUrl: 1,
          isPublic: 1,
          createdAt: 1,
          updatedAt: 1,
          licksCount: 1,
        },
      },
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: limitNum },
    ]);

    // Get total count for pagination
    const totalPlaylists = await Playlist.countDocuments(query);
    const totalPages = Math.ceil(totalPlaylists / limitNum);

    // Format response
    const formattedPlaylists = playlists.map((playlist) => ({
      playlist_id: playlist._id,
      name: playlist.name,
      description: playlist.description,
      cover_image_url: playlist.coverImageUrl,
      is_public: playlist.isPublic,
      licks_count: playlist.licksCount,
      created_at: playlist.createdAt,
      updated_at: playlist.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedPlaylists,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalItems: totalPlaylists,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching user's playlists:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Screen 31: Get playlist detail with all licks
export const getPlaylistById = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const userId = req.userId || req.user?.id; // Optional: for checking ownership

    // Get playlist
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found",
      });
    }

    // Check if user can view this playlist
    if (!playlist.isPublic && String(playlist.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view this playlist",
      });
    }

    // Get playlist owner info
    const owner = await User.findById(playlist.userId).select(
      "username displayName avatarUrl"
    );

    // Get all licks in this playlist with full details
    const playlistLicks = await PlaylistLick.find({ playlistId })
      .sort({ position: 1, addedAt: 1 })
      .populate({
        path: "lickId",
        populate: [
          {
            path: "userId",
            select: "username displayName avatarUrl",
          },
        ],
      })
      .lean();

    // Get additional data for each lick (likes, comments, tags)
    const licksWithDetails = await Promise.all(
      playlistLicks.map(async (pl) => {
        if (!pl.lickId) return null;

        const lick = pl.lickId;
        const lickId = lick._id;

        // Get likes count
        const likesCount = await LickLike.countDocuments({ lickId });

        // Get comments count
        const commentsCount = await LickComment.countDocuments({ lickId });

        // Get tags
        const lickTags = await LickTag.find({ lickId }).populate("tagId").lean();
        const tags = lickTags.map((lt) => ({
          tag_id: lt.tagId._id,
          tag_name: lt.tagId.tagName,
          tag_type: lt.tagId.tagType,
        }));

        return {
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
            user_id: lick.userId?._id,
            display_name: lick.userId?.displayName || lick.userId?.username,
            username: lick.userId?.username || "",
            avatar_url: lick.userId?.avatarUrl,
          },
          tags: tags,
          likes_count: likesCount,
          comments_count: commentsCount,
          position: pl.position,
          added_at: pl.addedAt,
          created_at: lick.createdAt,
        };
      })
    );

    // Filter out null values (in case of deleted licks)
    const validLicks = licksWithDetails.filter((lick) => lick !== null);

    // Format response
    const formattedPlaylist = {
      playlist_id: playlist._id,
      name: playlist.name,
      description: playlist.description,
      cover_image_url: playlist.coverImageUrl,
      is_public: playlist.isPublic,
      owner: {
        user_id: owner?._id,
        display_name: owner?.displayName || owner?.username,
        username: owner?.username || "",
        avatar_url: owner?.avatarUrl,
      },
      licks: validLicks,
      licks_count: validLicks.length,
      created_at: playlist.createdAt,
      updated_at: playlist.updatedAt,
    };

    res.status(200).json({
      success: true,
      data: formattedPlaylist,
    });
  } catch (error) {
    console.error("Error fetching playlist:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// UC-16, Screen 30: Create a new playlist
export const createPlaylist = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { name, description, coverImageUrl, isPublic, lickIds } = req.body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Playlist name is required",
      });
    }

    // Create playlist
    const newPlaylist = new Playlist({
      userId,
      name: name.trim(),
      description: description?.trim() || "",
      coverImageUrl: coverImageUrl || "",
      isPublic: isPublic !== undefined ? isPublic : true,
    });

    await newPlaylist.save();

    // Add licks to playlist if provided
    if (lickIds && Array.isArray(lickIds) && lickIds.length > 0) {
      // Validate that all licks exist
      const validLickIds = lickIds.filter(
        (id) => mongoose.Types.ObjectId.isValid(id)
      );
      const existingLicks = await Lick.find({
        _id: { $in: validLickIds },
        isPublic: true,
      }).select("_id");

      const existingLickIds = existingLicks.map((lick) => lick._id.toString());

      // Add licks to playlist with positions
      const playlistLicksToAdd = existingLickIds.map((lickId, index) => ({
        playlistId: newPlaylist._id,
        lickId: new mongoose.Types.ObjectId(lickId),
        position: index + 1,
      }));

      if (playlistLicksToAdd.length > 0) {
        await PlaylistLick.insertMany(playlistLicksToAdd);
      }
    }

    // Get the created playlist with lick count
    const playlistWithCount = await Playlist.aggregate([
      { $match: { _id: newPlaylist._id } },
      {
        $lookup: {
          from: "playlistlicks",
          localField: "_id",
          foreignField: "playlistId",
          as: "licks",
        },
      },
      {
        $addFields: {
          licksCount: { $size: "$licks" },
        },
      },
    ]);

    const formattedPlaylist = {
      playlist_id: playlistWithCount[0]._id,
      name: playlistWithCount[0].name,
      description: playlistWithCount[0].description,
      cover_image_url: playlistWithCount[0].coverImageUrl,
      is_public: playlistWithCount[0].isPublic,
      licks_count: playlistWithCount[0].licksCount,
      created_at: playlistWithCount[0].createdAt,
      updated_at: playlistWithCount[0].updatedAt,
    };

    res.status(201).json({
      success: true,
      message: "Playlist created successfully",
      data: formattedPlaylist,
    });
  } catch (error) {
    console.error("Error creating playlist:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// UC-17, Screen 32: Update playlist
export const updatePlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const userId = req.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Find playlist and check ownership
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found",
      });
    }

    if (String(playlist.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to edit this playlist",
      });
    }

    // Update allowed fields
    const allowedFields = ["name", "description", "coverImageUrl", "isPublic"];
    const update = {};

    for (const field of allowedFields) {
      if (field in req.body) {
        if (field === "name" && req.body[field]) {
          update[field] = req.body[field].trim();
        } else if (field === "description") {
          update[field] = req.body[field]?.trim() || "";
        } else if (field === "isPublic") {
          update[field] =
            typeof req.body[field] === "string"
              ? req.body[field] === "true"
              : req.body[field];
        } else {
          update[field] = req.body[field];
        }
      }
    }

    // Validate name if being updated
    if (update.name && update.name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Playlist name cannot be empty",
      });
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      playlistId,
      update,
      { new: true, runValidators: true }
    );

    // Get lick count
    const licksCount = await PlaylistLick.countDocuments({ playlistId });

    const formattedPlaylist = {
      playlist_id: updatedPlaylist._id,
      name: updatedPlaylist.name,
      description: updatedPlaylist.description,
      cover_image_url: updatedPlaylist.coverImageUrl,
      is_public: updatedPlaylist.isPublic,
      licks_count: licksCount,
      created_at: updatedPlaylist.createdAt,
      updated_at: updatedPlaylist.updatedAt,
    };

    res.status(200).json({
      success: true,
      message: "Playlist updated successfully",
      data: formattedPlaylist,
    });
  } catch (error) {
    console.error("Error updating playlist:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Screen 33: Delete playlist
export const deletePlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const userId = req.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Find playlist and check ownership
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found",
      });
    }

    if (String(playlist.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to delete this playlist",
      });
    }

    // Delete all playlist-lick relationships
    await PlaylistLick.deleteMany({ playlistId });

    // Delete the playlist
    await Playlist.findByIdAndDelete(playlistId);

    res.status(200).json({
      success: true,
      message: "Playlist deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting playlist:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Screen 24: Add lick to playlist
export const addLickToPlaylist = async (req, res) => {
  try {
    const { playlistId, lickId } = req.params;
    const userId = req.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Validate playlist exists and user owns it
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found",
      });
    }

    if (String(playlist.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to modify this playlist",
      });
    }

    // Validate lick exists and is public
    const lick = await Lick.findOne({ _id: lickId, isPublic: true });
    if (!lick) {
      return res.status(404).json({
        success: false,
        message: "Lick not found or not public",
      });
    }

    // Check if lick is already in playlist
    const existingPlaylistLick = await PlaylistLick.findOne({
      playlistId,
      lickId,
    });

    if (existingPlaylistLick) {
      return res.status(400).json({
        success: false,
        message: "Lick is already in this playlist",
      });
    }

    // Get current max position
    const maxPositionDoc = await PlaylistLick.findOne({ playlistId })
      .sort({ position: -1 })
      .select("position")
      .lean();

    const nextPosition = maxPositionDoc ? maxPositionDoc.position + 1 : 1;

    // Add lick to playlist
    const newPlaylistLick = new PlaylistLick({
      playlistId,
      lickId,
      position: nextPosition,
    });

    await newPlaylistLick.save();

    res.status(201).json({
      success: true,
      message: "Lick added to playlist successfully",
      data: {
        playlist_id: playlistId,
        lick_id: lickId,
        position: nextPosition,
        added_at: newPlaylistLick.addedAt,
      },
    });
  } catch (error) {
    console.error("Error adding lick to playlist:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Remove lick from playlist
export const removeLickFromPlaylist = async (req, res) => {
  try {
    const { playlistId, lickId } = req.params;
    const userId = req.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Validate playlist exists and user owns it
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found",
      });
    }

    if (String(playlist.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to modify this playlist",
      });
    }

    // Remove lick from playlist
    const result = await PlaylistLick.deleteOne({ playlistId, lickId });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Lick not found in this playlist",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lick removed from playlist successfully",
    });
  } catch (error) {
    console.error("Error removing lick from playlist:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Reorder licks in playlist
export const reorderPlaylistLicks = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { lickIds } = req.body; // Array of lick IDs in new order
    const userId = req.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!Array.isArray(lickIds) || lickIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "lickIds must be a non-empty array",
      });
    }

    // Validate playlist exists and user owns it
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist not found",
      });
    }

    if (String(playlist.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to modify this playlist",
      });
    }

    // Update positions for all licks
    const updatePromises = lickIds.map((lickId, index) => {
      return PlaylistLick.updateOne(
        { playlistId, lickId },
        { $set: { position: index + 1 } }
      );
    });

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: "Playlist order updated successfully",
    });
  } catch (error) {
    console.error("Error reordering playlist licks:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

