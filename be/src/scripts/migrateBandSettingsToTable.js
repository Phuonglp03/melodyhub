// scripts/migrateBandSettingsToTable.js
// Migration script to extract embedded bandSettings from Project documents
// into separate BandSettings documents and link via bandSettingsId
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Project from "../models/Project.js";
import BandSettings from "../models/BandSettings.js";

const DEFAULT_MEMBERS = [
  {
    instanceId: "default-drums",
    name: "Drums",
    type: "drums",
    role: "rhythm",
    soundBank: "jazz-kit",
    volume: 0.8,
    pan: 0,
    isMuted: false,
    isSolo: false,
  },
  {
    instanceId: "default-bass",
    name: "Bass",
    type: "bass",
    role: "bass",
    soundBank: "upright",
    volume: 0.8,
    pan: 0,
    isMuted: false,
    isSolo: false,
  },
  {
    instanceId: "default-piano",
    name: "Piano",
    type: "piano",
    role: "comping",
    soundBank: "grand-piano",
    volume: 0.8,
    pan: 0,
    isMuted: false,
    isSolo: false,
  },
];

const migrateBandSettings = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("[migrate] Connected to database");

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let defaultBandSettingsId = null;

  try {
    // Step 1: Create default system BandSettings if it doesn't exist
    console.log("[migrate] Checking for default BandSettings...");
    let defaultBandSettings = await BandSettings.findOne({ isDefault: true });

    if (!defaultBandSettings) {
      console.log("[migrate] Creating default system BandSettings...");
      // Find a system user or use the first admin user as creator
      // For now, we'll need to find an admin user or use a special system user
      // This is a placeholder - adjust based on your user model
      const User = mongoose.models.User || (await import("../models/User.js")).default;
      const adminUser = await User.findOne({ roleId: "admin" }).limit(1);
      
      if (!adminUser) {
        console.warn("[migrate] No admin user found. Using first user as creator for default BandSettings.");
        const firstUser = await User.findOne().limit(1);
        if (!firstUser) {
          throw new Error("No users found in database. Cannot create default BandSettings.");
        }
        defaultBandSettings = new BandSettings({
          name: "Default Band Settings",
          description: "System default band settings",
          creatorId: firstUser._id,
          style: "Swing",
          swingAmount: 0.6,
          members: DEFAULT_MEMBERS,
          isPublic: false,
          isDefault: true,
        });
      } else {
        defaultBandSettings = new BandSettings({
          name: "Default Band Settings",
          description: "System default band settings",
          creatorId: adminUser._id,
          style: "Swing",
          swingAmount: 0.6,
          members: DEFAULT_MEMBERS,
          isPublic: false,
          isDefault: true,
        });
      }
      await defaultBandSettings.save();
      console.log(`[migrate] Created default BandSettings: ${defaultBandSettings._id}`);
    } else {
      console.log(`[migrate] Default BandSettings already exists: ${defaultBandSettings._id}`);
    }
    defaultBandSettingsId = defaultBandSettings._id;

    // Step 2: Find all projects with embedded bandSettings
    console.log("[migrate] Scanning projects for embedded bandSettings...");
    const projectsWithEmbedded = await Project.find({
      $or: [
        { bandSettings: { $exists: true, $ne: null } },
        { "bandSettings.members": { $exists: true } },
      ],
      bandSettingsId: { $exists: false },
    }).lean();

    console.log(`[migrate] Found ${projectsWithEmbedded.length} projects with embedded bandSettings`);

    // Step 3: Migrate each project
    for (const project of projectsWithEmbedded) {
      try {
        const projectDoc = await Project.findById(project._id);
        if (!projectDoc) {
          console.warn(`[migrate] Project ${project._id} not found, skipping`);
          skippedCount++;
          continue;
        }

        // Check if already has bandSettingsId
        if (projectDoc.bandSettingsId) {
          console.log(`[migrate] Project ${project._id} already has bandSettingsId, skipping`);
          skippedCount++;
          continue;
        }

        // Extract bandSettings data
        const embeddedSettings = projectDoc.bandSettings;
        
        if (embeddedSettings && embeddedSettings.members && embeddedSettings.members.length > 0) {
          // Create new BandSettings document
          const newBandSettings = new BandSettings({
            name: `Project: ${projectDoc.title || "Untitled"}`,
            description: `Band settings for project: ${projectDoc.title || "Untitled"}`,
            creatorId: projectDoc.creatorId,
            style: embeddedSettings.style || "Swing",
            swingAmount: embeddedSettings.swingAmount ?? 0.6,
            members: embeddedSettings.members || DEFAULT_MEMBERS,
            isPublic: false,
            isDefault: false,
          });

          await newBandSettings.save();
          console.log(`[migrate] Created BandSettings ${newBandSettings._id} for project ${projectDoc._id}`);

          // Link project to new BandSettings
          projectDoc.bandSettingsId = newBandSettings._id;
        } else {
          // No embedded bandSettings or empty members - use default
          console.log(`[migrate] Project ${project._id} has no valid bandSettings, using default`);
          projectDoc.bandSettingsId = defaultBandSettingsId;
        }

        // Remove embedded bandSettings field using $unset
        projectDoc.bandSettings = undefined;
        projectDoc.markModified('bandSettings'); // Mark as modified to ensure removal

        // Remove backingPlayingPatternId field if exists
        if (projectDoc.backingPlayingPatternId) {
          projectDoc.backingPlayingPatternId = undefined;
        }

        // Save project using $unset to ensure fields are removed
        await Project.updateOne(
          { _id: projectDoc._id },
          {
            $set: { bandSettingsId: projectDoc.bandSettingsId },
            $unset: { 
              bandSettings: "",
              backingPlayingPatternId: ""
            }
          }
        );
        migratedCount++;
        console.log(`[migrate] ✓ Migrated project ${projectDoc._id}`);
      } catch (err) {
        console.error(`[migrate] ✗ Error migrating project ${project._id}:`, err.message);
        errorCount++;
      }
    }

    // Step 4: Update projects without bandSettings to reference default
    console.log("[migrate] Updating projects without bandSettings...");
    const projectsWithoutSettings = await Project.find({
      $or: [
        { bandSettings: { $exists: false } },
        { bandSettings: null },
        { "bandSettings.members": { $exists: false } },
        { "bandSettings.members": { $size: 0 } },
      ],
      bandSettingsId: { $exists: false },
    });

    console.log(`[migrate] Found ${projectsWithoutSettings.length} projects without bandSettings`);

    for (const project of projectsWithoutSettings) {
      try {
        // Use updateOne to avoid validation errors on invalid key/timeSignature fields
        await Project.updateOne(
          { _id: project._id },
          {
            $set: { bandSettingsId: defaultBandSettingsId },
            $unset: { 
              bandSettings: "",
              backingPlayingPatternId: ""
            }
          }
        );
        migratedCount++;
        console.log(`[migrate] ✓ Linked project ${project._id} to default BandSettings`);
      } catch (err) {
        console.error(`[migrate] ✗ Error updating project ${project._id}:`, err.message);
        errorCount++;
      }
    }

    // Step 5: Remove backingPlayingPatternId from all remaining projects
    console.log("[migrate] Removing backingPlayingPatternId from all projects...");
    const projectsWithPatternId = await Project.find({
      backingPlayingPatternId: { $exists: true, $ne: null },
    });

    for (const project of projectsWithPatternId) {
      try {
        // Use updateOne to avoid validation errors
        await Project.updateOne(
          { _id: project._id },
          { $unset: { backingPlayingPatternId: "" } }
        );
        console.log(`[migrate] ✓ Removed backingPlayingPatternId from project ${project._id}`);
      } catch (err) {
        console.error(`[migrate] ✗ Error removing backingPlayingPatternId from project ${project._id}:`, err.message);
        errorCount++;
      }
    }

    // Step 6: Final cleanup - Remove all remaining embedded bandSettings fields
    console.log("[migrate] Final cleanup - removing all remaining embedded bandSettings...");
    // First, find all projects with embedded bandSettings
    const remainingProjectsWithEmbedded = await Project.find({
      bandSettings: { $exists: true }
    }).select('_id').lean();
    
    if (remainingProjectsWithEmbedded.length > 0) {
      const projectIds = remainingProjectsWithEmbedded.map(p => p._id);
      // Use updateMany with $unset to remove the field
      const result = await Project.updateMany(
        { _id: { $in: projectIds } },
        { $unset: { bandSettings: "", backingPlayingPatternId: "" } }
      );
      console.log(`[migrate] ✓ Removed embedded bandSettings from ${result.modifiedCount} projects`);
    } else {
      console.log(`[migrate] ✓ No projects with embedded bandSettings found`);
    }

    // Summary
    console.log("\n[migrate] ===== Migration Summary =====");
    console.log(`[migrate] Projects migrated: ${migratedCount}`);
    console.log(`[migrate] Projects skipped: ${skippedCount}`);
    console.log(`[migrate] Errors: ${errorCount}`);
    console.log(`[migrate] Default BandSettings ID: ${defaultBandSettingsId}`);
    console.log("[migrate] ==============================\n");

    // Verification - check for projects with actual bandSettings data (not just empty objects)
    const projectsWithEmbeddedAfter = await Project.countDocuments({
      $and: [
        { bandSettings: { $exists: true, $ne: null } },
        {
          $or: [
            { "bandSettings.members": { $exists: true, $type: "array", $ne: [] } },
            { "bandSettings.style": { $exists: true, $ne: "" } },
            { "bandSettings.swingAmount": { $exists: true } }
          ]
        }
      ]
    });
    const projectsWithPatternIdAfter = await Project.countDocuments({
      backingPlayingPatternId: { $exists: true, $ne: null },
    });
    const projectsWithBandSettingsId = await Project.countDocuments({
      bandSettingsId: { $exists: true, $ne: null },
    });

    console.log("[migrate] ===== Verification =====");
    console.log(`[migrate] Projects with embedded bandSettings: ${projectsWithEmbeddedAfter} (should be 0)`);
    console.log(`[migrate] Projects with backingPlayingPatternId: ${projectsWithPatternIdAfter} (should be 0)`);
    console.log(`[migrate] Projects with bandSettingsId: ${projectsWithBandSettingsId}`);
    console.log("[migrate] ========================\n");

    if (projectsWithEmbeddedAfter > 0 || projectsWithPatternIdAfter > 0) {
      console.warn("[migrate] ⚠️  Some projects still have old fields. Review and re-run if needed.");
    }

    console.log("[migrate] Migration completed successfully!");
  } catch (err) {
    console.error("[migrate] Migration failed:", err);
    throw err;
  } finally {
    await mongoose.disconnect();
    console.log("[migrate] Disconnected from database");
    process.exit(0);
  }
};

migrateBandSettings().catch((err) => {
  console.error("[migrate] Fatal error:", err);
  process.exit(1);
});

