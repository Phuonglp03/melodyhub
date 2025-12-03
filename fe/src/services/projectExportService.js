// src/services/projectExportService.js
import * as Tone from "tone";
import { normalizeTracks } from "../utils/timelineHelpers";
import api from "./api";
import { getLickById } from "./user/lickService";
import { generateBackingTrack } from "./user/projectService";

// Helper: Convert AudioBuffer to WAV Blob
const audioBufferToWav = (buffer) => {
  const length = buffer.length;
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + length * numberOfChannels * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, length * numberOfChannels * 2, true);

  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(
        -1,
        Math.min(1, buffer.getChannelData(channel)[i])
      );
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
};

// Generate waveform data from AudioBuffer
const generateWaveformFromBuffer = (buffer) => {
  try {
    const channelData = buffer.getChannelData(0); // Use first channel
    const samples = 100; // Number of waveform bars
    const blockSize = Math.floor(channelData.length / samples);
    const waveform = [];

    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        const index = i * blockSize + j;
        if (index < channelData.length) {
          sum += Math.abs(channelData[index]);
        }
      }
      const average = sum / blockSize;
      // Normalize to 0-1 range
      waveform.push(Math.min(1, Math.max(0.1, average * 2)));
    }

    return waveform;
  } catch (error) {
    console.error("[Export] Error generating waveform:", error);
    // Return default waveform if generation fails
    return Array.from({ length: 100 }, () => 0.5);
  }
};

const uploadProjectAudioToServer = async (projectId, file) => {
  const formData = new FormData();
  formData.append("audio", file);
  formData.append("fileName", file.name);

  const response = await api.post(
    `/projects/${projectId}/export-audio/upload`,
    formData
  );

  return response.data;
};

/**
 * Fetch full project timeline (tracks + items) for export
 * @param {string} projectId
 */
const fetchProjectTimelineForExport = async (projectId) => {
  const response = await api.get(`/projects/${projectId}/export-timeline`);

  // Debug: Log raw API response
  console.log("(NO $) [DEBUG][FullMixExport] Raw API response:", {
    hasData: !!response.data,
    hasSuccess: !!response.data?.success,
    hasDataData: !!response.data?.data,
    responseKeys: response.data ? Object.keys(response.data) : [],
    projectKeys: response.data?.data?.project
      ? Object.keys(response.data.data.project)
      : [],
    hasChordProgression: !!response.data?.data?.project?.chordProgression,
    chordProgression: response.data?.data?.project?.chordProgression,
    fullResponse: response.data,
  });

  return response.data;
};

/**
 * Export full project (all tracks + timeline items) via Tone.Offline
 * and upload the rendered WAV to the backend.
 *
 * @param {string} projectId
 * @returns {Promise<{success: boolean, audioUrl?: string, waveformData?: number[], duration?: number}>}
 */
