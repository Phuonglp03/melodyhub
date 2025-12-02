// src/services/studioExportService.js
import * as Tone from "tone";
import { scheduleProject, calculateDuration } from "../utils/audioScheduler";
import { normalizeTracks } from "../utils/timelineHelpers";
import api from "./api";

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
 * Export project to WAV and upload to Cloudinary
 * @param {Object} projectState - Full studio state { song, bandSettings }
 * @param {string} projectId - Project ID
 * @returns {Promise<{success: boolean, audioUrl?: string, waveformData?: number[], duration?: number}>}
 */
// NOTE: Legacy backing-only export (saveProjectWithAudio) has been removed.

/**
 * Fetch full project timeline (tracks + items) for export
 * @param {string} projectId
 */
const fetchProjectTimelineForExport = async (projectId) => {
  const response = await api.get(`/projects/${projectId}/export-timeline`);

  return response.data;
};

/**
 * Export full studio project (all tracks + timeline items) via Tone.Offline
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

    // Attach items to tracks
    const tracksWithItems = rawTracks.map((track) => {
      const key = String(track._id || track.id);
      return {
        ...track,
        items: itemsByTrackId[key] || [],
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
      const audioUrl =
        item.audioUrl ||
        item.audio_url ||
        item.lickId?.audioUrl ||
        item.lickId?.audio_url ||
        null;
      return !!audioUrl;
    });

    console.log("(NO $) [DEBUG][FullMixExport] Timeline summary:", {
      projectId,
      projectTitle: project?.title,
      trackCount: normalizedTracks.length,
      itemCount: allItems.length,
      itemsWithAudio: itemsWithAudio.length,
      itemsWithoutAudio: allItems.length - itemsWithAudio.length,
      durationSeconds: duration,
    });

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

    const buffer = await Tone.Offline(async ({ transport }) => {
      const players = [];

      // Schedule all clips from tracks for offline render
      for (const track of normalizedTracks) {
        if (track.muted) continue;

        const trackVolume = track.volume || 1;
        const soloMultiplier = track.solo ? 1 : 0.7;
        const effectiveVolume = trackVolume * soloMultiplier;

        for (const item of track.items || []) {
          const clipId = item._id || item.id;
          const clipStart = item.startTime || 0;

          // Skip virtual chords (no real audio)
          if (typeof clipId === "string" && clipId.startsWith("chord-")) {
            console.log("(NO $) [DEBUG][FullMixExport] Skipping virtual chord:", clipId);
            continue;
          }

          const audioUrl =
            item.audioUrl ||
            item.audio_url ||
            item.lickId?.audioUrl ||
            item.lickId?.audio_url ||
            null;

          if (!audioUrl) {
            console.log("(NO $) [DEBUG][FullMixExport] Item has no audioUrl:", {
              clipId,
              itemType: item.type,
              hasLickId: !!item.lickId,
              lickIdStructure: item.lickId ? Object.keys(item.lickId) : null,
              itemKeys: Object.keys(item),
            });
            continue;
          }

          try {
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
        totalItems: normalizedTracks.reduce((sum, t) => sum + (t.items?.length || 0), 0),
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
              const audioUrl =
                item.audioUrl ||
                item.audio_url ||
                item.lickId?.audioUrl ||
                item.lickId?.audio_url;
              return !!audioUrl;
            }).length
          );
        }, 0);

        throw new Error(
          `No audio clips were scheduled for export. Found ${totalItems} timeline items, but only ${itemsWithAudio} have audio URLs. Make sure your licks have audio files uploaded, or generate backing track audio first.`
        );
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
