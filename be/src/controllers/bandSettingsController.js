import mongoose from "mongoose";
import BandSettings from "../models/BandSettings.js";
import Project from "../models/Project.js";

// Create new band settings
export const createBandSettings = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, description, style, swingAmount, members, isPublic } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Band settings name is required",
      });
    }

    const bandSettings = new BandSettings({
      name: name.trim(),
      description: description || "",
      creatorId: userId,
      style: style || "Swing",
      swingAmount: swingAmount ?? 0.6,
      members: members || [],
      isPublic: isPublic || false,
      isDefault: false,
    });

    await bandSettings.save();

    res.status(201).json({
      success: true,
      message: "Band settings created successfully",
      data: bandSettings,
    });
  } catch (error) {
    console.error("Error creating band settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create band settings",
      error: error.message,
    });
  }
};

// Get band settings by ID
export const getBandSettingsById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const bandSettings = await BandSettings.findById(id);

    if (!bandSettings) {
      return res.status(404).json({
        success: false,
        message: "Band settings not found",
      });
    }

    // Check if user has access (creator, public, or default)
    const hasAccess =
      bandSettings.creatorId.toString() === userId ||
      bandSettings.isPublic ||
      bandSettings.isDefault;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this band settings",
      });
    }

    res.json({
      success: true,
      data: bandSettings,
    });
  } catch (error) {
    console.error("Error fetching band settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch band settings",
      error: error.message,
    });
  }
};

// Get all user's band settings
export const getUserBandSettings = async (req, res) => {
  try {
    const userId = req.userId;

    const bandSettings = await BandSettings.find({
      $or: [
        { creatorId: userId },
        { isPublic: true },
        { isDefault: true },
      ],
    })
      .sort({ updatedAt: -1 })
      .populate("creatorId", "username displayName avatarUrl");

    res.json({
      success: true,
      data: bandSettings,
    });
  } catch (error) {
    console.error("Error fetching user band settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch band settings",
      error: error.message,
    });
  }
};

// Get public band settings
export const getPublicBandSettings = async (req, res) => {
  try {
    const bandSettings = await BandSettings.find({
      $or: [{ isPublic: true }, { isDefault: true }],
    })
      .sort({ updatedAt: -1 })
      .populate("creatorId", "username displayName avatarUrl");

    res.json({
      success: true,
      data: bandSettings,
    });
  } catch (error) {
    console.error("Error fetching public band settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch public band settings",
      error: error.message,
    });
  }
};

// Update band settings
export const updateBandSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { name, description, style, swingAmount, members, isPublic } = req.body;

    const bandSettings = await BandSettings.findById(id);

    if (!bandSettings) {
      return res.status(404).json({
        success: false,
        message: "Band settings not found",
      });
    }

    // Check if user is the creator
    if (bandSettings.creatorId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the creator can update these band settings",
      });
    }

    // Cannot update default settings
    if (bandSettings.isDefault) {
      return res.status(403).json({
        success: false,
        message: "Cannot update default band settings",
      });
    }

    // Update fields
    if (name !== undefined) bandSettings.name = name.trim();
    if (description !== undefined) bandSettings.description = description;
    if (style !== undefined) bandSettings.style = style;
    if (swingAmount !== undefined) {
      bandSettings.swingAmount = Math.max(0, Math.min(1, swingAmount));
    }
    if (members !== undefined) bandSettings.members = members;
    if (isPublic !== undefined) bandSettings.isPublic = isPublic;

    await bandSettings.save();

    res.json({
      success: true,
      message: "Band settings updated successfully",
      data: bandSettings,
    });
  } catch (error) {
    console.error("Error updating band settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update band settings",
      error: error.message,
    });
  }
};

// Delete band settings
export const deleteBandSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const bandSettings = await BandSettings.findById(id);

    if (!bandSettings) {
      return res.status(404).json({
        success: false,
        message: "Band settings not found",
      });
    }

    // Check if user is the creator
    if (bandSettings.creatorId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the creator can delete these band settings",
      });
    }

    // Cannot delete default settings
    if (bandSettings.isDefault) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete default band settings",
      });
    }

    // Check if band settings is in use by any projects
    const projectsUsing = await Project.countDocuments({
      bandSettingsId: bandSettings._id,
    });

    if (projectsUsing > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete band settings. It is being used by ${projectsUsing} project(s). Please update those projects first.`,
        projectsCount: projectsUsing,
      });
    }

    await BandSettings.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Band settings deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting band settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete band settings",
      error: error.message,
    });
  }
};