export const exportFullProjectAudio = async (projectId) => {
  if (!projectId) {
    throw new Error("projectId is required for full project export");
  }

  try {
    console.log("(NO $) [DEBUG][FullMixExport] Fetching timeline for export:", {
      projectId,
    });

    const timelineResponse = await fetchProjectTimelineForExport(projectId);

    if (!timelineResponse?.success || !timelineResponse?.data) {
      throw new Error(
        timelineResponse?.message || "Failed to fetch project timeline"
      );
    }

    // Debug: Log the timelineResponse structure first
    console.log("(NO $) [DEBUG][FullMixExport] Timeline response structure:", {
      hasData: !!timelineResponse.data,
      dataKeys: timelineResponse.data ? Object.keys(timelineResponse.data) : [],
      hasProject: !!timelineResponse.data?.project,
      hasTimeline: !!timelineResponse.data?.timeline,
    });

    const { project, timeline } = timelineResponse.data;
    const rawTracks = timeline?.tracks || [];
    const itemsByTrackId = timeline?.itemsByTrackId || {};

    // Debug: Log project data to see what we received
    console.log("(NO $) [DEBUG][FullMixExport] Project data:", {
      projectId: project?.id,
      title: project?.title,
      hasChordProgression: !!project?.chordProgression,
      chordProgressionType: Array.isArray(project?.chordProgression)
        ? "array"
        : typeof project?.chordProgression,
      chordProgressionLength: Array.isArray(project?.chordProgression)
        ? project.chordProgression.length
        : 0,
      chordProgression: project?.chordProgression,
      allProjectKeys: project ? Object.keys(project) : [],
      fullProject: project, // Log full project to see everything
    });

    // Check if backing track exists and needs audio generation
    const backingTrack = rawTracks.find(
      (t) => t.isBackingTrack === true || t.trackType === "backing"
    );

    // Check if project has chord progression
    let chordProgression = project?.chordProgression || [];

    // If no chord progression in project, try to extract from timeline items
    if (!Array.isArray(chordProgression) || chordProgression.length === 0) {
      console.log(
        "(NO $) [DEBUG][FullMixExport] No chord progression in project, checking timeline items..."
      );

      // Extract chord progression from all timeline items
      const allItems = Object.values(itemsByTrackId).flat();
      console.log(
        "(NO $) [DEBUG][FullMixExport] All timeline items for chord extraction:",
        {
          totalItems: allItems.length,
          items: allItems.map((item) => ({
            id: item._id || item.id,
            type: item.type,
            chordName: item.chordName,
            chord: item.chord,
            startTime: item.startTime,
            allKeys: Object.keys(item),
          })),
        }
      );

      const chordItems = allItems
        .filter((item) => item.chordName || item.chord || item.type === "chord")
        .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

      console.log("(NO $) [DEBUG][FullMixExport] Filtered chord items:", {
        count: chordItems.length,
        items: chordItems.map((item) => ({
          id: item._id || item.id,
          type: item.type,
          chordName: item.chordName,
          chord: item.chord,
          startTime: item.startTime,
        })),
      });

      if (chordItems.length > 0) {
        chordProgression = chordItems.map(
          (item) => item.chordName || item.chord || "Unknown"
        );
        console.log(
          "(NO $) [DEBUG][FullMixExport] Extracted chord progression from timeline items:",
          {
            chordCount: chordProgression.length,
            chords: chordProgression,
          }
        );
      } else {
        console.warn(
          "(NO $) [DEBUG][FullMixExport] No chord items found in timeline items"
        );
      }
    }

    const hasChordProgression =
      Array.isArray(chordProgression) && chordProgression.length > 0;

    // Determine if we need to generate backing track
    let needsGeneration = false;
    let generationReason = "";

    if (backingTrack) {
      const backingTrackId = String(backingTrack._id || backingTrack.id);
      const backingItems = itemsByTrackId[backingTrackId] || [];
      const itemsWithAudio = backingItems.filter(
        (item) => item.audioUrl || item.audio_url
      );

      // If backing track has no items or items without audio, generate it
      if (backingItems.length === 0 || itemsWithAudio.length === 0) {
        needsGeneration = true;
        generationReason =
          backingItems.length === 0
            ? "backing track has no items"
            : "backing track items have no audio";
      }
    } else if (hasChordProgression) {
      // No backing track exists but chord progression does - create it
      needsGeneration = true;
      generationReason = "no backing track exists but chord progression found";
    }

    if (needsGeneration) {
      if (!hasChordProgression) {
        console.warn(
          "(NO $) [DEBUG][FullMixExport] Cannot auto-generate backing track: no chord progression found"
        );
      } else {
        try {
          console.log(
            "(NO $) [DEBUG][FullMixExport] Auto-generating backing track:",
            {
              reason: generationReason,
              chordCount: chordProgression.length,
              backingTrackExists: !!backingTrack,
            }
          );

          // Get backing track instrument and rhythm pattern if available
          const instrumentId =
            backingTrack?.instrument?.instrumentId || undefined;
          const rhythmPatternId =
            backingTrack?.defaultRhythmPatternId || undefined;

          // Generate backing track with audio (will create track if it doesn't exist)
          const generateResponse = await generateBackingTrack(projectId, {
            chords: chordProgression,
            instrumentId,
            rhythmPatternId,
            chordDuration: 4, // Default 4 beats per chord
            generateAudio: true, // CRITICAL: Generate audio files
          });

          if (generateResponse?.success) {
            console.log(
              "(NO $) [DEBUG][FullMixExport] Backing track audio generated successfully, refetching timeline..."
            );

            // Refetch timeline to get the newly generated items
            const refreshedTimelineResponse =
              await fetchProjectTimelineForExport(projectId);

            if (
              refreshedTimelineResponse?.success &&
              refreshedTimelineResponse?.data
            ) {
              // Update with refreshed data
              const refreshedData = refreshedTimelineResponse.data;
              const refreshedTracks = refreshedData.timeline?.tracks || [];
              const refreshedItemsByTrackId =
                refreshedData.timeline?.itemsByTrackId || {};

              // Update our working data
              rawTracks.length = 0;
              rawTracks.push(...refreshedTracks);
              Object.keys(itemsByTrackId).forEach(
                (key) => delete itemsByTrackId[key]
              );
              Object.assign(itemsByTrackId, refreshedItemsByTrackId);

              // Find the backing track ID after refresh
              const newBackingTrack = refreshedTracks.find(
                (t) => t.isBackingTrack === true || t.trackType === "backing"
              );
              const newBackingTrackId = newBackingTrack
                ? String(newBackingTrack._id || newBackingTrack.id)
                : null;

              console.log(
                "(NO $) [DEBUG][FullMixExport] Timeline refreshed, backing track items:",
                newBackingTrackId
                  ? (refreshedItemsByTrackId[newBackingTrackId] || []).length
                  : 0
              );
            }
          } else {
            console.warn(
              "(NO $) [DEBUG][FullMixExport] Backing track generation failed:",
              generateResponse?.message || "Unknown error"
            );
          }
        } catch (genError) {
          console.error(
            "(NO $) [DEBUG][FullMixExport] Error auto-generating backing track:",
            genError
          );
          // Continue with export even if generation fails
        }
      }
    }

    // Debug: Log all tracks from backend to see backing track status
    const tracksSummary = rawTracks.map((t) => ({
      id: String(t._id || t.id),
      name: t.trackName,
      type: t.trackType,
      isBackingTrack: t.isBackingTrack,
      hasItems: !!itemsByTrackId[String(t._id || t.id)],
      itemCount: (itemsByTrackId[String(t._id || t.id)] || []).length,
    }));
    console.log("(NO $) [DEBUG][FullMixExport] All tracks from backend:", {
      trackCount: rawTracks.length,
      tracks: tracksSummary,
    });
    // Also log each track individually for easier inspection
    tracksSummary.forEach((track, index) => {
      console.log(`(NO $) [DEBUG][FullMixExport] Track ${index + 1}:`, track);
    });

    // Debug: Log itemsByTrackId keys to see what we received
    console.log(
      "(NO $) [DEBUG][FullMixExport] Items by trackId keys:",
      Object.keys(itemsByTrackId)
    );
    const itemsSummary = Object.entries(itemsByTrackId).map(([key, items]) => ({
      trackId: key,
      itemCount: items.length,
      itemTypes: items.map((i) => i.type),
      hasAudioUrls: items.filter((i) => i.audioUrl || i.lickId?.audioUrl)
        .length,
      itemsWithChordName: items.filter((i) => i.chordName || i.chord).length,
      itemsWithChordType: items.filter((i) => i.type === "chord").length,
    }));
    console.log(
      "(NO $) [DEBUG][FullMixExport] Items by trackId summary:",
      itemsSummary
    );

    // Check for any items with chord characteristics that might be backing track items
    const allItemsFlat = Object.values(itemsByTrackId).flat();
    const chordItems = allItemsFlat.filter(
      (item) => item.chordName || item.chord || item.type === "chord"
    );
    if (chordItems.length > 0) {
      console.log(
        "(NO $) [DEBUG][FullMixExport] Found items with chord characteristics:",
        {
          count: chordItems.length,
          items: chordItems.map((item) => ({
            itemId: String(item._id || item.id),
            trackId: String(item.trackId),
            type: item.type,
            chordName: item.chordName || item.chord,
            hasAudioUrl: !!(item.audioUrl || item.audio_url),
            hasLickId: !!item.lickId,
          })),
        }
      );
    } else {
      console.log(
        "(NO $) [DEBUG][FullMixExport] No items with chord characteristics found"
      );
    }

    // Attach items to tracks
    const tracksWithItems = rawTracks.map((track) => {
      const key = String(track._id || track.id);
      const items = itemsByTrackId[key] || [];

      console.log("(NO $) [DEBUG][FullMixExport] Attaching items to track:", {
        trackId: key,
        trackName: track.trackName || "unnamed",
        trackType: track.trackType,
        isBackingTrack: track.isBackingTrack,
        itemsFound: items.length,
        availableKeys: Object.keys(itemsByTrackId),
        // Log all track properties to see what we're working with
        allTrackProps: {
          isBackingTrack: track.isBackingTrack,
          trackType: track.trackType,
          trackName: track.trackName,
          trackNameLower: track.trackName?.toLowerCase(),
        },
      });

      // Warn if backing track has no items
      if (track.isBackingTrack && items.length === 0) {
        console.warn(
          "(NO $) [DEBUG][FullMixExport] WARNING: Backing track has no items!",
          {
            trackId: key,
            trackName: track.trackName,
            message:
              "Backing track items may not have been generated. Make sure to generate the backing track audio first.",
            availableTrackIds: Object.keys(itemsByTrackId),
            allTracks: rawTracks.map((t) => ({
              id: String(t._id || t.id),
              name: t.trackName,
              type: t.trackType,
              isBacking: t.isBackingTrack,
            })),
          }
        );
      }

      return {
        ...track,
        items,
      };
    });

    // Before normalization, try to identify backing tracks by their items
    // Backing tracks typically have items with type: "chord" and audioUrl (not lickId)
    const tracksWithBackingDetection = tracksWithItems.map((track) => {
      const items = track.items || [];

      // PRIMARY CHECK: Check if track is already marked as backing track in database
      // This handles cases where backing track exists but items haven't been generated yet
      if (track.isBackingTrack === true || track.trackType === "backing") {
        console.log(
          "(NO $) [DEBUG][FullMixExport] Track is marked as backing track in database:",
          {
            trackId: String(track._id || track.id),
            trackName: track.trackName,
            isBackingTrack: track.isBackingTrack,
            trackType: track.trackType,
            itemCount: items.length,
            detectionMethod: "database_flag",
          }
        );
        // Ensure it's properly marked (in case only one property is set)
        return {
          ...track,
          isBackingTrack: true,
          trackType: "backing",
        };
      }

      // SECONDARY CHECK: Check if this track has backing track characteristics in its items
      // Check if this track has backing track characteristics:
      // - Items with type "chord" and audioUrl (but no lickId)
      // Log item details for debugging
      if (items.length > 0) {
        console.log(
          "(NO $) [DEBUG][FullMixExport] Checking track items for backing detection:",
          {
            trackId: String(track._id || track.id),
            trackName: track.trackName,
            items: items.map((item) => {
              const hasAudio = !!(item.audioUrl || item.audio_url);
              const hasLickId = !!(item.lickId || item.lickId?._id);
              const hasChordName = !!(item.chordName || item.chord);
              const matchesBackingCriteria =
                hasAudio &&
                !hasLickId &&
                (hasChordName || item.type === "chord");
              return {
                type: item.type,
                hasAudioUrl: hasAudio,
                audioUrl: item.audioUrl || item.audio_url || null,
                hasLickId: hasLickId,
                lickId: item.lickId ? item.lickId._id || item.lickId : null,
                chordName: item.chordName || item.chord || null,
                matchesBackingCriteria,
                // Show all item keys for debugging
                allKeys: Object.keys(item),
              };
            }),
          }
        );
      }
      // More flexible detection: backing track items have audioUrl and chordName but no lickId
      // They might not have type: "chord" set, so check for the actual characteristics
      const hasBackingItems = items.some((item) => {
        const hasAudio = !!(item.audioUrl || item.audio_url);
        const hasChordName = !!(item.chordName || item.chord);
        const hasNoLickId = !item.lickId && !item.lickId?._id;
        // Backing track items: have audio, have chord name, but no lickId
        // OR: have audio, type is "chord", but no lickId
        return (
          hasAudio && hasNoLickId && (hasChordName || item.type === "chord")
        );
      });

      // If track isn't already marked as backing track but has backing items, mark it
      if (
        !track.isBackingTrack &&
        hasBackingItems &&
        track.trackType !== "backing"
      ) {
        const backingItemCount = items.filter((item) => {
          const hasAudio = !!(item.audioUrl || item.audio_url);
          const hasChordName = !!(item.chordName || item.chord);
          const hasNoLickId = !item.lickId && !item.lickId?._id;
          return (
            hasAudio && hasNoLickId && (hasChordName || item.type === "chord")
          );
        }).length;

        console.log(
          "(NO $) [DEBUG][FullMixExport] Detected backing track by items:",
          {
            trackId: String(track._id || track.id),
            trackName: track.trackName,
            backingItemCount,
            totalItems: items.length,
            detectionMethod: "item_characteristics",
          }
        );
        return {
          ...track,
          isBackingTrack: true,
          trackType: "backing",
        };
      }

      return track;
    });

    // Log tracks before normalization
    console.log("(NO $) [DEBUG][FullMixExport] Tracks before normalization:", {
      trackCount: tracksWithBackingDetection.length,
      tracks: tracksWithBackingDetection.map((t) => ({
        id: String(t._id || t.id),
        name: t.trackName,
        type: t.trackType,
        isBackingTrack: t.isBackingTrack,
        itemCount: (t.items || []).length,
      })),
    });

    const normalizedTracks = normalizeTracks(tracksWithBackingDetection);

    // Log tracks after normalization
    console.log("(NO $) [DEBUG][FullMixExport] Tracks after normalization:", {
      trackCount: normalizedTracks.length,
      tracks: normalizedTracks.map((t) => ({
        id: String(t._id || t.id),
        name: t.trackName,
        type: t.trackType,
        isBackingTrack: t.isBackingTrack,
        itemCount: (t.items || []).length,
      })),
      backingTracksFound: normalizedTracks.filter((t) => t.isBackingTrack)
        .length,
    });

    // Determine export duration from timeline (fallback to 0 if none)
    const duration =
      typeof timeline?.durationSeconds === "number" &&
      timeline.durationSeconds > 0
        ? timeline.durationSeconds
        : normalizedTracks.reduce((maxEnd, track) => {
            const trackMax = (track.items || []).reduce((innerMax, item) => {
              const start = Number(item.startTime) || 0;
              const dur = Number(item.duration) || 0;
              return Math.max(innerMax, start + dur);
            }, 0);
            return Math.max(maxEnd, trackMax);
          }, 0);

    if (!duration || duration <= 0) {
      throw new Error("Project has no audio clips to export");
    }

    // Debug: Log all items to see their structure
    const allItems = normalizedTracks.flatMap((t) => t.items || []);
    const itemsWithAudio = allItems.filter((item) => {
      let audioUrl = item.audioUrl || item.audio_url || null;

      // Handle lickId - could be populated object or string ID
      if (!audioUrl && item.lickId) {
        if (typeof item.lickId === "object" && item.lickId !== null) {
          audioUrl = item.lickId.audioUrl || item.lickId.audio_url || null;
        }
      }

      return !!audioUrl;
    });

    // Check for backing tracks with no items
    const backingTracks = normalizedTracks.filter((t) => t.isBackingTrack);
    const backingTracksWithNoItems = backingTracks.filter(
      (t) => (t.items || []).length === 0
    );

    // Check backing track items specifically
    const backingTrackItems = backingTracks.flatMap((t) => t.items || []);
    const backingTrackItemsWithAudio = backingTrackItems.filter((item) => {
      let audioUrl = item.audioUrl || item.audio_url || null;
      if (!audioUrl && item.lickId) {
        if (typeof item.lickId === "object" && item.lickId !== null) {
          audioUrl = item.lickId.audioUrl || item.lickId.audio_url || null;
        }
      }
      return !!audioUrl;
    });

    console.log("(NO $) [DEBUG][FullMixExport] Timeline summary:", {
      projectId,
      projectTitle: project?.title,
      trackCount: normalizedTracks.length,
      itemCount: allItems.length,
      itemsWithAudio: itemsWithAudio.length,
      itemsWithoutAudio: allItems.length - itemsWithAudio.length,
      backingTracksCount: backingTracks.length,
      backingTracksWithNoItems: backingTracksWithNoItems.length,
      backingTrackItemsCount: backingTrackItems.length,
      backingTrackItemsWithAudio: backingTrackItemsWithAudio.length,
      backingTrackItemsWithoutAudio:
        backingTrackItems.length - backingTrackItemsWithAudio.length,
      backingTrackItemsDetails: backingTrackItems.map((item) => ({
        id: item._id || item.id,
        type: item.type,
        chordName: item.chordName,
        hasAudioUrl: !!(item.audioUrl || item.audio_url),
        audioUrl: item.audioUrl || item.audio_url || null,
        startTime: item.startTime,
        duration: item.duration,
      })),
      durationSeconds: duration,
    });

    // Warn user if backing tracks exist but have no items
    if (backingTracksWithNoItems.length > 0 && itemsWithAudio.length > 0) {
      console.warn(
        "(NO $) [DEBUG][FullMixExport] WARNING: Some backing tracks have no items and will not be included in export.",
        {
          backingTracksAffected: backingTracksWithNoItems.map((t) => ({
            trackId: t._id || t.id,
            trackName: t.trackName || "unnamed",
          })),
          message:
            "Generate backing track audio first to include it in the export. The export will continue with available items.",
        }
      );
    }

    // Log sample items for debugging
    if (allItems.length > 0) {
      console.log("(NO $) [DEBUG][FullMixExport] Sample items:", {
        firstItem: allItems[0],
        firstItemWithAudio: itemsWithAudio[0] || null,
        itemTypes: allItems.map((i) => ({
          type: i.type,
          hasAudioUrl: !!(i.audioUrl || i.audio_url),
          hasLickId: !!i.lickId,
          lickIdHasAudioUrl: !!(i.lickId?.audioUrl || i.lickId?.audio_url),
        })),
      });
    }

    // Fetch lick data for items where lickId is a string (not populated)
    const lickIdMap = new Map();
    const stringLickIds = new Set();

    for (const item of allItems) {
      if (item.lickId && typeof item.lickId === "string") {
        stringLickIds.add(item.lickId);
      }
    }

    if (stringLickIds.size > 0) {
      console.log(
        "(NO $) [DEBUG][FullMixExport] Fetching lick data for string IDs:",
        Array.from(stringLickIds)
      );

      // Batch fetch all licks
      const lickFetchPromises = Array.from(stringLickIds).map(
        async (lickId) => {
          try {
            const response = await getLickById(lickId);
            if (response?.success && response?.data) {
              return { lickId, lickData: response.data };
            } else if (response?.data) {
              // Some APIs return data directly
              return { lickId, lickData: response.data };
            }
            return null;
          } catch (error) {
            console.error(
              `(NO $) [DEBUG][FullMixExport] Failed to fetch lick ${lickId}:`,
              error
            );
            return null;
          }
        }
      );

      const lickResults = await Promise.all(lickFetchPromises);
      for (const result of lickResults) {
        if (result && result.lickData) {
          lickIdMap.set(result.lickId, result.lickData);
        }
      }

      console.log(
        "(NO $) [DEBUG][FullMixExport] Fetched lick data:",
        lickIdMap.size,
        "out of",
        stringLickIds.size
      );

      // Populate items with fetched lick data
      for (const track of normalizedTracks) {
        for (const item of track.items || []) {
          if (item.lickId && typeof item.lickId === "string") {
            const lickData = lickIdMap.get(item.lickId);
            if (lickData) {
              // Convert string lickId to object structure
              item.lickId = {
                _id: lickData._id || lickData.id || item.lickId,
                audioUrl: lickData.audioUrl || lickData.audio_url || null,
                waveformData: lickData.waveformData,
                duration: lickData.duration,
              };
            }
          }
        }
      }
    }

    const buffer = await Tone.Offline(async ({ transport }) => {
      const players = [];

      // Schedule all clips from tracks for offline render
      for (const track of normalizedTracks) {
        if (track.muted) {
          console.log(
            "(NO $) [DEBUG][FullMixExport] Skipping muted track:",
            track._id || track.id,
            track.trackName || "unnamed"
          );
          continue;
        }

        const trackVolume = track.volume || 1;
        const soloMultiplier = track.solo ? 1 : 0.7;
        const effectiveVolume = trackVolume * soloMultiplier;

        console.log("(NO $) [DEBUG][FullMixExport] Processing track:", {
          trackId: track._id || track.id,
          trackName: track.trackName || "unnamed",
          trackType: track.trackType,
          isBackingTrack: track.isBackingTrack,
          itemCount: (track.items || []).length,
          muted: track.muted,
          volume: trackVolume,
          effectiveVolume,
        });

        // Special logging for backing track items
        if (track.isBackingTrack) {
          console.log("(NO $) [DEBUG][FullMixExport] BACKING TRACK ITEMS:", {
            trackId: track._id || track.id,
            trackName: track.trackName,
            itemCount: (track.items || []).length,
            items: (track.items || []).map((item) => ({
              id: item._id || item.id,
              type: item.type,
              chordName: item.chordName,
              audioUrl: item.audioUrl || item.audio_url || null,
              startTime: item.startTime,
              duration: item.duration,
              offset: item.offset,
              hasAudioUrl: !!(item.audioUrl || item.audio_url),
              allKeys: Object.keys(item),
            })),
          });
        }

        for (const item of track.items || []) {
          const clipId = item._id || item.id;
          const clipStart = item.startTime || 0;

          // Extract audioUrl from various possible locations
          let audioUrl = item.audioUrl || item.audio_url || null;

          // Skip virtual chords (no real audio) - only skip if it's a virtual chord ID AND has no audio
          // Real backing track items have type "chord" but have audioUrl, so we include those
          if (
            typeof clipId === "string" &&
            clipId.startsWith("chord-") &&
            !audioUrl
          ) {
            console.log(
              "(NO $) [DEBUG][FullMixExport] Skipping virtual chord (no audio):",
              clipId
            );
            continue;
          }

          // Handle lickId - could be populated object or string ID
          if (!audioUrl && item.lickId) {
            if (typeof item.lickId === "object" && item.lickId !== null) {
              // Populated object
              audioUrl = item.lickId.audioUrl || item.lickId.audio_url || null;
            } else if (typeof item.lickId === "string") {
              // String ID - not populated, can't access audioUrl
              console.log(
                "(NO $) [DEBUG][FullMixExport] lickId is string (not populated):",
                {
                  clipId,
                  lickId: item.lickId,
                }
              );
            }
          }

          if (!audioUrl) {
            // Deep inspection of lickId structure
            let lickIdInspection = null;
            if (item.lickId) {
              const isArray = Array.isArray(item.lickId);
              const isObject =
                typeof item.lickId === "object" && item.lickId !== null;
              lickIdInspection = {
                type: typeof item.lickId,
                isArray,
                isObject,
                isNull: item.lickId === null,
                constructor: item.lickId?.constructor?.name,
                keys: isObject ? Object.keys(item.lickId) : null,
                length: isArray ? item.lickId.length : undefined,
                firstElement:
                  isArray && item.lickId.length > 0
                    ? item.lickId[0]
                    : undefined,
                rawValue: item.lickId,
                // Try to access common properties
                _id: item.lickId._id,
                audioUrl: item.lickId.audioUrl,
                audio_url: item.lickId.audio_url,
              };
            }

            console.log("(NO $) [DEBUG][FullMixExport] Item has no audioUrl:", {
              clipId,
              itemType: item.type,
              hasLickId: !!item.lickId,
              lickIdInspection,
              itemKeys: Object.keys(item),
              directAudioUrl: item.audioUrl || item.audio_url || null,
              // Log the full item for inspection
              fullItem: item,
            });
            continue;
          }

          try {
            const logData = {
              clipId,
              itemType: item.type,
              audioUrl: audioUrl.substring(0, 50) + "...",
              startTime: clipStart,
              duration: item.duration,
              offset: item.offset || 0,
              trackName: track.trackName || "unnamed",
              isBackingTrack: track.isBackingTrack,
            };

            // Extra logging for backing track items
            if (track.isBackingTrack) {
              logData.chordName = item.chordName;
              logData.fullAudioUrl = audioUrl;
              logData.itemDetails = {
                type: item.type,
                chordName: item.chordName,
                startTime: item.startTime,
                duration: item.duration,
                offset: item.offset,
              };
            }

            console.log(
              "(NO $) [DEBUG][FullMixExport] Scheduling clip:",
              logData
            );

            const player = new Tone.Player({
              url: audioUrl,
            }).toDestination();

            // Apply volume (convert gain to dB)
            player.volume.value = Tone.gainToDb(effectiveVolume);

            players.push(player);

            // Sync to transport and schedule
            const offset = item.offset || 0;
            const clipDuration = item.duration || 0;
            const playbackRate = item.playbackRate || 1;

            player.playbackRate = playbackRate;
            player.sync().start(clipStart, offset, clipDuration);
          } catch (error) {
            console.error(
              "[FullMixExport] Failed to prepare player for clip",
              clipId,
              error
            );
          }
        }
      }

      console.log("(NO $) [DEBUG][FullMixExport] Prepared players:", {
        projectId,
        playerCount: players.length,
        totalTracks: normalizedTracks.length,
        tracksProcessed: normalizedTracks.filter((t) => !t.muted).length,
        totalItems: normalizedTracks.reduce(
          (sum, t) => sum + (t.items?.length || 0),
          0
        ),
      });

      if (!players.length) {
        // Provide more helpful error message
        const totalItems = normalizedTracks.reduce(
          (sum, t) => sum + (t.items?.length || 0),
          0
        );
        const itemsWithAudio = normalizedTracks.reduce((sum, track) => {
          if (track.muted) return sum;
          return (
            sum +
            (track.items || []).filter((item) => {
              let audioUrl = item.audioUrl || item.audio_url || null;

              // Handle lickId - could be populated object or string ID
              if (!audioUrl && item.lickId) {
                if (typeof item.lickId === "object" && item.lickId !== null) {
                  audioUrl =
                    item.lickId.audioUrl || item.lickId.audio_url || null;
                }
              }

              return !!audioUrl;
            }).length
          );
        }, 0);

        // Provide more helpful error message based on what's missing
        const backingTracksMissing = normalizedTracks.filter(
          (t) => t.isBackingTrack && (t.items || []).length === 0
        );
        const lickItemsMissing = normalizedTracks.reduce((sum, track) => {
          if (track.muted) return sum;
          return (
            sum +
            (track.items || []).filter((item) => {
              // Items that should have audio but don't
              return (
                item.type === "lick" &&
                !item.audioUrl &&
                !item.audio_url &&
                !(
                  item.lickId &&
                  typeof item.lickId === "object" &&
                  (item.lickId.audioUrl || item.lickId.audio_url)
                )
              );
            }).length
          );
        }, 0);

        let errorMessage = `No audio clips were scheduled for export. Found ${totalItems} timeline items, but only ${itemsWithAudio} have audio URLs.`;

        if (backingTracksMissing.length > 0) {
          errorMessage += `\n\n- ${backingTracksMissing.length} backing track(s) have no items. Generate backing track audio first.`;
        }

        if (lickItemsMissing > 0) {
          errorMessage += `\n- ${lickItemsMissing} lick item(s) are missing audio URLs. Make sure your licks have audio files uploaded.`;
        }

        if (backingTracksMissing.length === 0 && lickItemsMissing === 0) {
          errorMessage +=
            "\n\nMake sure your timeline items have audio files or generate backing track audio first.";
        }

        throw new Error(errorMessage);
      }

      await Tone.loaded();

      transport.start();
    }, duration);

    console.log("[FullMixExport] Audio rendered, converting to WAV...");
    const wavBlob = audioBufferToWav(buffer);
    const file = new File([wavBlob], `project_full_${projectId}.wav`, {
      type: "audio/wav",
    });

    console.log("(NO $) [DEBUG][FullMixExport] Uploading via API...", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      projectId,
    });

    const uploadResponse = await uploadProjectAudioToServer(projectId, file);

    if (!uploadResponse?.success) {
      console.error("[FullMixExport] Upload failed:", uploadResponse);
      throw new Error(
        uploadResponse?.message || "Failed to upload audio to server"
      );
    }

    const uploadData = uploadResponse.data || {};
    const audioUrl =
      uploadData.cloudinaryUrl || uploadData.secure_url || uploadData.url;

    if (!audioUrl) {
      throw new Error("Upload succeeded but no URL returned from server");
    }

    const uploadedDuration =
      typeof uploadData.duration === "number" && uploadData.duration > 0
        ? uploadData.duration
        : duration;

    console.log("[FullMixExport] Generating waveform data...");
    const waveformData = generateWaveformFromBuffer(buffer);

    console.log("[FullMixExport] Complete!", audioUrl);
    return {
      success: true,
      audioUrl,
      waveformData,
      duration: uploadedDuration,
    };
  } catch (error) {
    console.error("[FullMixExport] Failed:", error);
    // (NO $) [DEBUG] log with flattened error details for easier reporting
    console.log("(NO $) [DEBUG][FullMixExport][Error]", {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
    });
    throw error;
  }
};
