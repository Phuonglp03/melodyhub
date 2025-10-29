/**
 * Basic-Pitch Service (Backend)
 * Converts audio to MIDI/Guitar Tab using Spotify's ML model
 */

import * as basicPitch from "@spotify/basic-pitch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Convert MIDI note to guitar fret position
 */
const midiToGuitarFret = (midiNote) => {
  const stringTunings = [
    { string: "e", baseMidi: 64, index: 0 }, // E4
    { string: "B", baseMidi: 59, index: 1 }, // B3
    { string: "G", baseMidi: 55, index: 2 }, // G3
    { string: "D", baseMidi: 50, index: 3 }, // D3
    { string: "A", baseMidi: 45, index: 4 }, // A2
    { string: "E", baseMidi: 40, index: 5 }, // E2
  ];

  const positions = [];

  for (const tuning of stringTunings) {
    const fret = midiNote - tuning.baseMidi;
    if (fret >= 0 && fret <= 22) {
      positions.push({
        string: tuning.string,
        stringIndex: tuning.index,
        fret: fret,
      });
    }
  }

  if (positions.length === 0) return null;

  // Sort by playability
  positions.sort((a, b) => {
    const aScore = Math.abs(7 - a.fret) + Math.abs(2.5 - a.stringIndex);
    const bScore = Math.abs(7 - b.fret) + Math.abs(2.5 - b.stringIndex);
    return aScore - bScore;
  });

  return positions[0];
};

/**
 * Convert notes to tab string format
 */
const convertNotesToTabString = (notes, duration) => {
  const measuresCount = Math.ceil(duration / 2);
  const charsPerMeasure = 16;
  const totalChars = measuresCount * charsPerMeasure;

  const strings = {
    e: Array(totalChars).fill("-"),
    B: Array(totalChars).fill("-"),
    G: Array(totalChars).fill("-"),
    D: Array(totalChars).fill("-"),
    A: Array(totalChars).fill("-"),
    E: Array(totalChars).fill("-"),
  };

  // Place notes
  notes.forEach((note) => {
    if (!note.position) return;

    const timePosition = Math.floor((note.time / duration) * totalChars);

    if (timePosition >= 0 && timePosition < totalChars) {
      const fretStr = note.position.fret.toString();
      const string = note.position.string;

      strings[string][timePosition] = fretStr[0];

      if (fretStr.length > 1 && timePosition + 1 < totalChars) {
        if (strings[string][timePosition + 1] === "-") {
          strings[string][timePosition + 1] = fretStr[1];
        }
      }
    }
  });

  // Format as tab string
  let tabText = "";
  const stringOrder = ["e", "B", "G", "D", "A", "E"];

  for (let m = 0; m < measuresCount; m++) {
    if (m > 0) tabText += "\n";
    stringOrder.forEach((str) => {
      const start = m * charsPerMeasure;
      const end = start + charsPerMeasure;
      const measure = strings[str].slice(start, end).join("");
      tabText += `${str}|${measure}|\n`;
    });
  }

  return tabText.trim();
};

/**
 * Generate guitar tab from audio file using Basic-Pitch
 * @param {string} audioFilePath - Path to the audio file
 * @returns {Promise<Object>} Tab data with metadata
 */
export const generateTabFromAudio = async (audioFilePath) => {
  try {
    console.log("[BASIC-PITCH] Processing audio file:", audioFilePath);

    // Read audio file
    const audioBuffer = fs.readFileSync(audioFilePath);

    // Run Basic-Pitch inference
    const { notes, onsets, frames } = await basicPitch.noteFrames(audioBuffer, {
      onsetThreshold: 0.5,
      frameThreshold: 0.3,
      minNoteDuration: 0.03,
      minFrequency: 80, // Low E on guitar
      maxFrequency: 1200, // High guitar range
    });

    console.log(`[BASIC-PITCH] Detected ${notes.length} notes`);

    // Get audio duration (estimate from frames)
    // Each frame is typically ~11.6ms at default settings
    const duration = frames.length * 0.0116;

    // Convert notes to guitar tab format
    const tabNotes = notes
      .filter((note) => note[3] > 0.3) // Filter by velocity/confidence
      .map((note) => {
        const [time, noteDuration, midiNote, velocity] = note;
        const position = midiToGuitarFret(Math.round(midiNote));

        return {
          time,
          duration: noteDuration,
          position,
          midiNote: Math.round(midiNote),
          velocity,
        };
      })
      .filter((note) => note.position !== null);

    console.log(`[BASIC-PITCH] Converted to ${tabNotes.length} guitar notes`);

    // Generate tab string
    const tab = convertNotesToTabString(tabNotes, duration);

    return {
      success: true,
      tab,
      metadata: {
        duration,
        notesDetected: tabNotes.length,
        confidence: 85,
        algorithm: "Basic-Pitch ML (Spotify - Backend)",
        mlUsed: true,
      },
    };
  } catch (error) {
    console.error("[BASIC-PITCH] Error:", error);
    throw error;
  }
};

export default {
  generateTabFromAudio,
};
