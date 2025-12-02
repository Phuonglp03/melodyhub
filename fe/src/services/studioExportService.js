// src/services/studioExportService.js
import * as Tone from "tone";
import { scheduleProject, calculateDuration } from "../utils/audioScheduler";
import { uploadAudio } from "./cloudinaryService";

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

/**
 * Export project to WAV and upload to Cloudinary
 * @param {Object} projectState - Full studio state { song, bandSettings }
 * @param {string} projectId - Project ID
 * @returns {Promise<{success: boolean, audioUrl?: string, waveformData?: number[], duration?: number}>}
 */
export const saveProjectWithAudio = async (projectState, projectId) => {
  try {
    console.log("[Export] Starting audio render...");
    const duration = calculateDuration(projectState.song);

    // Create offline context and render
    const buffer = await Tone.Offline(async ({ transport }) => {
      // Create fresh samplers for offline context
      // Note: In production, you'd want to reuse loaded buffers from SampleManager
      const piano = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
      }).toDestination();

      const bass = new Tone.MonoSynth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.4 },
      }).toDestination();

      const drums = {
        kick: new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 6,
        }).toDestination(),
        snare: new Tone.NoiseSynth({
          noise: { type: "white" },
          envelope: { attack: 0.001, decay: 0.2, sustain: 0 },
        }).toDestination(),
        hihat: new Tone.MetalSynth({
          frequency: 200,
          envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4000,
          octaves: 1.5,
        }).toDestination(),
      };
      drums.hihat.volume.value = -10;

      // Load lick players (if any)
      const licks = {};
      const allLicks = projectState.song.sections.flatMap((s) => s.licks || []);
      for (const lick of allLicks) {
        if (lick.audioUrl && (lick.id || lick.lickId)) {
          try {
            const player = new Tone.Player(lick.audioUrl).toDestination();
            player.volume.value = -3;
            await player.load();
            licks[lick.id || lick.lickId] = player;
          } catch (err) {
            console.warn(`[Export] Failed to load lick ${lick.id}:`, err);
          }
        }
      }

      // Wait for all samples to load
      await Tone.loaded();

      // Schedule the music
      // Ensure bandSettings is included in song data
      const songDataWithSettings = {
        ...projectState.song,
        bandSettings: projectState.bandSettings || {
          volumes: { drums: 0.8, bass: 0.8, piano: 0.8 },
          mutes: { drums: false, bass: false, piano: false },
        },
      };
      scheduleProject(transport, songDataWithSettings, {
        piano,
        bass,
        drums,
        licks,
      });

      transport.start();
    }, duration);

    console.log("[Export] Audio rendered, converting to WAV...");
    const wavBlob = audioBufferToWav(buffer);
    const file = new File([wavBlob], `project_${projectId}.wav`, {
      type: "audio/wav",
    });

    console.log("[Export] Uploading to Cloudinary...", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });
    // Upload directly to Cloudinary using the cloudinaryService
    // Note: uploadAudio already sets resource_type to "video" and default folder
    // We just need to override the folder for project-specific organization
    const uploadResult = await uploadAudio(file, {
      folder: `projects/${projectId}`,
    });

    if (!uploadResult.success) {
      console.error("[Export] Upload failed:", uploadResult);
      throw new Error(
        uploadResult.error || "Failed to upload audio to Cloudinary"
      );
    }

    const audioUrl = uploadResult.data?.secure_url || uploadResult.data?.url;

    if (!audioUrl) {
      throw new Error("Upload succeeded but no URL returned from Cloudinary");
    }

    console.log("[Export] Generating waveform data...");
    // Generate waveform data from audio buffer
    const waveformData = generateWaveformFromBuffer(buffer);

    console.log("[Export] Complete!", audioUrl);
    return { success: true, audioUrl, waveformData, duration };
  } catch (error) {
    console.error("[Export] Failed:", error);
    throw error;
  }
};
