// src/services/projectExportService.js
import * as Tone from "tone";
import { normalizeTracks } from "../utils/timelineHelpers";
import api from "./api";
import { getLickById } from "./user/lickService";

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

    const { project, timeline } = timelineResponse.data;
    const rawTracks = timeline?.tracks || [];
    const itemsByTrackId = timeline?.itemsByTrackId || {};

    // Debug: Log itemsByTrackId keys to see what we received
    console.log(
      "(NO $) [DEBUG][FullMixExport] Items by trackId keys:",
      Object.keys(itemsByTrackId)
    );
    console.log(
      "(NO $) [DEBUG][FullMixExport] Items by trackId summary:",
      Object.entries(itemsByTrackId).map(([key, items]) => ({
        trackId: key,
        itemCount: items.length,
        itemTypes: items.map((i) => i.type),
        hasAudioUrls: items.filter((i) => i.audioUrl || i.lickId?.audioUrl)
          .length,
      }))
    );

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

    const normalizedTracks = normalizeTracks(tracksWithItems);

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

    console.log("(NO $) [DEBUG][FullMixExport] Timeline summary:", {
      projectId,
      projectTitle: project?.title,
      trackCount: normalizedTracks.length,
      itemCount: allItems.length,
      itemsWithAudio: itemsWithAudio.length,
      itemsWithoutAudio: allItems.length - itemsWithAudio.length,
      backingTracksCount: backingTracks.length,
      backingTracksWithNoItems: backingTracksWithNoItems.length,
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
            console.log("(NO $) [DEBUG][FullMixExport] Scheduling clip:", {
              clipId,
              itemType: item.type,
              audioUrl: audioUrl.substring(0, 50) + "...",
              startTime: clipStart,
              duration: item.duration,
              offset: item.offset || 0,
              trackName: track.trackName || "unnamed",
              isBackingTrack: track.isBackingTrack,
            });

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
