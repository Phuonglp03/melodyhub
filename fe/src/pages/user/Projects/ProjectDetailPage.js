import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaMusic,
  FaTrash,
  FaPlus,
  FaSearch,
  FaTimes,
  FaEllipsisV,
  FaPalette,
  FaPen,
  FaArrowUp,
  FaArrowDown,
  FaUndo,
  FaRedo,
  FaPlay,
  FaPause,
} from "react-icons/fa";
import { RiPulseFill } from "react-icons/ri";
import {
  getCommunityLicks,
  playLickAudio,
} from "../../../services/user/lickService";
import { getChords } from "../../../services/chordService";
import { useSelector } from "react-redux";
import { fetchTagsGrouped } from "../../../services/user/tagService";
import {
  getProjectById,
  updateProject,
  updateTimelineItem,
  bulkUpdateTimelineItems,
  deleteProject as deleteProjectApi,
  addLickToTimeline,
  deleteTimelineItem,
  updateChordProgression as updateChordProgressionAPI,
  addTrack,
  updateTrack,
  deleteTrack,
  getInstruments,
  getRhythmPatterns,
  generateBackingTrack as generateBackingTrackAPI,
  generateAIBackingTrack,
} from "../../../services/user/projectService";
import BackingTrackPanel from "../../../components/BackingTrackPanel";
import MidiEditor from "../../../components/MidiEditor";
import AIGenerationLoadingModal from "../../../components/AIGenerationLoadingModal";
import MidiClip from "../../../components/MidiClip";
// Note: Tone.js is now accessed through useAudioEngine hook instead of direct import
// This follows the rule: "NEVER store Tone.js objects in Redux" - all audio objects
// are managed through the singleton audioEngine
import {
  parseMidiNotes,
  getMidiNotesForChord,
  midiToNoteName,
  midiToNoteNameNoOctave,
} from "../../../utils/midi";
import { useAudioEngine } from "../../../hooks/useAudioEngine";
import { useAudioScheduler } from "../../../hooks/useAudioScheduler";
import { AudioTransportControls } from "../../../components/audio";
import {
  normalizeKeyPayload,
  normalizeTimeSignaturePayload,
  getKeyDisplayName,
  getTimeSignatureDisplayName,
  clampSwingAmount,
} from "../../../utils/musicTheory";

const HISTORY_LIMIT = 50;
const MIN_CLIP_DURATION = 0.1;

const DEFAULT_FALLBACK_CHORDS = [
  { chordName: "C", midiNotes: [60, 64, 67] },
  { chordName: "G", midiNotes: [67, 71, 74] },
  { chordName: "Am", midiNotes: [69, 72, 76] },
  { chordName: "F", midiNotes: [65, 69, 72] },
  { chordName: "Dm7", midiNotes: [62, 65, 69, 72] },
  { chordName: "Em7", midiNotes: [64, 67, 71, 74] },
  { chordName: "Gmaj7", midiNotes: [67, 71, 74, 78] },
  { chordName: "Cmaj7", midiNotes: [60, 64, 67, 71] },
];

const TRACK_COLOR_PALETTE = [
  "#6366f1",
  "#8b5cf6",
  "#0ea5e9",
  "#10b981",
  "#f97316",
  "#f43f5e",
  "#facc15",
  "#ec4899",
];
const TIME_SIGNATURES = ["4/4", "3/4", "6/8", "2/4"];
const KEY_OPTIONS = [
  "C Major",
  "G Major",
  "D Major",
  "A Major",
  "E Major",
  "B Major",
  "F Major",
  "Bb Major",
  "Eb Major",
  "C Minor",
  "G Minor",
  "D Minor",
  "A Minor",
  "E Minor",
];

const cloneTracksForHistory = (sourceTracks = []) =>
  sourceTracks.map((track) => ({
    ...track,
    items: (track.items || []).map((item) => ({ ...item })),
  }));

const cloneChordsForHistory = (sourceChords = []) =>
  sourceChords.map((entry) =>
    typeof entry === "string" ? entry : { ...entry }
  );

const formatLabelValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((entry) => formatLabelValue(entry))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") {
    const candidate =
      value.displayName ||
      value.name ||
      value.title ||
      value.label ||
      value.instrument ||
      value.instrumentName ||
      value.patternName ||
      value.description ||
      value.type;
    if (candidate) return String(candidate);
  }
  return "";
};

const formatTrackTitle = (title) => {
  const raw = formatLabelValue(title) || "Track";
  const trimmed = raw.trim();
  const cleaned = trimmed.replace(/^[\d\s._-]+/, "").trim();
  return cleaned || trimmed || "Track";
};

const createDefaultPatternSteps = (length = 8) => {
  const clamped = Math.max(4, Math.min(length, 32));
  return Array.from({ length: clamped }, (_, idx) =>
    idx % 4 === 0 ? 0.95 : idx % 2 === 0 ? 0.55 : 0.2
  );
};

const candidatePatternKeys = [
  "steps",
  "sequence",
  "pattern",
  "patternData",
  "grid",
  "values",
  "hits",
  "data",
  "notes",
  "timeline",
];

const coercePatternArray = (raw) => {
  if (Array.isArray(raw)) return raw.flat(Infinity);
  if (typeof raw === "number" || typeof raw === "boolean") return [raw];
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return coercePatternArray(parsed);
    } catch {
      if (/^[01]+$/.test(trimmed)) {
        return trimmed.split("").map((char) => (char === "1" ? 1 : 0));
      }
      const tokens = trimmed.split(/[\s,|/-]+/).filter(Boolean);
      if (tokens.length) {
        return tokens
          .map((token) => Number(token))
          .filter((num) => !Number.isNaN(num));
      }
    }
    return [];
  }
  if (raw && typeof raw === "object") {
    for (const key of candidatePatternKeys) {
      if (raw[key] !== undefined) {
        const arr = coercePatternArray(raw[key]);
        if (arr.length) return arr;
      }
    }
    return [];
  }
  return [];
};

const normalizeRhythmStepValue = (step) => {
  if (typeof step === "boolean") return step ? 1 : 0;
  if (typeof step === "number") return step;
  if (typeof step === "string") {
    const num = Number(step);
    if (!Number.isNaN(num)) return num;
    return step === "x" || step === "X" ? 1 : 0;
  }
  if (step && typeof step === "object") {
    const numericKeys = [
      "velocity",
      "value",
      "intensity",
      "accent",
      "gain",
      "amount",
    ];
    for (const key of numericKeys) {
      if (typeof step[key] === "number") {
        return step[key];
      }
    }
    if (typeof step.active === "boolean") return step.active ? 1 : 0;
    if (typeof step.on === "boolean") return step.on ? 1 : 0;
  }
  return 0;
};

const clampStepValue = (value) => {
  if (!Number.isFinite(value)) return 0;
  if (value > 1) return Math.min(1, value / 127);
  if (value < 0) return 0;
  return value;
};

const normalizeRhythmSteps = (raw, fallbackLength = 0) => {
  const arr = coercePatternArray(raw);
  const normalized = arr
    .map((step) => normalizeRhythmStepValue(step))
    .map((value) => clampStepValue(value))
    .filter((_, idx) => idx < 128);

  if (normalized.length) {
    return normalized;
  }

  if (fallbackLength > 0) {
    return createDefaultPatternSteps(fallbackLength);
  }

  return [];
};

const normalizeRhythmPattern = (pattern) => {
  if (!pattern) return null;
  const fallbackLength =
    (Array.isArray(pattern.steps) && pattern.steps.length) ||
    (Array.isArray(pattern.sequence) && pattern.sequence.length) ||
    Number(pattern.stepCount) ||
    Number(pattern.subdivisionCount) ||
    Number(pattern.length) ||
    Number(pattern.beatCount) ||
    8;

  const sourceCandidates = [
    pattern.steps,
    pattern.sequence,
    pattern.patternData,
    pattern.pattern,
    pattern.grid,
    pattern.values,
    pattern.hits,
    pattern.timeline,
    pattern.midiPreview,
    pattern.midiNotes,
  ];

  let steps = [];
  for (const source of sourceCandidates) {
    const parsed = normalizeRhythmSteps(source);
    if (parsed.length) {
      steps = parsed;
      break;
    }
  }

  if (!steps.length) {
    steps = createDefaultPatternSteps(fallbackLength);
  }

  return {
    ...pattern,
    visualSteps: steps,
    visualStepCount: steps.length,
    displayName: pattern.name || pattern.title || pattern.slug || "Rhythm",
  };
};

const registerPatternLookupKey = (map, key, pattern) => {
  if (key === null || key === undefined) return;
  if (typeof key === "object") return;
  const strKey = String(key).trim();
  if (!strKey) return;
  map[strKey] = pattern;
  map[strKey.toLowerCase()] = pattern;
};

const lookupPatternFromMap = (map, key) => {
  if (key === null || key === undefined) return null;
  if (typeof key === "object") return null;
  const strKey = String(key).trim();
  if (!strKey) return null;
  return map[strKey] || map[strKey.toLowerCase()] || null;
};

const formatTransportTime = (seconds = 0) => {
  const totalSeconds = Math.max(0, seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  const tenths = Math.floor((totalSeconds % 1) * 10);
  return `${minutes.toString().padStart(2, "0")}:${secs}.${tenths}`;
};

/**
 * Derive detailed MIDI events for a chord block so we can visualize and describe it consistently.
 */
const getChordMidiEvents = (
  item,
  fallbackDuration = 0,
  patternSteps = null
) => {
  if (!item) return [];

  if (Array.isArray(item.customMidiEvents) && item.customMidiEvents.length) {
    return item.customMidiEvents;
  }

  const duration = fallbackDuration || item.duration || 0;
  if (Array.isArray(item.midiNotes) && item.midiNotes.length) {
    const chordMidi = item.midiNotes.map((pitch) => ({
      pitch: Number(pitch),
      startTime: 0,
      duration,
    }));
    if (patternSteps?.length && duration > 0) {
      const generated = generatePatternMidiEvents(
        chordMidi.map((event) => event.pitch),
        patternSteps,
        duration
      );
      if (generated.length) return generated;
    }
    return chordMidi;
  }

  const fallbackNotes = getMidiNotesForChord(item.chordName || item.chord);
  if (!fallbackNotes.length) return [];

  if (patternSteps?.length && duration > 0) {
    const generated = generatePatternMidiEvents(
      fallbackNotes,
      patternSteps,
      duration
    );
    if (generated.length) return generated;
  }

  return fallbackNotes.map((pitch) => ({
    pitch,
    startTime: 0,
    duration,
  }));
};

const generatePatternMidiEvents = (
  pitches = [],
  patternSteps = [],
  totalDuration = 0
) => {
  if (!pitches.length || !patternSteps.length || !totalDuration) return [];
  const stepDuration = Math.max(
    MIN_CLIP_DURATION,
    totalDuration / patternSteps.length
  );
  const events = [];

  patternSteps.forEach((value, index) => {
    if (!value || value <= 0) return;
    const startTime = index * stepDuration;
    const duration = Math.max(MIN_CLIP_DURATION, stepDuration * 0.85);
    const velocity = Math.max(0.1, Math.min(1, value));
    pitches.forEach((pitch) => {
      events.push({
        pitch: Number(pitch),
        startTime,
        duration,
        velocity,
      });
    });
  });

  return events;
};

const deriveRhythmGrid = (
  events = [],
  totalDuration = 0,
  fallbackSteps = [],
  preferredLength = 0
) => {
  const stepCount =
    preferredLength ||
    (fallbackSteps?.length
      ? fallbackSteps.length
      : Math.min(32, Math.max(8, Math.round(totalDuration * 2))));

  if (!events.length || !totalDuration || !stepCount) {
    return fallbackSteps || [];
  }

  const grid = Array(stepCount).fill(0);
  const stepDuration = totalDuration / stepCount;

  events.forEach((event) => {
    const start = Math.max(0, Number(event.startTime) || 0);
    const duration = Math.max(
      MIN_CLIP_DURATION,
      Number(event.duration) || stepDuration
    );
    const end = Math.min(totalDuration, start + duration);
    let startIndex = Math.floor(start / stepDuration);
    let endIndex = Math.floor(end / stepDuration);
    if (endIndex < startIndex) endIndex = startIndex;
    for (let i = startIndex; i <= endIndex && i < stepCount; i += 1) {
      const overlapStart = Math.max(start, i * stepDuration);
      const overlapEnd = Math.min(end, (i + 1) * stepDuration);
      const proportion = Math.max(0, overlapEnd - overlapStart) / stepDuration;
      const velocity = Number(event.velocity) || 0.6;
      grid[i] = Math.max(grid[i], 0.2 + proportion * velocity);
    }
  });

  return grid;
};

/**
 * Get chord degree in a key (I, ii, iii, IV, V, vi, vii°, bII, #IV, etc.)
 */
const getChordDegree = (chordName, key) => {
  if (!chordName || !key) return null;

  // Parse key (e.g., "C Major", "A Minor", "Bb Major")
  const keyMatch = key.match(/^([A-G][#b]?)\s*(Major|Minor|maj|min)$/i);
  if (!keyMatch) return null;

  const keyRoot = keyMatch[1];
  const isMinor = /minor|min/i.test(keyMatch[2]);

  // Parse chord root (e.g., "Am" -> "A", "C#maj7" -> "C#", "Bb7" -> "Bb")
  const chordMatch = chordName.match(/^([A-G][#b]?)/);
  if (!chordMatch) return null;

  const chordRoot = chordMatch[1];

  // Convert all note names to semitone indices (0-11)
  const noteToIndex = (note) => {
    const noteMap = {
      C: 0,
      "C#": 1,
      Db: 1,
      D: 2,
      "D#": 3,
      Eb: 3,
      E: 4,
      F: 5,
      "F#": 6,
      Gb: 6,
      G: 7,
      "G#": 8,
      Ab: 8,
      A: 9,
      "A#": 10,
      Bb: 10,
      B: 11,
    };
    return noteMap[note] !== undefined ? noteMap[note] : null;
  };

  const keyIndex = noteToIndex(keyRoot);
  const chordIndex = noteToIndex(chordRoot);

  if (keyIndex === null || chordIndex === null) return null;

  // Calculate semitone difference from key root
  let semitoneDiff = (chordIndex - keyIndex + 12) % 12;

  // Diatonic scale degrees (major and minor)
  const majorScaleDegrees = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B
  const minorScaleDegrees = [0, 2, 3, 5, 7, 8, 10]; // C, D, Eb, F, G, Ab, Bb (natural minor)

  const scaleDegrees = isMinor ? minorScaleDegrees : majorScaleDegrees;

  // Diatonic degree names
  const majorDegreeNames = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
  const minorDegreeNames = ["i", "ii°", "III", "iv", "v", "VI", "VII"];
  const degreeNames = isMinor ? minorDegreeNames : majorDegreeNames;

  // Check if it's a diatonic chord
  const diatonicIndex = scaleDegrees.indexOf(semitoneDiff);
  if (diatonicIndex !== -1) {
    return degreeNames[diatonicIndex];
  }

  // Handle chromatic alterations (bII, #IV, etc.)
  // Find the closest diatonic degree
  let closestDiatonic = 0;
  let minDistance = 12;
  for (let i = 0; i < scaleDegrees.length; i++) {
    const distance = Math.min(
      Math.abs(semitoneDiff - scaleDegrees[i]),
      Math.abs(semitoneDiff - scaleDegrees[i] - 12),
      Math.abs(semitoneDiff - scaleDegrees[i] + 12)
    );
    if (distance < minDistance) {
      minDistance = distance;
      closestDiatonic = i;
    }
  }

  // Calculate the alteration (how many semitones away from diatonic)
  const diatonicSemitone = scaleDegrees[closestDiatonic];
  let alteration = semitoneDiff - diatonicSemitone;
  if (alteration > 6) alteration -= 12;
  if (alteration < -6) alteration += 12;

  // If it's exactly a diatonic note, return it (shouldn't happen here, but just in case)
  if (alteration === 0) {
    return degreeNames[closestDiatonic];
  }

  // Build the altered degree name
  const baseDegree = degreeNames[closestDiatonic];
  const isUppercase = baseDegree[0] === baseDegree[0].toUpperCase();
  const degreeNum = baseDegree.replace(/[°b#]/g, ""); // Remove existing symbols

  // Add flat or sharp prefix
  let prefix = "";
  if (alteration === -1) prefix = "b";
  else if (alteration === 1) prefix = "#";
  else if (alteration === -2) prefix = "bb";
  else if (alteration === 2) prefix = "##";
  else return null; // Too far from diatonic

  // Preserve case and special symbols
  const preservedSuffix = baseDegree.match(/[°b#]+$/)?.[0] || "";
  return prefix + degreeNum + preservedSuffix;
};

/**
 * Check if a chord belongs to a key
 */
const isChordInKey = (chordName, key) => {
  return getChordDegree(chordName, key) !== null;
};

/**
 * Check if a chord is a basic diatonic chord (no extensions, in key)
 */
const isBasicDiatonicChord = (chordName, key) => {
  if (!chordName || !key) return false;

  // Must be basic (no extensions)
  const name = chordName.toLowerCase();
  const complexPatterns =
    /(7|9|11|13|sus|add|maj7|dim7|aug7|m7|b5|#5|6|maj9|9th)/;
  if (complexPatterns.test(name)) return false;

  // Must be in key (diatonic)
  const degree = getChordDegree(chordName, key);
  if (!degree) return false;

  // Must be a diatonic degree (not chromatic like bII, #IV)
  // Diatonic degrees don't have b or # prefix (except for diminished which has °)
  const isDiatonic = !degree.startsWith("b") && !degree.startsWith("#");

  return isDiatonic;
};

/**
 * Get the 7 diatonic chords for a key with their correct qualities
 * Returns array of { root, quality } where quality is 'major', 'minor', or 'diminished'
 */
const getDiatonicChords = (key) => {
  if (!key) return [];

  const keyMatch = key.match(/^([A-G][#b]?)\s*(Major|Minor|maj|min)$/i);
  if (!keyMatch) return [];

  const keyRoot = keyMatch[1];
  const isMinor = /minor|min/i.test(keyMatch[2]);

  const noteToIndex = (note) => {
    const noteMap = {
      C: 0,
      "C#": 1,
      Db: 1,
      D: 2,
      "D#": 3,
      Eb: 3,
      E: 4,
      F: 5,
      "F#": 6,
      Gb: 6,
      G: 7,
      "G#": 8,
      Ab: 8,
      A: 9,
      "A#": 10,
      Bb: 10,
      B: 11,
    };
    return noteMap[note] !== undefined ? noteMap[note] : null;
  };

  const indexToNote = (index, preferSharp = true) => {
    const sharpNotes = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B",
    ];
    const flatNotes = [
      "C",
      "Db",
      "D",
      "Eb",
      "E",
      "F",
      "Gb",
      "G",
      "Ab",
      "A",
      "Bb",
      "B",
    ];
    return preferSharp ? sharpNotes[index] : flatNotes[index];
  };

  const keyIndex = noteToIndex(keyRoot);
  if (keyIndex === null) return [];

  // Diatonic scale intervals
  const majorIntervals = [0, 2, 4, 5, 7, 9, 11]; // I, II, III, IV, V, VI, VII
  const minorIntervals = [0, 2, 3, 5, 7, 8, 10]; // i, ii, III, iv, v, VI, VII

  const intervals = isMinor ? minorIntervals : majorIntervals;

  // Chord qualities for each degree
  // Major key: I(maj), ii(min), iii(min), IV(maj), V(maj), vi(min), vii°(dim)
  // Minor key: i(min), ii°(dim), III(maj), iv(min), v(min), VI(maj), VII(maj)
  const majorQualities = [
    "major",
    "minor",
    "minor",
    "major",
    "major",
    "minor",
    "diminished",
  ];
  const minorQualities = [
    "minor",
    "diminished",
    "major",
    "minor",
    "minor",
    "major",
    "major",
  ];

  const qualities = isMinor ? minorQualities : majorQualities;

  // Get chords with their roots and qualities
  const chords = intervals.map((interval, index) => {
    const noteIndex = (keyIndex + interval) % 12;
    const root = indexToNote(noteIndex);
    return { root, quality: qualities[index] };
  });

  return chords;
};

const normalizeChordLibraryItem = (chord) => ({
  ...chord,
  chordName: chord.chordName || chord.name || chord.label || "Chord",
  midiNotes: parseMidiNotes(chord.midiNotes),
  // Add note names for display
  noteNames: parseMidiNotes(chord.midiNotes).map(midiToNoteNameNoOctave),
});

const normalizeChordEntry = (entry) => {
  if (!entry) return null;
  if (typeof entry === "string") {
    return {
      chordId: null,
      chordName: entry,
      midiNotes: [],
      variation: null,
      rhythm: null,
      instrumentStyle: null,
    };
  }

  const chordName = entry.chordName || entry.name || entry.label || "";
  if (!chordName) {
    return null;
  }

  return {
    chordId: entry.chordId || entry._id || entry.id || null,
    chordName,
    midiNotes: parseMidiNotes(entry.midiNotes),
    variation: entry.variation || entry.variant || null,
    rhythmPatternId:
      entry.rhythmPatternId ||
      entry.rhythmPattern ||
      entry.patternId ||
      entry.rhythm?.patternId ||
      entry.rhythm?.id ||
      null,
    rhythmPatternName:
      entry.rhythmPatternName ||
      entry.rhythm?.name ||
      entry.patternName ||
      null,
    rhythmPatternSteps:
      entry.rhythmPatternSteps ||
      entry.rhythm?.steps ||
      entry.patternSteps ||
      null,
    rhythm: entry.rhythm || entry.pattern || null,
    instrumentStyle: entry.instrumentStyle || entry.timbre || null,
  };
};

const hydrateChordProgression = (rawProgression) => {
  if (!rawProgression) return [];

  let parsed = rawProgression;
  if (typeof rawProgression === "string") {
    try {
      parsed = JSON.parse(rawProgression);
    } catch {
      parsed = [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map(normalizeChordEntry)
    .filter((entry) => entry && entry.chordName);
};

const cloneChordEntry = (entry) => {
  const normalized = normalizeChordEntry(entry);
  return normalized ? { ...normalized } : null;
};

const normalizeMidiEvent = (event) => {
  if (!event) return null;
  const pitch = Number(event.pitch);
  const startTime = Number(event.startTime);
  const duration = Number(event.duration);
  const velocity = event.velocity === undefined ? 0.8 : Number(event.velocity);
  if (
    !Number.isFinite(pitch) ||
    pitch < 0 ||
    pitch > 127 ||
    !Number.isFinite(startTime) ||
    startTime < 0 ||
    !Number.isFinite(duration) ||
    duration < 0
  ) {
    return null;
  }
  const clampedVelocity = velocity >= 0 && velocity <= 1 ? velocity : 0.8;
  return {
    pitch,
    startTime,
    duration,
    velocity: clampedVelocity,
  };
};

const normalizeTimelineItem = (item) => {
  if (!item) return item;
  const startTime = Math.max(0, Number(item.startTime) || 0);
  const duration = Math.max(
    MIN_CLIP_DURATION,
    Number(item.duration) || MIN_CLIP_DURATION
  );
  const offset = Math.max(0, Number(item.offset) || 0);
  const sourceDurationRaw =
    Number(item.sourceDuration) ||
    Number(item.lickId?.duration) ||
    offset + duration;
  const sourceDuration = Math.max(sourceDurationRaw, offset + duration);

  return {
    ...item, // Preserve ALL original properties including lickId, waveformData, etc.
    startTime,
    duration,
    offset,
    sourceDuration,
    loopEnabled: Boolean(item.loopEnabled),
    playbackRate: Number(item.playbackRate) || 1,
    type:
      item.type || (item.lickId ? "lick" : item.audioUrl ? "chord" : "midi"),
    chordName: item.chordName || item.chord || null,
    rhythmPatternId: item.rhythmPatternId || null,
    isCustomized: Boolean(item.isCustomized),
    customMidiEvents: Array.isArray(item.customMidiEvents)
      ? item.customMidiEvents
          .map((event) => normalizeMidiEvent(event))
          .filter(Boolean)
      : [],
    // Explicitly preserve lickId and all its properties (including waveformData)
    lickId: item.lickId || null,
    // Preserve audio URL and waveform data for chord items with generated audio
    // Check multiple possible locations for audio URL (API might return it in different formats)
    audioUrl:
      item.audioUrl ||
      item.audio_url ||
      item.lickId?.audioUrl ||
      item.lickId?.audio_url ||
      null,
    waveformData:
      item.waveformData ||
      item.waveform_data ||
      item.lickId?.waveformData ||
      item.lickId?.waveform_data ||
      null,
  };
};

const getChordIndexFromId = (itemId) => {
  if (typeof itemId !== "string") return null;
  if (!itemId.startsWith("chord-")) return null;
  const parts = itemId.split("-");
  const index = parseInt(parts[1], 10);
  return Number.isNaN(index) ? null : index;
};

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  const [project, setProject] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingTimeline, setIsSavingTimeline] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1); // Timeline zoom multiplier
  const [workspaceScale, setWorkspaceScale] = useState(0.9); // Overall UI scale
  const [selectedItem, setSelectedItem] = useState(null);
  const [focusedClipId, setFocusedClipId] = useState(null);
  const [isDraggingItem, setIsDraggingItem] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, trackId: null });
  const [resizeState, setResizeState] = useState(null);
  const [draggedLick, setDraggedLick] = useState(null);
  const [draggedChord, setDraggedChord] = useState(null);
  const [dragOverTrack, setDragOverTrack] = useState(null);
  const [dragOverPosition, setDragOverPosition] = useState(null);
  const [selectedTrackId, setSelectedTrackId] = useState(null); // New state for selected track

  // UI State
  const [activeTab, setActiveTab] = useState("lick-library"); // "lick-library", "midi-editor", "instrument"
  const [sidePanelOpen, setSidePanelOpen] = useState(true); // Bottom panel visibility
  const [sidePanelWidth, setSidePanelWidth] = useState(450); // Bottom panel height (resizable)
  const [chordLibraryPanelOpen, setChordLibraryPanelOpen] = useState(true); // Right chord library panel visibility
  const [chordLibraryPanelWidth, setChordLibraryPanelWidth] = useState(280); // Right panel width (resizable)
  const [selectedLick, setSelectedLick] = useState(null);
  const [showLickLibrary, setShowLickLibrary] = useState(true);
  const [lickSearchTerm, setLickSearchTerm] = useState("");
  const [availableLicks, setAvailableLicks] = useState([]);
  const [loadingLicks, setLoadingLicks] = useState(false);

  // Tag filters for lick search - all 6 categories from upload page
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [selectedType, setSelectedType] = useState(null); // Type (Instrument)
  const [selectedEmotional, setSelectedEmotional] = useState(null); // Emotional (Mood)
  const [selectedTimbre, setSelectedTimbre] = useState(null);
  const [selectedArticulation, setSelectedArticulation] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);

  // Tag groups from database
  const [tagGroups, setTagGroups] = useState({});
  const [activeTagDropdown, setActiveTagDropdown] = useState(null); // which dropdown is open
  const tagDropdownRef = useRef(null);

  // Chord progression - now stored as backing track items
  const [chordProgression, setChordProgression] = useState([]);
  const [backingTrack, setBackingTrack] = useState(null); // The backing track that holds chords
  const [chordLibrary, setChordLibrary] = useState([]);
  const [loadingChords, setLoadingChords] = useState(false);
  const [chordLibraryError, setChordLibraryError] = useState(null);
  const [showComplexChords, setShowComplexChords] = useState(false);
  const [chordLibraryTotal, setChordLibraryTotal] = useState(0);
  const [selectedKeyFilter, setSelectedKeyFilter] = useState(null); // null = all keys, or specific key string
  const [lickPage, setLickPage] = useState(1);
  const [lickHasMore, setLickHasMore] = useState(true);
  const LICKS_PER_PAGE = 10; // Reduced initial load to prevent crashes
  const [playingLickId, setPlayingLickId] = useState(null);
  const [lickAudioRefs, setLickAudioRefs] = useState({});
  const [lickProgress, setLickProgress] = useState({});

  // Generate all keys (12 major + 12 minor)
  const allKeys = useMemo(() => {
    const notes = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B",
    ];
    const keys = [];
    notes.forEach((note) => {
      keys.push(`${note} Major`);
      keys.push(`${note} Minor`);
    });
    return keys;
  }, []);

  // Instruments
  const [instruments, setInstruments] = useState([]);
  const [loadingInstruments, setLoadingInstruments] = useState(false);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState(null);
  const resolvedBackingInstrumentId = useMemo(
    () => selectedInstrumentId || project?.backingInstrumentId || null,
    [selectedInstrumentId, project?.backingInstrumentId]
  );
  const instrumentHighlightId = useMemo(() => {
    if (!selectedTrackId) return resolvedBackingInstrumentId;
    const targetTrack = tracks.find((t) => t._id === selectedTrackId);
    if (!targetTrack) return null;
    if (targetTrack.isBackingTrack || targetTrack.trackType === "backing") {
      return resolvedBackingInstrumentId;
    }
    return targetTrack.instrument || null;
  }, [selectedTrackId, tracks, resolvedBackingInstrumentId]);

  // Rhythm Patterns
  const [rhythmPatterns, setRhythmPatterns] = useState([]);
  const [loadingRhythmPatterns, setLoadingRhythmPatterns] = useState(false);
  const [selectedRhythmPatternId, setSelectedRhythmPatternId] = useState(null);
  const rhythmPatternLookup = useMemo(() => {
    const map = {};
    (rhythmPatterns || []).forEach((pattern) => {
      if (!pattern) return;
      const normalized = normalizeRhythmPattern(pattern);
      registerPatternLookupKey(map, pattern._id, normalized);
      registerPatternLookupKey(map, pattern.id, normalized);
      registerPatternLookupKey(map, pattern.slug, normalized);
      registerPatternLookupKey(map, pattern.name, normalized);
    });
    return map;
  }, [rhythmPatterns]);

  const lookupRhythmPattern = useCallback(
    (key) => lookupPatternFromMap(rhythmPatternLookup, key),
    [rhythmPatternLookup]
  );

  const getRhythmPatternVisual = useCallback(
    (item) => {
      if (!item) return null;

      const patternKeys = [
        item.rhythmPatternId,
        item.rhythmPattern,
        item.rhythm?.patternId,
        item.rhythm?.id,
        item.rhythmPatternName,
        item.rhythm?.name,
      ].filter(Boolean);

      const tryLookupPattern = () => {
        for (const key of patternKeys) {
          const found = lookupRhythmPattern(key);
          if (found) return found;
        }
        return null;
      };

      const directSources = [
        item.rhythmPatternSteps,
        item.rhythmPatternData,
        item.rhythm?.steps,
        item.rhythm,
      ];

      for (const source of directSources) {
        const steps = normalizeRhythmSteps(source);
        if (steps.length) {
          const matchedPattern = tryLookupPattern();
          const label =
            item.rhythmPatternName ||
            item.rhythm?.name ||
            matchedPattern?.displayName ||
            null;
          return { steps, label };
        }
      }

      const matchedPattern = tryLookupPattern();
      if (matchedPattern) {
        return {
          steps: matchedPattern.visualSteps,
          label: matchedPattern.displayName,
        };
      }

      if (selectedRhythmPatternId) {
        const fallback = lookupRhythmPattern(selectedRhythmPatternId);
        if (fallback) {
          return {
            steps: fallback.visualSteps,
            label: fallback.displayName,
          };
        }
      }

      return {
        steps: createDefaultPatternSteps(),
        label: null,
      };
    },
    [lookupRhythmPattern, selectedRhythmPatternId]
  );

  // MIDI Editor
  const [midiEditorOpen, setMidiEditorOpen] = useState(false);
  const [editingTimelineItem, setEditingTimelineItem] = useState(null);

  // AI Generation Loading & Notifications
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiNotification, setAiNotification] = useState(null); // { type: 'success'|'error', message: '' }

  // Bottom Panel Tabs
  const [activeBottomTab, setActiveBottomTab] = useState("backing"); // 'backing' or 'library'

  // Track Context Menu
  const [trackContextMenu, setTrackContextMenu] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    trackId: null,
  });
  const closeTrackMenu = useCallback(
    () => setTrackContextMenu({ isOpen: false, x: 0, y: 0, trackId: null }),
    []
  );
  const orderedTracks = useMemo(
    () => [...tracks].sort((a, b) => (a.trackOrder ?? 0) - (b.trackOrder ?? 0)),
    [tracks]
  );
  const menuTrack = useMemo(
    () =>
      trackContextMenu.trackId
        ? tracks.find((track) => track._id === trackContextMenu.trackId) || null
        : null,
    [trackContextMenu.trackId, tracks]
  );
  const [tempoDraft, setTempoDraft] = useState("120");
  const [swingDraft, setSwingDraft] = useState("0");
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [recordArmed, setRecordArmed] = useState(false);
  const [historyStatus, setHistoryStatus] = useState({
    canUndo: false,
    canRedo: false,
  });
  const audioEngine = useAudioEngine();
  const { schedulePlayback, stopPlayback, loadClipAudio } = useAudioScheduler();
  const historyRef = useRef([]);
  const futureRef = useRef([]);
  const playbackPositionRef = useRef(0);
  const dirtyTimelineItemsRef = useRef(new Set());
  const saveTimeoutRef = useRef(null);
  // Note: Tone.js players are now managed through audioEngine hook (not stored in component refs)
  // This avoids storing non-serializable objects and follows the rule of using useAudioEngine singleton
  const menuPosition = useMemo(() => {
    const padding = 12;
    const width = 260;
    const height = 320;
    let x = trackContextMenu.x;
    let y = trackContextMenu.y;

    if (typeof window !== "undefined") {
      x = Math.min(Math.max(padding, x), window.innerWidth - width - padding);
      y = Math.min(Math.max(padding, y), window.innerHeight - height - padding);
    }

    return { x, y };
  }, [trackContextMenu.x, trackContextMenu.y]);

  const markTimelineItemDirty = useCallback((itemId) => {
    dirtyTimelineItemsRef.current.add(itemId);
  }, []);

  const adjustWorkspaceScale = useCallback((delta) => {
    setWorkspaceScale((prev) => {
      const next = parseFloat((prev + delta).toFixed(2));
      return Math.min(MAX_WORKSPACE_SCALE, Math.max(MIN_WORKSPACE_SCALE, next));
    });
  }, []);

  const hasUnsavedTimelineChanges = dirtyTimelineItemsRef.current.size > 0;

  const normalizedProjectKey = useMemo(
    () => normalizeKeyPayload(project?.key),
    [project?.key]
  );
  const projectKeyName = normalizedProjectKey.name;
  const normalizedTimeSignature = useMemo(
    () => normalizeTimeSignaturePayload(project?.timeSignature),
    [project?.timeSignature]
  );
  const projectTimeSignatureName = normalizedTimeSignature.name;
  const projectSwingAmount = useMemo(
    () => clampSwingAmount(project?.swingAmount ?? 0),
    [project?.swingAmount]
  );

  const collectTimelineItemSnapshot = useCallback(
    (itemId) => {
      if (!itemId) return null;
      for (const track of tracks) {
        const found = (track.items || []).find((item) => item._id === itemId);
        if (found) {
          const normalized = normalizeTimelineItem(found);
          return {
            _id: normalized._id,
            startTime: normalized.startTime,
            duration: normalized.duration,
            offset: normalized.offset,
            loopEnabled: normalized.loopEnabled,
            playbackRate: normalized.playbackRate,
            sourceDuration: normalized.sourceDuration,
          };
        }
      }
      return null;
    },
    [tracks]
  );

  const autosaveTimeoutRef = useRef(null);

  const updateHistoryStatus = useCallback(() => {
    setHistoryStatus({
      canUndo: historyRef.current.length > 0,
      canRedo: futureRef.current.length > 0,
    });
  }, []);

  const pushHistory = useCallback(() => {
    const snapshot = {
      tracks: cloneTracksForHistory(tracks),
      chordProgression: cloneChordsForHistory(chordProgression),
    };
    historyRef.current = [...historyRef.current, snapshot].slice(
      -HISTORY_LIMIT
    );
  }, [tracks, chordProgression, updateHistoryStatus]);

  const flushTimelineSaves = useCallback(async () => {
    const ids = Array.from(dirtyTimelineItemsRef.current);
    if (!ids.length) return;

    const snapshots = ids
      .map((id) => collectTimelineItemSnapshot(id))
      .filter((s) => s !== null);

    if (!snapshots.length) return;

    const payload = snapshots;
    setIsSavingTimeline(true);
    dirtyTimelineItemsRef.current.clear();

    try {
      await bulkUpdateTimelineItems(projectId, payload);
    } catch (error) {
      console.error("Timeline items bulk save failed:", error);
      ids.forEach((id) => dirtyTimelineItemsRef.current.add(id));
    } finally {
      setIsSavingTimeline(false);
    }
  }, [projectId, collectTimelineItemSnapshot]);

  const scheduleTimelineAutosave = useCallback(() => {
    clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(() => {
      flushTimelineSaves();
    }, 2000);
  }, [flushTimelineSaves]);

  const handleUndo = useCallback(() => {
    if (!historyRef.current.length) return;
    const previous = historyRef.current.pop();
    futureRef.current.push({
      tracks: cloneTracksForHistory(tracks),
      chordProgression: cloneChordsForHistory(chordProgression),
    });
    setTracks(previous?.tracks || []);
    setChordProgression(previous?.chordProgression || []);
    setSelectedItem(null);
    setFocusedClipId(null);
    updateHistoryStatus();
  }, [tracks, chordProgression, updateHistoryStatus]);

  const handleRedo = useCallback(() => {
    if (!futureRef.current.length) return;
    const nextState = futureRef.current.pop();
    historyRef.current.push({
      tracks: cloneTracksForHistory(tracks),
      chordProgression: cloneChordsForHistory(chordProgression),
    });
    setTracks(nextState?.tracks || []);
    setChordProgression(nextState?.chordProgression || []);
    setSelectedItem(null);
    setFocusedClipId(null);
    updateHistoryStatus();
  }, [tracks, chordProgression, updateHistoryStatus]);

  const timelineRef = useRef(null);
  const playheadRef = useRef(null);
  const clipRefs = useRef(new Map());
  const dragStateRef = useRef(null);
  const basePixelsPerSecond = 50; // Base scale for timeline
  const beatsPerMeasure = 4; // For 4/4 time
  const TRACK_COLUMN_WIDTH = 256; // Tailwind w-64 keeps labels aligned with lanes
  const MIN_WORKSPACE_SCALE = 0.75;
  const MAX_WORKSPACE_SCALE = 1.1;
  const WORKSPACE_SCALE_STEP = 0.05;

  // Calculate BPM-dependent values
  const bpm = project?.tempo || 120;
  const secondsPerBeat = 60 / bpm;
  const pixelsPerSecond = basePixelsPerSecond * zoomLevel; // Zoom-adjusted scale
  const pixelsPerBeat = pixelsPerSecond * secondsPerBeat;

  const normalizeTracks = (incomingTracks = []) =>
    incomingTracks
      .map((track, index) => {
        const fallbackColor =
          TRACK_COLOR_PALETTE[index % TRACK_COLOR_PALETTE.length];
        const inferredBacking =
          track.isBackingTrack ||
          track.trackType === "backing" ||
          track.trackName?.toLowerCase() === "backing track";
        const rawType = (track.trackType || "").toLowerCase();
        const normalizedType = ["audio", "midi", "backing"].includes(rawType)
          ? rawType
          : inferredBacking
          ? "backing"
          : "audio";
        const isBackingTrack = Boolean(
          inferredBacking || normalizedType === "backing"
        );

        return {
          ...track,
          isBackingTrack,
          trackType: normalizedType,
          color: track.color || fallbackColor,
          instrument: track.instrument || null,
          defaultRhythmPatternId: track.defaultRhythmPatternId || null,
          items: (track.items || []).map((item) => normalizeTimelineItem(item)),
        };
      })
      .sort((a, b) => (a.trackOrder ?? 0) - (b.trackOrder ?? 0));

  const fetchProject = useCallback(
    async (showLoading = false) => {
      try {
        if (showLoading) {
          setLoading(true);
        }
        setError(null);
        const response = await getProjectById(projectId);
        if (response.success) {
          setProject(response.data.project);
          setChordProgression(
            hydrateChordProgression(response.data.project.chordProgression)
          );
          const normalized = normalizeTracks(response.data.tracks || []);
          setTracks(normalized);

          // Initialize backingTrack state if a backing track exists
          const existingBackingTrack = normalized.find(
            (track) =>
              track.isBackingTrack ||
              track.trackType === "backing" ||
              track.trackName?.toLowerCase() === "backing track"
          );
          if (existingBackingTrack) {
            console.log("[Fetch Project] Found backing track:", {
              id: existingBackingTrack._id,
              name: existingBackingTrack.trackName,
              instrument: existingBackingTrack.instrument,
              instrumentId: existingBackingTrack.instrument?.instrumentId,
            });
            // Update selectedInstrumentId if backing track has an instrument
            if (existingBackingTrack.instrument?.instrumentId) {
              console.log(
                "[Fetch Project] Setting selectedInstrumentId to:",
                existingBackingTrack.instrument.instrumentId
              );
              setSelectedInstrumentId(
                existingBackingTrack.instrument.instrumentId
              );
            }
            setBackingTrack(existingBackingTrack);
          } else {
            console.log("[Fetch Project] No backing track found in tracks");
          }
        } else {
          throw new Error(response.message || "Failed to fetch project");
        }
      } catch (error) {
        console.error("Error fetching project:", error);
        setError(error.message || "Failed to load project");
      } finally {
        if (showLoading) {
          setLoading(false);
        }
        setLoadingLicks(false);
      }
    },
    [projectId]
  );

  const refreshProject = useCallback(() => fetchProject(false), [fetchProject]);

  const fetchLicks = useCallback(
    async (page = 1, append = false) => {
      setLoadingLicks(true);
      try {
        const activeFilters = [
          selectedGenre,
          selectedType,
          selectedEmotional,
          selectedTimbre,
          selectedArticulation,
          selectedCharacter,
        ].filter(Boolean);

        const response = await getCommunityLicks({
          search: lickSearchTerm,
          tags: activeFilters.join(","),
          limit: LICKS_PER_PAGE,
          page: page,
          sortBy: "newest",
        });

        const licks =
          response?.data?.licks ||
          response?.data?.items ||
          response?.data ||
          response?.licks ||
          response?.items ||
          [];

        if (append) {
          setAvailableLicks((prev) => [
            ...prev,
            ...(Array.isArray(licks) ? licks : []),
          ]);
        } else {
          setAvailableLicks(Array.isArray(licks) ? licks : []);
          setLickPage(1);
        }

        // Check if there are more licks to load
        const total = response?.data?.total || response?.total || 0;
        const currentCount = append
          ? availableLicks.length + licks.length
          : licks.length;
        setLickHasMore(licks.length === LICKS_PER_PAGE && currentCount < total);
      } catch (err) {
        console.error("Error fetching licks:", err);
        if (!append) {
          setAvailableLicks([]);
        }
      } finally {
        setLoadingLicks(false);
      }
    },
    [
      lickSearchTerm,
      selectedGenre,
      selectedType,
      selectedEmotional,
      selectedTimbre,
      selectedArticulation,
      selectedCharacter,
      availableLicks.length,
    ]
  );

  const loadMoreLicks = () => {
    if (!loadingLicks && lickHasMore) {
      const nextPage = lickPage + 1;
      setLickPage(nextPage);
      fetchLicks(nextPage, true);
    }
  };

  // Handle lick audio playback
  const handleLickPlayPause = async (lick, e) => {
    e?.stopPropagation();
    const lickId = lick._id || lick.lick_id || lick.id;

    // If clicking the same lick that's playing, pause it
    if (playingLickId === lickId) {
      const audio = lickAudioRefs[lickId];
      if (audio) {
        audio.pause();
        setPlayingLickId(null);
      }
      return;
    }

    // Stop any currently playing lick
    if (playingLickId && lickAudioRefs[playingLickId]) {
      lickAudioRefs[playingLickId].pause();
      lickAudioRefs[playingLickId].currentTime = 0;
    }

    try {
      // Get audio URL
      const response = await playLickAudio(lickId);
      if (!response.success || !response.data?.audio_url) {
        console.error("No audio URL available");
        return;
      }

      // Create or get audio element
      let audio = lickAudioRefs[lickId];
      if (!audio) {
        audio = new Audio();
        audio.addEventListener("timeupdate", () => {
          if (audio.duration) {
            setLickProgress((prev) => ({
              ...prev,
              [lickId]: audio.currentTime / audio.duration,
            }));
          }
        });
        audio.addEventListener("ended", () => {
          setPlayingLickId(null);
          setLickProgress((prev) => ({
            ...prev,
            [lickId]: 0,
          }));
        });
        setLickAudioRefs((prev) => ({ ...prev, [lickId]: audio }));
      }

      audio.src = response.data.audio_url;
      await audio.play();
      setPlayingLickId(lickId);
    } catch (error) {
      console.error("Error playing lick:", error);
    }
  };

  // Cleanup audio refs on unmount
  useEffect(() => {
    return () => {
      Object.values(lickAudioRefs).forEach((audio) => {
        if (audio) {
          audio.pause();
          audio.src = "";
        }
      });
    };
  }, []);

  useEffect(() => {
    fetchProject(true); // Show loading only on initial load
    fetchInstruments();
    fetchRhythmPatterns();
  }, [projectId, fetchProject]);

  useEffect(() => {
    const fetchChordLibrary = async () => {
      try {
        setLoadingChords(true);
        // Load ALL chords from database (we'll filter to 7 diatonic basic on frontend)
        // This allows lazy loading - only show 7 basic diatonic chords first
        const result = await getChords({
          basicOnly: false, // Get all chords, filter on frontend
        });
        const allChords = (result.chords || []).map((chord) =>
          normalizeChordLibraryItem(chord)
        );
        setChordLibrary(allChords);
        setChordLibraryTotal(result.total || 0);
        setShowComplexChords(false); // Reset to basic diatonic when key changes
        setChordLibraryError(null);
      } catch (err) {
        console.error("Error fetching chords:", err);
        setChordLibraryError(err.message || "Failed to load chords");
      } finally {
        setLoadingChords(false);
      }
    };

    fetchChordLibrary();
  }, [projectKeyName, selectedKeyFilter]); // Reload when key changes

  // Load complex chords when user expands (no need to fetch, just change state)
  const loadComplexChords = () => {
    if (showComplexChords) return;
    setShowComplexChords(true);
  };

  useEffect(() => {
    const handlePointerUp = () => {
      if (!isDraggingItem) return;

      // Get the dragged clip and its final position
      if (selectedItem && clipRefs.current.has(selectedItem)) {
        const clipElement = clipRefs.current.get(selectedItem);
        if (clipElement && timelineRef.current) {
          // Read final position from visual element
          const currentLeft = parseFloat(clipElement.style.left) || 0;
          const finalStartTime = Math.max(0, currentLeft / pixelsPerSecond);

          // Update state
          pushHistory();
          setTracks((prevTracks) =>
            prevTracks.map((track) => {
              const hasClip = (track.items || []).find(
                (item) => item._id === selectedItem
              );
              if (!hasClip) return track;
              return {
                ...track,
                items: (track.items || []).map((item) =>
                  item._id === selectedItem
                    ? normalizeTimelineItem({
                        ...item,
                        startTime: finalStartTime,
                      })
                    : item
                ),
              };
            })
          );

          // Trigger autosave
          markTimelineItemDirty(selectedItem);
          scheduleTimelineAutosave();
        }
      }

      // Clean up drag state
      setIsDraggingItem(false);
      setSelectedItem(null);
      dragStateRef.current = null;
    };

    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("blur", handlePointerUp);

    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("blur", handlePointerUp);
    };
  }, [
    isDraggingItem,
    selectedItem,
    pixelsPerSecond,
    pushHistory,
    markTimelineItemDirty,
    scheduleTimelineAutosave,
  ]);

  useEffect(() => {
    playbackPositionRef.current = playbackPosition;
  }, [playbackPosition]);

  // Warn on page unload if there are unsaved timeline changes
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!dirtyTimelineItemsRef.current.size) return;
      event.preventDefault();
      // Chrome requires returnValue to be set.
      event.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    setTempoDraft(String(project?.tempo || 120));
  }, [project?.tempo]);

  useEffect(() => {
    setSwingDraft(String(projectSwingAmount));
  }, [projectSwingAmount]);

  const formattedPlayTime = useMemo(
    () => formatTransportTime(playbackPosition),
    [playbackPosition]
  );

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closeTrackMenu();
        setFocusedClipId(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeTrackMenu]);

  const chordDurationSeconds = useMemo(
    () => getChordDuration() * secondsPerBeat,
    [secondsPerBeat]
  );

  const chordItems = useMemo(
    () =>
      chordProgression.map((entry, index) => {
        const chordName = entry?.chordName || `Chord ${index + 1}`;
        return {
          _id: `chord-${index}`,
          chord: chordName,
          startTime: index * chordDurationSeconds,
          duration: chordDurationSeconds,
          _isChord: true,
          midiNotes: entry?.midiNotes || [],
          variation: entry?.variation || null,
          instrumentStyle: entry?.instrumentStyle || null,
          rhythmPatternId: entry?.rhythmPatternId || null,
          rhythmPatternName: entry?.rhythmPatternName || null,
          rhythmPatternSteps: entry?.rhythmPatternSteps || null,
          rhythm: entry?.rhythm || null,
        };
      }),
    [chordProgression, chordDurationSeconds]
  );

  const chordPalette = useMemo(() => {
    const sourceChords = chordLibrary.length
      ? chordLibrary
      : DEFAULT_FALLBACK_CHORDS;
    // Use null check to allow "" (All Keys) to be valid
    const filterKey =
      selectedKeyFilter !== null ? selectedKeyFilter : projectKeyName;

    let filtered = sourceChords;

    // If showing basic chords only, filter to only 7 diatonic basic chords with correct qualities
    if (!showComplexChords && filterKey) {
      // Get the 7 diatonic chords with their correct qualities
      const diatonicChords = getDiatonicChords(filterKey);

      // Helper to extract root and quality from chord name
      const rootMatch = (chordName) => {
        const match = chordName.match(/^([A-G][#b]?)/);
        return match ? match[1] : null;
      };

      const getChordQuality = (chordName) => {
        const name = chordName.toLowerCase();
        if (/dim|°/.test(name)) return "diminished";
        if (/m$|min$/.test(name) && !/maj|dim/.test(name)) return "minor";
        return "major";
      };

      // Filter to only chords that match the 7 diatonic chords exactly
      filtered = sourceChords.filter((chord) => {
        const chordName = chord.chordName || chord.name;
        if (!chordName) return false;

        // Must be basic (no extensions)
        const name = chordName.toLowerCase();
        const complexPatterns =
          /(7|9|11|13|sus|add|maj7|dim7|aug7|m7|b5|#5|6|maj9|9th)/;
        if (complexPatterns.test(name)) return false;

        const root = rootMatch(chordName);
        const quality = getChordQuality(chordName);

        // Check if this chord matches one of the 7 diatonic chords
        return diatonicChords.some(
          (dc) => dc.root === root && dc.quality === quality
        );
      });

      // Ensure we have exactly one chord per diatonic degree
      const chordsByDegree = {};
      diatonicChords.forEach((dc, index) => {
        const matchingChord = filtered.find((chord) => {
          const chordName = chord.chordName || chord.name;
          const root = rootMatch(chordName);
          const quality = getChordQuality(chordName);
          return root === dc.root && quality === dc.quality;
        });
        if (matchingChord) {
          chordsByDegree[index] = matchingChord;
        }
      });

      // Sort by degree order
      filtered = Object.keys(chordsByDegree)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map((key) => chordsByDegree[key]);
    } else if (filterKey) {
      // When showing complex chords, filter by key but include all chords in key
      filtered = sourceChords.filter((chord) => {
        const chordName = chord.chordName || chord.name;
        if (!chordName) return false;
        return isChordInKey(chordName, filterKey);
      });
    }
    // If no key selected, show all chords

    // Sort: basic chords first, then complex (for better UX)
    const sorted = [...filtered].sort((a, b) => {
      const aName = (a.chordName || a.name || "").toLowerCase();
      const bName = (b.chordName || b.name || "").toLowerCase();
      const aIsBasic =
        !/(7|9|11|13|sus|add|maj7|dim7|aug7|m7|b5|#5|6|maj9|9th)/.test(aName);
      const bIsBasic =
        !/(7|9|11|13|sus|add|maj7|dim7|aug7|m7|b5|#5|6|maj9|9th)/.test(bName);

      if (aIsBasic && !bIsBasic) return -1;
      if (!aIsBasic && bIsBasic) return 1;
      return aName.localeCompare(bName);
    });

    return sorted.map((chord) => normalizeChordLibraryItem(chord));
  }, [chordLibrary, projectKeyName, selectedKeyFilter, showComplexChords]);

  const reorderChordProgression = (fromIndex, toIndex) => {
    if (
      fromIndex === null ||
      toIndex === null ||
      fromIndex < 0 ||
      fromIndex >= chordProgression.length
    ) {
      return;
    }

    const clampedTarget = Math.max(
      0,
      Math.min(toIndex, chordProgression.length - 1)
    );
    const updated = [...chordProgression];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(clampedTarget, 0, moved);
    saveChordProgression(updated);
  };

  // Fetch available instruments
  const fetchInstruments = async () => {
    try {
      setLoadingInstruments(true);
      const response = await getInstruments();
      if (response.success) {
        setInstruments(response.data || []);
      }
    } catch (err) {
      console.error("Error fetching instruments:", err);
    } finally {
      setLoadingInstruments(false);
    }
  };

  // Fetch rhythm patterns
  const fetchRhythmPatterns = async () => {
    try {
      setLoadingRhythmPatterns(true);
      const response = await getRhythmPatterns();
      if (response.success) {
        setRhythmPatterns(response.data || []);
      }
    } catch (err) {
      console.error("Error fetching rhythm patterns:", err);
    } finally {
      setLoadingRhythmPatterns(false);
    }
  };

  // Handle adding chord to timeline from backing track panel
  const handleAddChordToTimeline = async (chordData) => {
    try {
      if (!backingTrack) {
        alert("No backing track found. Please create one first.");
        return;
      }

      // Find the chord in the library to get full MIDI data
      const chord = chordLibrary.find(
        (c) => c.chordName === chordData.chordName
      );
      if (!chord) {
        alert("Chord not found in library");
        return;
      }

      // Calculate start time (place at the end of existing items)
      const existingItems = backingTrack.items || [];
      const lastItem =
        existingItems.length > 0
          ? existingItems.reduce((max, item) => {
              const endTime = item.startTime + item.duration;
              return endTime > max ? endTime : max;
            }, 0)
          : 0;

      const bpm = project?.tempo || 120;
      const secondsPerBeat = 60 / bpm;
      const durationInSeconds = (chordData.duration || 4) * secondsPerBeat;

      // Parse MIDI notes - they're stored as JSON string
      let midiNotes = [];
      if (chord.midiNotes) {
        if (typeof chord.midiNotes === "string") {
          try {
            midiNotes = JSON.parse(chord.midiNotes);
          } catch (e) {
            console.error("Failed to parse MIDI notes:", e);
            midiNotes = [];
          }
        } else if (Array.isArray(chord.midiNotes)) {
          midiNotes = chord.midiNotes;
        }
      }

      const timelineData = {
        trackId: backingTrack._id,
        startTime: lastItem,
        duration: durationInSeconds,
        offset: 0,
        type: "chord",
        chordName: chord.chordName,
        rhythmPatternId: chordData.rhythmPatternId || selectedRhythmPatternId,
        isCustomized: false,
        customMidiEvents:
          midiNotes.length > 0
            ? midiNotes.map((pitch) => ({
                pitch: Number(pitch),
                startTime: 0,
                duration: durationInSeconds,
                velocity: 0.8,
              }))
            : [],
      };

      const response = await addLickToTimeline(projectId, timelineData);
      if (response.success) {
        await refreshProject();
        alert("Chord added to timeline!");
      }
    } catch (error) {
      console.error("Error adding chord to timeline:", error);
      alert(
        `Failed to add chord: ${error.response?.data?.message || error.message}`
      );
    }
  };

  // Handle opening MIDI editor
  const handleOpenMidiEditor = (timelineItem) => {
    setEditingTimelineItem(timelineItem);
    setMidiEditorOpen(true);
  };

  // Handle closing MIDI editor
  const handleCloseMidiEditor = () => {
    setMidiEditorOpen(false);
    setEditingTimelineItem(null);
  };

  // Handle saving MIDI edits
  const handleSaveMidiEdit = async (updatedItem) => {
    try {
      const response = await updateTimelineItem(projectId, updatedItem._id, {
        customMidiEvents: updatedItem.customMidiEvents,
        isCustomized: updatedItem.isCustomized,
      });

      if (response.success) {
        await refreshProject();
        handleCloseMidiEditor();
      }
    } catch (error) {
      console.error("Error saving MIDI edits:", error);
      alert("Failed to save MIDI edits");
    }
  };

  // Handle generating full backing track with audio generation
  const [isGeneratingBackingTrack, setIsGeneratingBackingTrack] =
    useState(false);

  const handleGenerateBackingTrack = async (data) => {
    // Validate that instrument is selected (required for audio generation)
    if (!data.instrumentId) {
      alert(
        "Please select an instrument first to generate audio for the backing track"
      );
      return;
    }

    if (!data.rhythmPatternId) {
      alert(
        "Please select a rhythm pattern first to generate audio for the backing track"
      );
      return;
    }

    if (!data.chords || data.chords.length === 0) {
      alert("Please add some chords to the progression first");
      return;
    }

    setIsGeneratingBackingTrack(true);
    setError(null);

    try {
      // Include project tempo and key for accurate audio generation
      const generationData = {
        ...data,
        tempo: project?.tempo || 120,
        key: normalizeKeyPayload(project?.key),
        timeSignature: normalizeTimeSignaturePayload(project?.timeSignature),
        // Flag to indicate we want audio generation (not just MIDI)
        generateAudio: true,
      };

      console.log(
        "[Generate Backing Track] Starting generation with data:",
        generationData
      );
      console.log(
        "[Generate Backing Track] Selected instrumentId:",
        generationData.instrumentId
      );
      const response = await generateBackingTrackAPI(projectId, generationData);
      console.log("[Generate Backing Track] API Response:", response);
      console.log(
        "[Generate Backing Track] Backing track from response:",
        response.data?.track
      );
      console.log(
        "[Generate Backing Track] Backing track instrument:",
        response.data?.track?.instrument
      );

      if (response.success) {
        console.log(
          "[Generate Backing Track] Success! Response data:",
          response.data
        );
        console.log(
          "[Generate Backing Track] Items generated:",
          response.data?.items?.length || 0
        );

        // Update selectedInstrumentId from response if available
        if (response.data?.track?.instrument?.instrumentId) {
          console.log(
            "[Generate Backing Track] Setting selectedInstrumentId to:",
            response.data.track.instrument.instrumentId
          );
          setSelectedInstrumentId(response.data.track.instrument.instrumentId);
        }

        // Small delay to ensure server has saved everything
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Refresh project to get new backing track items with audio
        console.log("[Generate Backing Track] Refreshing project...");
        await refreshProject();
        console.log("[Generate Backing Track] Project refreshed successfully");

        // Show success message
        alert(
          `✅ Backing track generated successfully with ${
            response.data?.items?.length || 0
          } chord clips!`
        );
      } else {
        console.error(
          "[Generate Backing Track] API returned success:false",
          response
        );
        throw new Error(response.message || "Failed to generate backing track");
      }
    } catch (error) {
      console.error(
        "[Generate Backing Track] Error generating backing track:",
        error
      );
      console.error("[Generate Backing Track] Error details:", {
        message: error.message,
        response: error.response?.data,
        stack: error.stack,
      });
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to generate backing track audio";
      setError(errorMessage);
      alert(`❌ Error: ${errorMessage}`);
    } finally {
      setIsGeneratingBackingTrack(false);
    }
  };

  // Handle AI Backing Track Generation with Suno
  const handleGenerateAIBackingTrack = async (params) => {
    setIsGeneratingAI(true);
    setAiNotification(null);

    try {
      const response = await generateAIBackingTrack(projectId, params);

      if (response.success) {
        // Show success notification
        setAiNotification({
          type: "success",
          message:
            response.message || "🎵 AI backing track generated successfully!",
        });

        // Refresh project to get new backing track items
        await fetchProject();

        // Auto-hide notification after 5 seconds
        setTimeout(() => setAiNotification(null), 5000);
      }
    } catch (error) {
      console.error("AI generation failed:", error);
      setAiNotification({
        type: "error",
        message: error.message || "Failed to generate AI backing track",
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Fetch licks on initial mount and when search term or filters change
  useEffect(() => {
    const timeout = setTimeout(
      () => {
        fetchLicks();
      },
      lickSearchTerm ? 300 : 0
    );

    return () => clearTimeout(timeout);
  }, [fetchLicks, lickSearchTerm]);

  // Playback control with playhead movement synced to audioEngine transport
  useEffect(() => {
    let animationFrame = null;
    let lastStateUpdate = 0;

    if (isPlaying) {
      const width = calculateTimelineWidth();
      const loopLenSeconds = Math.max(1, width / pixelsPerSecond);

      const animate = () => {
        // Sync position with audioEngine transport
        const transportPos = audioEngine.getPosition();
        const position = loopEnabled
          ? transportPos % loopLenSeconds
          : transportPos;

        // 1. Direct DOM update for smooth 60fps animation without re-renders
        if (playheadRef.current) {
          const leftPos = TRACK_COLUMN_WIDTH + position * pixelsPerSecond;
          playheadRef.current.style.left = `${leftPos}px`;
        }

        // 2. Update ref immediately for logic (pause/resume accuracy)
        playbackPositionRef.current = position;

        // 3. Throttled state update for timer display (every 100ms is enough for UI)
        // This prevents the component from re-rendering 60 times a second
        const now = Date.now();
        if (now - lastStateUpdate > 100) {
          setPlaybackPosition(position);
          lastStateUpdate = now;
        }

        animationFrame = requestAnimationFrame(animate);
      };
      animationFrame = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isPlaying, loopEnabled, pixelsPerSecond, tracks]);

  // Initialize Tone.js via audioEngine
  useEffect(() => {
    const initTone = async () => {
      try {
        await audioEngine.ensureStarted();
        audioEngine.setBpm(bpm);
      } catch (error) {
        console.error("Error initializing Tone.js:", error);
      }
    };

    initTone();

    return () => {
      // Cleanup via audioEngine (keeps singleton alive but stops playback)
      if (audioEngine.isTransportPlaying()) {
        audioEngine.stopTransport();
      }
      audioEngine.disposeAllPlayers();
    };
  }, []);

  // Sync BPM changes with audioEngine
  useEffect(() => {
    audioEngine.setBpm(bpm);
  }, [bpm]);

  // Get audio URL for a timeline item (used by useAudioScheduler)
  const getAudioUrlForItem = useCallback(
    async (item) => {
      // Handle lick items - get audio URL from API
      if (item.type === "lick" && item.lickId) {
        const audioResponse = await playLickAudio(
          item.lickId._id || item.lickId,
          user?._id
        );
        return (
          audioResponse?.data?.audio_url ||
          audioResponse?.data?.audioUrl ||
          null
        );
      }

      // Handle chord items with generated audio
      if (
        item.type === "chord" ||
        (item.chordName &&
          (item.audioUrl || item.audio_url || item.lickId?.audioUrl))
      ) {
        return (
          item.audioUrl ||
          item.audio_url ||
          item.lickId?.audioUrl ||
          item.lickId?.audio_url ||
          null
        );
      }

      return null;
    },
    [user?._id]
  );

  // Schedule audio playback using the extracted hook
  const scheduleAudioPlayback = useCallback(async () => {
    await schedulePlayback(tracks, getAudioUrlForItem);
  }, [tracks, schedulePlayback, getAudioUrlForItem]);

  //  Auto-reschedule audio when tracks change during playback
  // This is key for live editing while playing (like professional DAWs)
  useEffect(() => {
    if (isPlaying && audioEngine.players.size > 0) {
      // Debounce rescheduling to avoid too many updates
      const timeoutId = setTimeout(() => {
        scheduleAudioPlayback();
      }, 50); // 50ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [tracks, isPlaying]); // Reschedule when tracks or playback state changes

  // Auto-save when clips are moved/edited (catches all clip position changes)
  const prevTracksRef = useRef(null);
  useEffect(() => {
    // Skip on initial load
    if (!prevTracksRef.current) {
      prevTracksRef.current = tracks;
      return;
    }

    // Check if any clip positions have changed
    let hasChanges = false;
    const changedItemIds = new Set();

    tracks.forEach((track) => {
      const prevTrack = prevTracksRef.current.find((t) => t._id === track._id);
      if (!prevTrack) return;

      (track.items || []).forEach((item) => {
        const prevItem = (prevTrack.items || []).find(
          (i) => i._id === item._id
        );
        if (!prevItem) {
          changedItemIds.add(item._id);
          hasChanges = true;
        } else if (
          item.startTime !== prevItem.startTime ||
          item.duration !== prevItem.duration ||
          item.offset !== prevItem.offset
        ) {
          changedItemIds.add(item._id);
          hasChanges = true;
        }
      });
    });

    if (hasChanges) {
      changedItemIds.forEach((itemId) => markTimelineItemDirty(itemId));
      scheduleTimelineAutosave();
    }

    prevTracksRef.current = tracks;
  }, [tracks, markTimelineItemDirty, scheduleTimelineAutosave]);

  const handlePlay = async () => {
    // Start Tone.js audio context if needed
    await audioEngine.ensureStarted();

    if (!audioEngine.transport) {
      console.error("Tone.Transport is not available");
      return;
    }

    // Set the transport position to current playback position
    audioEngine.setPosition(playbackPositionRef.current);

    // Update BPM in case it changed
    audioEngine.setBpm(bpm);

    setIsPlaying(true);

    // Schedule audio playback (no longer needs startTime parameter)
    await scheduleAudioPlayback();

    // Start the Tone.js Transport
    audioEngine.startTransport();
  };

  const handlePause = () => {
    setIsPlaying(false);

    // Pause the Tone.js Transport
    audioEngine.pauseTransport();

    // Stop all audio players
    audioEngine.stopAllPlayers();
  };

  const handleStop = () => {
    setIsPlaying(false);
    setPlaybackPosition(0);
    playbackPositionRef.current = 0;

    // Stop the Tone.js Transport and reset position
    audioEngine.stopTransport();

    // Stop all audio players
    audioEngine.stopAllPlayers();
  };

  const handleReturnToStart = () => {
    setIsPlaying(false);
    setPlaybackPosition(0);
    playbackPositionRef.current = 0;
  };

  const handlePlayToggle = () => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  };

  const handleRecordToggle = () => {
    setRecordArmed((prev) => !prev);
  };

  // Snap time to grid and clip edges
  // Soft magnetic snapping to neighboring clips on the same track
  const applyMagnet = (time, track, itemId) => {
    if (!track) return time;

    const thresholdSeconds = secondsPerBeat * 0.25; // quarter-beat magnetic range
    let closestTime = time;
    let minDelta = thresholdSeconds;

    // Snap to beat grid
    const beatTime = Math.round(time / secondsPerBeat) * secondsPerBeat;
    const beatDelta = Math.abs(beatTime - time);
    if (beatDelta < minDelta) {
      minDelta = beatDelta;
      closestTime = beatTime;
    }

    // Snap to clip edges
    const hasTimelineChords = (track.items || []).some(
      (clip) => clip?.type === "chord"
    );
    const includeVirtualChords =
      (track.trackType === "backing" || track.isBackingTrack) &&
      chordItems?.length &&
      !hasTimelineChords;
    const allItems = includeVirtualChords
      ? [...(track.items || []), ...chordItems]
      : track.items || [];

    allItems.forEach((item) => {
      if (!item || item._id === itemId) return;
      const start = item.startTime || 0;
      const end = start + (item.duration || 0);
      const edges = [start, end];

      edges.forEach((edge) => {
        const delta = Math.abs(edge - time);
        if (delta < minDelta) {
          minDelta = delta;
          closestTime = edge;
        }
      });
    });

    return closestTime;
  };

  // Handle clip overlap: Trim overlapping clips (like openDAW/Ableton)
  // When a clip overlaps another, trim the underlying clip
  const handleClipOverlap = (
    track,
    movedItemId,
    newStartTime,
    movedDuration
  ) => {
    if (!track) return track;

    const movedItem = track.items?.find((item) => item._id === movedItemId);
    if (!movedItem) return track;

    const movedEnd = newStartTime + movedDuration;
    const updatedItems = (track.items || [])
      .map((item) => {
        if (item._id === movedItemId) {
          // Update the moved item
          return { ...item, startTime: newStartTime };
        }

        const itemStart = item.startTime || 0;
        const itemEnd = itemStart + (item.duration || 0);

        // Check if moved clip overlaps this item
        const overlaps = !(newStartTime >= itemEnd || movedEnd <= itemStart);

        if (overlaps) {
          // Trim the underlying clip
          if (newStartTime > itemStart && newStartTime < itemEnd) {
            // Moved clip starts inside this item - trim the end
            const newDuration = newStartTime - itemStart;
            if (newDuration >= MIN_CLIP_DURATION) {
              return { ...item, duration: newDuration };
            } else {
              // Too small, remove it
              return null;
            }
          } else if (movedEnd > itemStart && movedEnd < itemEnd) {
            // Moved clip ends inside this item - trim the start
            const trimAmount = movedEnd - itemStart;
            const newStart = itemStart + trimAmount;
            const newDuration = item.duration - trimAmount;
            if (newDuration >= MIN_CLIP_DURATION) {
              return {
                ...item,
                startTime: newStart,
                offset: (item.offset || 0) + trimAmount,
              };
            } else {
              // Too small, remove it
              return null;
            }
          } else if (newStartTime <= itemStart && movedEnd >= itemEnd) {
            // Moved clip completely covers this item - remove it
            return null;
          }
        }

        return item;
      })
      .filter(Boolean); // Remove null items

    return {
      ...track,
      items: updatedItems,
    };
  };

  // Calculate timeline width based on content
  const calculateTimelineWidth = () => {
    let maxTime = 32; // Default 32 seconds
    tracks.forEach((track) => {
      track.items?.forEach((item) => {
        const endTime = item.startTime + item.duration;
        if (endTime > maxTime) maxTime = endTime;
      });
    });
    // Add some padding
    return Math.max(maxTime * pixelsPerSecond + 200, 1000);
  };

  const saveChordProgression = async (chords) => {
    try {
      pushHistory();
      const normalized = (chords || [])
        .map((entry) => normalizeChordEntry(entry))
        .filter((entry) => entry && entry.chordName);

      // Optimistic update - update chord progression in local state immediately
      setChordProgression(normalized);
      await updateChordProgressionAPI(projectId, normalized);
      // Silent refresh in background
      refreshProject();
    } catch (err) {
      console.error("Error updating chord progression:", err);
      // Revert on error by refreshing
      refreshProject();
    }
  };

  const applyBackingInstrumentSelection = async (instrumentId) => {
    setSelectedInstrumentId(instrumentId);
    setProject((prev) => ({
      ...prev,
      backingInstrumentId: instrumentId,
    }));
    await updateProject(projectId, { backingInstrumentId: instrumentId });
    refreshProject();
  };

  // Handle instrument selection for backing track or selected track
  const handleSelectInstrument = async (instrumentId) => {
    try {
      if (selectedTrackId) {
        const track = tracks.find((t) => t._id === selectedTrackId);

        if (!track) {
          alert("That track is no longer available. Please select it again.");
          setSelectedTrackId(null);
          return;
        }

        if (!track.isBackingTrack && track.trackType !== "backing") {
          await handleUpdateTrack(selectedTrackId, {
            instrument: instrumentId,
          });
          return;
        }

        await applyBackingInstrumentSelection(instrumentId);
        return;
      }

      await applyBackingInstrumentSelection(instrumentId);
    } catch (err) {
      console.error("Error updating instrument:", err);
      refreshProject();
    }
  };

  // Ensure backing track exists
  const ensureBackingTrack = async () => {
    // First check if backingTrack state is set
    if (backingTrack) return backingTrack._id;

    // Check if a backing track already exists in the tracks array
    const existingBackingTrack = tracks.find(
      (track) =>
        track.isBackingTrack ||
        track.trackType === "backing" ||
        track.trackName?.toLowerCase() === "backing track"
    );

    if (existingBackingTrack) {
      // Set the state so we don't try to create another one
      setBackingTrack(existingBackingTrack);
      return existingBackingTrack._id;
    }

    // Create backing track if it doesn't exist
    try {
      const defaultColor =
        TRACK_COLOR_PALETTE[tracks.length % TRACK_COLOR_PALETTE.length];
      const response = await addTrack(projectId, {
        trackName: "Backing Track",
        isBackingTrack: true,
        trackType: "backing",
        color: defaultColor,
      });
      if (response.success) {
        const [createdTrack] = normalizeTracks([
          {
            ...response.data,
            isBackingTrack: true,
            trackType: "backing",
            color: response.data.color || defaultColor,
          },
        ]);
        if (createdTrack) {
          pushHistory();
          setBackingTrack(createdTrack);
          setTracks((prev) => [...prev, createdTrack]);
          return createdTrack._id;
        }
      }
    } catch (err) {
      console.error("Error creating backing track:", err);
      // If error says backing track already exists, try to find it in tracks
      if (err.message?.includes("already has a backing track")) {
        const existingBackingTrack = tracks.find(
          (track) =>
            track.isBackingTrack ||
            track.trackType === "backing" ||
            track.trackName?.toLowerCase() === "backing track"
        );
        if (existingBackingTrack) {
          setBackingTrack(existingBackingTrack);
          return existingBackingTrack._id;
        }
        // Refresh project to get the latest tracks
        await refreshProject();
        // Try to find it again after refresh
        const refreshedBackingTrack = tracks.find(
          (track) =>
            track.isBackingTrack ||
            track.trackType === "backing" ||
            track.trackName?.toLowerCase() === "backing track"
        );
        if (refreshedBackingTrack) {
          setBackingTrack(refreshedBackingTrack);
          return refreshedBackingTrack._id;
        }
      }
    }
    return null;
  };

  const commitTempoChange = useCallback(async () => {
    if (!project) return;
    const parsed = parseInt(tempoDraft, 10);
    if (Number.isNaN(parsed)) {
      setTempoDraft(String(project.tempo || 120));
      return;
    }
    const tempo = Math.min(300, Math.max(40, parsed));
    if (tempo === project.tempo) {
      setTempoDraft(String(project.tempo || tempo));
      return;
    }
    setProject((prev) => (prev ? { ...prev, tempo } : prev));
    try {
      await updateProject(projectId, { tempo });
    } catch (err) {
      console.error("Error updating tempo:", err);
      refreshProject();
    }
  }, [project, tempoDraft, projectId, refreshProject]);

  const commitSwingChange = useCallback(async () => {
    if (!project) return;
    const parsed = clampSwingAmount(swingDraft);
    if (parsed === clampSwingAmount(project.swingAmount ?? 0)) {
      setSwingDraft(String(parsed));
      return;
    }
    setProject((prev) => (prev ? { ...prev, swingAmount: parsed } : prev));
    try {
      await updateProject(projectId, { swingAmount: parsed });
    } catch (err) {
      console.error("Error updating swing amount:", err);
      refreshProject();
    }
  }, [project, swingDraft, projectId, refreshProject]);

  const handleTimeSignatureChange = async (value) => {
    if (!project || !value) return;
    const normalized = normalizeTimeSignaturePayload(value);
    const current = normalizeTimeSignaturePayload(project.timeSignature);
    const isSame =
      current.numerator === normalized.numerator &&
      current.denominator === normalized.denominator;
    if (isSame) return;
    setProject((prev) =>
      prev ? { ...prev, timeSignature: normalized } : prev
    );
    try {
      await updateProject(projectId, { timeSignature: normalized });
    } catch (err) {
      console.error("Error updating time signature:", err);
      refreshProject();
    }
  };

  const handleKeyChange = async (value) => {
    if (!project || !value) return;
    const normalized = normalizeKeyPayload(value);
    const current = normalizeKeyPayload(project.key);
    const isSame =
      current.root === normalized.root && current.scale === normalized.scale;
    if (isSame) return;
    setProject((prev) => (prev ? { ...prev, key: normalized } : prev));
    try {
      await updateProject(projectId, { key: normalized });
    } catch (err) {
      console.error("Error updating key:", err);
      refreshProject();
    }
  };

  const handleAddChord = async (chord) => {
    await ensureBackingTrack();
    const entry = cloneChordEntry(chord);
    if (!entry) return;
    const updated = [...chordProgression, entry];
    saveChordProgression(updated);
  };

  const handleRemoveChord = (itemIdOrIndex) => {
    const index =
      typeof itemIdOrIndex === "number"
        ? itemIdOrIndex
        : getChordIndexFromId(itemIdOrIndex);
    if (index === null || index < 0 || index >= chordProgression.length) return;
    const updated = chordProgression.filter((_, i) => i !== index);
    saveChordProgression(updated);
  };

  const handleDragStart = (lick) => {
    setDraggedLick(lick);
  };

  const handleChordDragStart = (chord) => {
    setDraggedLick(null);
    const entry = cloneChordEntry(chord);
    if (!entry) return;
    setDraggedChord(entry);
  };

  const finishDragging = () => {
    setIsDraggingItem(false);
    setSelectedItem(null);
    setDragOffset({ x: 0, trackId: null });
  };

  const handleDragOver = (e, trackId, position) => {
    e.preventDefault();
    setDragOverTrack(trackId);
    setDragOverPosition(position);
  };

  const handleDrop = async (e, trackId, startTime) => {
    e.preventDefault();

    if (draggedChord) {
      const targetTrack = tracks.find((track) => track._id === trackId);
      if (
        !targetTrack ||
        !(
          targetTrack.isBackingTrack ||
          targetTrack.trackName === "Backing Track"
        )
      ) {
        setError("Chord blocks can only be dropped on a backing track");
      } else {
        const insertionIndex = Math.min(
          Math.max(0, Math.round(startTime / chordDurationSeconds)),
          chordProgression.length
        );
        const updated = [...chordProgression];
        const entry = cloneChordEntry(draggedChord);
        if (entry) {
          updated.splice(insertionIndex, 0, entry);
          saveChordProgression(updated);
        }
      }
      setDraggedChord(null);
      setDragOverTrack(null);
      setDragOverPosition(null);
      finishDragging();
      return;
    }

    if (!draggedLick) return;

    // Get lick ID - handle different field names
    const lickId = draggedLick._id || draggedLick.lick_id || draggedLick.id;
    if (!lickId) {
      setError("Invalid lick: missing ID");
      setDraggedLick(null);
      finishDragging();
      return;
    }

    // Ensure startTime and duration are numbers
    const numericStartTime =
      typeof startTime === "number" ? startTime : parseFloat(startTime) || 0;
    const numericDuration =
      typeof draggedLick.duration === "number"
        ? draggedLick.duration
        : parseFloat(draggedLick.duration) || 4;

    if (isNaN(numericStartTime) || isNaN(numericDuration)) {
      setError("Invalid time values");
      setDraggedLick(null);
      finishDragging();
      return;
    }

    try {
      const sourceDuration =
        typeof draggedLick.duration === "number"
          ? draggedLick.duration
          : parseFloat(draggedLick.duration) || numericDuration;
      const response = await addLickToTimeline(projectId, {
        trackId: trackId.toString(),
        lickId: lickId.toString(),
        startTime: numericStartTime,
        duration: numericDuration,
        offset: 0,
        sourceDuration,
        loopEnabled: false,
      });

      if (response.success) {
        // --- FIX BUG 2: Đảm bảo ID luôn tồn tại ---
        // Nếu API trả về 'id' thay vì '_id', hoặc thiếu id, ta tạo ID tạm thời
        const rawItem = response.data;
        const uniqueId =
          rawItem._id || rawItem.id || `temp-${Date.now()}-${Math.random()}`;

        const newItem = normalizeTimelineItem({
          ...rawItem,
          _id: uniqueId, // Ép buộc có _id để React phân biệt
        });

        pushHistory();
        setTracks((prevTracks) =>
          prevTracks.map((track) =>
            track._id === trackId
              ? {
                  ...track,
                  items: [...(track.items || []), newItem],
                }
              : track
          )
        );
        setError(null);

        // --- FIX BUG 1: BỎ DÒNG refreshProject() ---
        // Không gọi refreshProject() ngay lập tức vì server có thể chưa lưu kịp.
        // State cục bộ (newItem) đã đủ để hiển thị rồi.
        // refreshProject(); <--- XÓA HOẶC COMMENT DÒNG NÀY
      } else {
        setError(response.message || "Failed to add lick to timeline");
      }
    } catch (err) {
      console.error("Error adding lick to timeline:", err);
      console.error("Error details:", {
        response: err.response?.data,
        draggedLick,
        trackId,
        startTime: numericStartTime,
        duration: numericDuration,
      });

      // Extract detailed error message
      let errorMessage = "Failed to add lick to timeline";
      if (err.response?.data) {
        if (
          err.response.data.errors &&
          Array.isArray(err.response.data.errors)
        ) {
          errorMessage = err.response.data.errors
            .map((e) => e.msg || e.message)
            .join(", ");
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setDraggedLick(null);
      setDragOverTrack(null);
      setDragOverPosition(null);
      finishDragging();
    }
  };

  const handleDeleteTimelineItem = async (
    itemId,
    { skipConfirm = false } = {}
  ) => {
    if (
      !skipConfirm &&
      !window.confirm(
        "Are you sure you want to remove this lick from the timeline?"
      )
    ) {
      return;
    }

    try {
      // Optimistic update - remove item from local state immediately
      pushHistory();
      setTracks((prevTracks) =>
        prevTracks.map((track) => ({
          ...track,
          items: (track.items || []).filter((item) => item._id !== itemId),
        }))
      );

      await deleteTimelineItem(projectId, itemId);
      // Silent refresh in background to ensure sync
      refreshProject();
    } catch (err) {
      console.error("Error deleting timeline item:", err);
      setError(err.message || "Failed to delete timeline item");
      // Revert on error by refreshing
      refreshProject();
    }
  };

  useEffect(() => {
    const handleKeyDelete = (event) => {
      if (event.key !== "Delete" || !focusedClipId) return;
      event.preventDefault();
      const chordIndex = getChordIndexFromId(focusedClipId);
      if (chordIndex !== null) {
        handleRemoveChord(focusedClipId);
      } else {
        handleDeleteTimelineItem(focusedClipId, { skipConfirm: true });
      }
      setFocusedClipId(null);
    };

    window.addEventListener("keydown", handleKeyDelete);
    return () => window.removeEventListener("keydown", handleKeyDelete);
  }, [focusedClipId, handleDeleteTimelineItem, handleRemoveChord]);

  const handleDeleteProject = async () => {
    if (!project?._id || isDeleting) return;
    if (
      !window.confirm(
        "Delete this project? All tracks, clips, and settings will be removed."
      )
    ) {
      return;
    }

    try {
      setIsDeleting(true);
      await deleteProjectApi(project._id);
      navigate("/projects");
    } catch (err) {
      console.error("Error deleting project:", err);
      setError(err.response?.data?.message || err.message || "Delete failed");
      setIsDeleting(false);
    }
  };

  const handleAddTrack = async () => {
    const typeInput = prompt(
      "Create which type of track? Enter 'backing', 'audio', or 'midi':",
      "audio"
    );
    if (!typeInput) return;
    const normalizedType = typeInput.trim().toLowerCase();
    const trackTypeValue =
      normalizedType === "backing"
        ? "backing"
        : normalizedType === "midi"
        ? "midi"
        : "audio";
    const isBackingTrack = trackTypeValue === "backing";

    if (isBackingTrack && backingTrack) {
      alert(
        "A backing track already exists. Remove it before creating another."
      );
      return;
    }

    const defaultName =
      trackTypeValue === "backing"
        ? "Backing Track"
        : trackTypeValue === "midi"
        ? "New MIDI Track"
        : "New Audio Track";
    const trackName = prompt("Enter track name:", defaultName);
    if (!trackName) return;

    try {
      const defaultColor =
        TRACK_COLOR_PALETTE[tracks.length % TRACK_COLOR_PALETTE.length];
      const response = await addTrack(projectId, {
        trackName,
        isBackingTrack,
        trackType: trackTypeValue,
        color: defaultColor,
      });
      if (response.success) {
        const [normalizedTrack] = normalizeTracks([
          {
            ...response.data,
            isBackingTrack,
            trackType: trackTypeValue,
            color: response.data.color || defaultColor,
          },
        ]);
        if (normalizedTrack) {
          pushHistory();
          setTracks((prevTracks) => [...prevTracks, normalizedTrack]);
          if (isBackingTrack) {
            setBackingTrack(normalizedTrack);
          }
        }
        refreshProject();
      }
    } catch (err) {
      console.error("Error adding track:", err);
      setError(err.message || "Failed to add track");
    }
  };

  const handleUpdateTrack = async (trackId, updates) => {
    try {
      // Optimistic update - update track in local state immediately
      pushHistory();
      setTracks((prevTracks) =>
        prevTracks.map((track) =>
          track._id === trackId ? { ...track, ...updates } : track
        )
      );

      await updateTrack(projectId, trackId, updates);
      // Silent refresh in background to ensure sync
      refreshProject();
    } catch (err) {
      console.error("Error updating track:", err);
      // Revert on error by refreshing
      refreshProject();
    }
  };

  const openTrackMenu = useCallback((event, track) => {
    event.preventDefault();
    event.stopPropagation();
    const { clientX = 0, clientY = 0, currentTarget } = event;
    let x = clientX;
    let y = clientY;

    if (!x && !y && currentTarget) {
      const rect = currentTarget.getBoundingClientRect();
      x = rect.right;
      y = rect.bottom;
    }

    setTrackContextMenu({
      isOpen: true,
      x,
      y,
      trackId: track._id,
    });
  }, []);

  const handleTrackRename = (track) => {
    if (!track) return;
    closeTrackMenu();
    const newName = prompt("Rename track:", track.trackName || "Track");
    if (!newName) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === track.trackName) return;
    handleUpdateTrack(track._id, { trackName: trimmed });
  };

  const handleTrackColorChange = (track, color) => {
    if (!track || !color) return;
    handleUpdateTrack(track._id, { color });
  };

  const handleTrackMove = async (track, direction) => {
    if (!track || !direction) return;
    closeTrackMenu();
    const sorted = [...orderedTracks];
    const currentIndex = sorted.findIndex((t) => t._id === track._id);
    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const targetTrack = sorted[targetIndex];
    const currentOrder =
      typeof track.trackOrder === "number" ? track.trackOrder : currentIndex;
    const targetOrder =
      typeof targetTrack.trackOrder === "number"
        ? targetTrack.trackOrder
        : targetIndex;

    pushHistory();
    setTracks((prev) =>
      prev.map((t) => {
        if (t._id === track._id) {
          return { ...t, trackOrder: targetOrder };
        }
        if (t._id === targetTrack._id) {
          return { ...t, trackOrder: currentOrder };
        }
        return t;
      })
    );

    try {
      await Promise.all([
        updateTrack(projectId, track._id, { trackOrder: targetOrder }),
        updateTrack(projectId, targetTrack._id, { trackOrder: currentOrder }),
      ]);
      refreshProject();
    } catch (err) {
      console.error("Error reordering tracks:", err);
      refreshProject();
    }
  };

  const handleTrackDelete = async (track) => {
    if (!track) return;
    closeTrackMenu();
    if (
      !window.confirm(
        "Delete this track and all of its clips? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await deleteTrack(projectId, track._id);
      pushHistory();
      setTracks((prev) => prev.filter((t) => t._id !== track._id));
      if (track.isBackingTrack) {
        setBackingTrack(null);
      }
      if (
        focusedClipId &&
        (track.items || []).some((item) => item._id === focusedClipId)
      ) {
        setFocusedClipId(null);
      }
      refreshProject();
    } catch (err) {
      console.error("Error deleting track:", err);
      refreshProject();
    }
  };

  // Handle clip dragging with smooth real-time updates (direct DOM, absolute positioning)
  // Professional DAW behavior: The point you click stays under your cursor during drag
  useEffect(() => {
    if (!isDraggingItem || !selectedItem) return;

    let currentItem = null;
    let currentTrack = null;

    const candidateTracks = dragOffset.trackId
      ? tracks.filter((track) => track._id === dragOffset.trackId)
      : tracks;

    candidateTracks.forEach((track) => {
      const item = track.items?.find((i) => i._id === selectedItem);
      if (item) {
        currentItem = item;
        currentTrack = track;
      }
    });

    if (!currentItem || !currentTrack) return;

    const clipElement = clipRefs.current.get(selectedItem);
    if (!clipElement) return;

    const originalZIndex = clipElement.style.zIndex;
    const originalCursor = clipElement.style.cursor;
    clipElement.style.zIndex = "100";
    clipElement.style.cursor = "grabbing";

    // Professional DAW Logic:
    // 1. Record where user clicked INSIDE the clip (offset from clip's left edge)
    // 2. During drag, keep that point under the cursor
    // 3. Only startTime changes, offset and duration stay constant
    const computeNewStartTime = (event) => {
      if (!timelineRef.current || !dragStateRef.current) {
        return currentItem.startTime;
      }
      const timelineElement = timelineRef.current;
      const timelineRect = timelineElement.getBoundingClientRect();
      const scrollLeft = timelineElement.scrollLeft || 0;

      // Current mouse position in timeline coordinates
      const currentPointerX = event.clientX - timelineRect.left + scrollLeft;

      // Where the user originally clicked (in timeline coordinates)
      const originPointerX = dragStateRef.current.originPointerX;

      // How far the mouse has moved
      const deltaX = currentPointerX - originPointerX;

      // Calculate new startTime: original start + mouse movement
      // The click offset (dragOffset.x) is already accounted for in originPointerX
      const newStartTime =
        dragStateRef.current.originStart + deltaX / pixelsPerSecond;

      return Math.max(0, newStartTime);
    };

    const handleMouseMove = (event) => {
      const newStartTime = computeNewStartTime(event);
      const newLeftPixel = newStartTime * pixelsPerSecond;
      clipElement.style.left = `${newLeftPixel}px`;
      // Don't update state here to avoid re-render lag during drag
    };

    const handleMouseUp = async (event) => {
      const newStartTime = computeNewStartTime(event);
      const finalTime = Math.max(0, newStartTime);

      clipElement.style.zIndex = originalZIndex;
      clipElement.style.cursor = originalCursor || "move";

      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      // Optional snapping: Hold Shift to disable snapping (like professional DAWs)
      const shouldSnap = !event.shiftKey;
      const finalSnappedTime = shouldSnap
        ? applyMagnet(finalTime, currentTrack, selectedItem)
        : finalTime;

      // Push history once before making changes
      pushHistory();

      // Handle clip overlap: Trim overlapping clips (like openDAW/Ableton)
      const trimmedTracks = handleClipOverlap(
        currentTrack,
        selectedItem,
        finalSnappedTime,
        currentItem.duration
      );

      // Update state IMMEDIATELY with overlap handling
      setTracks((prevTracks) =>
        prevTracks.map((track) => {
          if (track._id !== currentTrack._id) return track;
          return trimmedTracks;
        })
      );

      // Final update (this will also save to DB) - don't push history again
      await handleClipMove(selectedItem, finalSnappedTime, {
        skipHistory: true,
      });

      setIsDraggingItem(false);
      setSelectedItem(null);
      setDragOffset({ x: 0, trackId: null });
      dragStateRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      clipElement.style.zIndex = originalZIndex;
      clipElement.style.cursor = originalCursor;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isDraggingItem,
    selectedItem,
    pixelsPerSecond,
    tracks,
    dragOffset,
    applyMagnet,
  ]);

  const handleClipResize = useCallback(
    async (itemId, updates) => {
      const chordIndex = getChordIndexFromId(itemId);
      if (chordIndex !== null) {
        // Chord blocks have fixed duration for now
        return;
      }

      const sanitized = {};
      if (updates.startTime !== undefined) {
        sanitized.startTime = Math.max(0, updates.startTime);
      }
      if (updates.duration !== undefined) {
        sanitized.duration = Math.max(MIN_CLIP_DURATION, updates.duration);
      }
      if (updates.offset !== undefined) {
        sanitized.offset = Math.max(0, updates.offset);
      }

      if (!Object.keys(sanitized).length) {
        return;
      }

      // Use functional update to get the LATEST state (not stale)
      // This ensures we don't overwrite data that was just updated in handleMouseUp
      setTracks((prevTracks) =>
        prevTracks.map((track) => {
          const hasClip = (track.items || []).some(
            (item) => item._id === itemId
          );
          if (!hasClip) return track;

          // Find the current item with ALL its data (waveform, lickId, etc.)
          const currentItem = (track.items || []).find(
            (item) => item._id === itemId
          );
          if (!currentItem) return track;

          // Check if values are already updated (avoid unnecessary re-render)
          const needsUpdate =
            (sanitized.startTime !== undefined &&
              currentItem.startTime !== sanitized.startTime) ||
            (sanitized.duration !== undefined &&
              currentItem.duration !== sanitized.duration) ||
            (sanitized.offset !== undefined &&
              currentItem.offset !== sanitized.offset);

          if (!needsUpdate) return track;

          // Merge updates while preserving ALL original data
          const updatedItem = {
            ...currentItem, // Preserve ALL original data (waveform, lickId, sourceDuration, etc.)
            ...sanitized, // Apply only the sanitized updates
          };

          return {
            ...track,
            items: (track.items || []).map((item) =>
              item._id === itemId ? normalizeTimelineItem(updatedItem) : item
            ),
          };
        })
      );

      // mark dirty & schedule autosave; actual DB write is deferred
      markTimelineItemDirty(itemId);
      scheduleTimelineAutosave();
    },
    [markTimelineItemDirty, scheduleTimelineAutosave]
  );

  useEffect(() => {
    if (!resizeState) return;

    const clipElement = clipRefs.current.get(resizeState.clipId);
    if (!clipElement) return;

    const waveformElement = clipElement.querySelector(
      '[data-clip-waveform="true"]'
    );
    const originalStyles = {
      width: clipElement.style.width,
      left: clipElement.style.left,
      waveformLeft: waveformElement?.style.left ?? null,
    };

    const computeResizeValues = (event) => {
      const deltaX = event.clientX - resizeState.startX;
      const deltaSeconds = deltaX / pixelsPerSecond;

      if (resizeState.edge === "left") {
        const lowerBound = Math.max(
          -resizeState.originStart,
          -resizeState.originOffset
        );
        const upperBound = resizeState.originDuration - MIN_CLIP_DURATION;
        const clampedDelta = Math.min(
          Math.max(deltaSeconds, lowerBound),
          upperBound
        );

        const startTime = resizeState.originStart + clampedDelta;
        const duration = Math.max(
          MIN_CLIP_DURATION,
          resizeState.originDuration - clampedDelta
        );
        const offset = Math.max(0, resizeState.originOffset + clampedDelta);

        return {
          startTime,
          duration,
          offset,
          isLeft: true,
        };
      }

      const lowerBound = MIN_CLIP_DURATION - resizeState.originDuration;
      const availableTail =
        (resizeState.sourceDuration || 0) -
        (resizeState.originOffset + resizeState.originDuration);
      const upperBound = Math.max(0, availableTail);
      const clampedDelta = Math.min(
        Math.max(deltaSeconds, lowerBound),
        upperBound
      );
      const duration = Math.max(
        MIN_CLIP_DURATION,
        resizeState.originDuration + clampedDelta
      );

      return {
        duration,
        isLeft: false,
      };
    };

    const handleMouseMove = (event) => {
      const values = computeResizeValues(event);
      if (!values) return;

      if (values.duration !== undefined) {
        clipElement.style.width = `${values.duration * pixelsPerSecond}px`;
      }

      if (values.isLeft && values.startTime !== undefined) {
        clipElement.style.left = `${values.startTime * pixelsPerSecond}px`;

        if (waveformElement && values.offset !== undefined) {
          waveformElement.style.left = `-${values.offset * pixelsPerSecond}px`;
        }
      }
      // Don't update state here to avoid re-render lag during resize
    };

    const handleMouseUp = async (event) => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      const finalValues = computeResizeValues(event) || {};
      const clipId = resizeState.clipId;
      setResizeState(null);

      // Update state IMMEDIATELY using functional update to get latest data
      // This ensures we preserve ALL original clip data (waveform, lickId, etc.)
      if (Object.keys(finalValues).length > 0) {
        setTracks((prevTracks) => {
          // Find the current clip with ALL its data from the latest state
          let currentClip = null;
          for (const track of prevTracks) {
            const found = (track.items || []).find(
              (item) => item._id === clipId
            );
            if (found) {
              currentClip = found;
              break;
            }
          }

          if (!currentClip) return prevTracks;

          // Merge updates while preserving ALL original data
          const updatedItem = {
            ...currentClip, // Preserve ALL original data (waveform, lickId, sourceDuration, etc.)
            ...finalValues, // Apply the resize values
          };

          return prevTracks.map((track) => {
            const hasClip = (track.items || []).some(
              (item) => item._id === clipId
            );
            if (!hasClip) return track;
            return {
              ...track,
              items: (track.items || []).map((item) =>
                item._id === clipId ? normalizeTimelineItem(updatedItem) : item
              ),
            };
          });
        });
      }

      // Final update with validation (this will also save to DB)
      // handleClipResize uses functional updates so it will get the latest state
      await handleClipResize(clipId, finalValues);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      // Don't reset styles on cleanup - let React re-render with updated state
      // Resetting styles here causes the "snap back" bug
    };
  }, [resizeState, pixelsPerSecond, handleClipResize]);

  const handleClipMouseDown = (e, item, trackId) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't start drag if clicking on resize handles or delete button
    if (
      e.target.closest("[data-resize-handle]") ||
      e.target.closest("button")
    ) {
      return;
    }

    setSelectedItem(item._id);
    setFocusedClipId(item._id);

    if (timelineRef.current) {
      const timelineRect = timelineRef.current.getBoundingClientRect();
      const scrollLeft = timelineRef.current.scrollLeft || 0;

      // Where the user clicked in timeline coordinates
      const pointerX = e.clientX - timelineRect.left + scrollLeft;

      // Where the clip currently starts in timeline coordinates
      const itemStartX = (item.startTime || 0) * pixelsPerSecond;

      // How far from the clip's left edge the user clicked (in pixels)
      const clickOffsetX = pointerX - itemStartX;

      // Store the original state for smooth dragging
      dragStateRef.current = {
        originStart: item.startTime || 0,
        originPointerX: pointerX, // Where user clicked (absolute timeline position)
      };

      setDragOffset({
        x: Number.isFinite(clickOffsetX) ? Math.max(0, clickOffsetX) : 0,
        trackId,
      });
    } else {
      dragStateRef.current = {
        originStart: item.startTime || 0,
        originPointerX: 0,
      };
      setDragOffset({ x: 0, trackId: trackId || null });
    }
    setIsDraggingItem(true);
  };

  const startClipResize = (e, item, trackId, edge = "right") => {
    e.preventDefault();
    e.stopPropagation();
    if (!item || !trackId) return;
    setFocusedClipId(item._id);
    setSelectedItem(item._id);
    setIsDraggingItem(false);
    pushHistory();
    setResizeState({
      clipId: item._id,
      trackId,
      edge,
      originDuration: item.duration || MIN_CLIP_DURATION,
      originStart: item.startTime || 0,
      originOffset: item.offset || 0,
      sourceDuration:
        item.sourceDuration ||
        item.lickId?.duration ||
        (item.offset || 0) + (item.duration || 0),
      startX: e.clientX,
    });
  };

  // Handle clip move
  const handleClipMove = async (itemId, newStartTime, options = {}) => {
    if (newStartTime < 0) return;
    const chordIndex = getChordIndexFromId(itemId);
    if (chordIndex !== null) {
      const targetIndex = Math.max(
        0,
        Math.round(newStartTime / chordDurationSeconds)
      );
      reorderChordProgression(chordIndex, targetIndex);
      return;
    }

    // Only push history if not skipped (e.g., when called from drag handler)
    if (!options.skipHistory) {
      pushHistory();
    }

    // Update state to ensure consistency
    setTracks((prevTracks) =>
      prevTracks.map((track) => {
        const hasClip = (track.items || []).some((item) => item._id === itemId);
        if (!hasClip) return track;
        return {
          ...track,
          items: (track.items || []).map((item) =>
            item._id === itemId
              ? normalizeTimelineItem({ ...item, startTime: newStartTime })
              : item
          ),
        };
      })
    );

    // mark dirty & schedule autosave; actual DB write is deferred
    markTimelineItemDirty(itemId);
    scheduleTimelineAutosave();
  };

  function getChordDuration() {
    // Each chord gets 4 beats (1 measure in 4/4)
    return 4;
  }

  // Calculate chord width in pixels (4 beats = 1 measure)
  const getChordWidth = () => {
    return getChordDuration() * pixelsPerBeat;
  };

  // Calculate chord start position in pixels
  const getChordStartPosition = (chordIndex) => {
    return chordIndex * getChordWidth();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-6">
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-400">{error}</p>
        </div>
        <button
          className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-2 rounded-md"
          onClick={() => navigate("/projects")}
        >
          Back to Projects
        </button>
      </div>
    );
  }

  if (!project) return null;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  const menuTrackIndex = menuTrack
    ? orderedTracks.findIndex((track) => track._id === menuTrack._id)
    : -1;
  const canMoveMenuUp = menuTrackIndex > 0;
  const canMoveMenuDown =
    menuTrackIndex > -1 && menuTrackIndex < orderedTracks.length - 1;
  const timelineWidth = calculateTimelineWidth();
  const toolbarButtonClasses = (isActive, disabled) =>
    [
      "w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors",
      disabled
        ? "bg-gray-800 text-gray-500 cursor-not-allowed"
        : isActive
        ? "bg-white text-gray-900"
        : "bg-gray-800 text-gray-200 hover:bg-gray-700",
    ].join(" ");
  const workspaceScalePercentage = Math.round(workspaceScale * 100);

  return (
    <div className="h-screen w-full overflow-hidden bg-black">
      <div
        className="flex flex-col h-screen bg-black text-white overflow-hidden"
        style={{
          transform: `scale(${workspaceScale})`,
          transformOrigin: "top left",
          width: `${(1 / workspaceScale) * 100}%`,
          height: `${(1 / workspaceScale) * 100}%`,
        }}
      >
        {/* Top Bar - Minimal, Professional */}
        <div className="bg-gray-950 border-b border-gray-800/50 px-4 py-2">
          <div className="flex flex-wrap items-center gap-2.5 justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/projects")}
                className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <FaTimes size={12} className="rotate-45" />
                Back
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={isDeleting}
                className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium border border-red-800 text-red-200 bg-red-900/40 hover:bg-red-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaTrash size={12} />
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
              <div className="flex items-center gap-1 bg-gray-800/70 rounded-full px-3 py-1">
                <button
                  type="button"
                  className={toolbarButtonClasses(
                    false,
                    !historyStatus.canUndo
                  )}
                  onClick={handleUndo}
                  disabled={!historyStatus.canUndo}
                  title="Undo"
                >
                  <FaUndo size={12} />
                </button>
                <button
                  type="button"
                  className={toolbarButtonClasses(
                    false,
                    !historyStatus.canRedo
                  )}
                  onClick={handleRedo}
                  disabled={!historyStatus.canRedo}
                  title="Redo"
                >
                  <FaRedo size={12} />
                </button>
                <button
                  type="button"
                  onClick={flushTimelineSaves}
                  disabled={isSavingTimeline || !hasUnsavedTimelineChanges}
                  className={toolbarButtonClasses(
                    hasUnsavedTimelineChanges,
                    isSavingTimeline || !hasUnsavedTimelineChanges
                  )}
                  title="Save timeline changes"
                >
                  Save
                </button>
                <span className="text-[10px] uppercase tracking-wide text-gray-400">
                  {isSavingTimeline
                    ? "Saving..."
                    : hasUnsavedTimelineChanges
                    ? "Unsaved edits"
                    : "All changes saved"}
                </span>
                <button
                  type="button"
                  className={toolbarButtonClasses(metronomeEnabled, false)}
                  onClick={() => setMetronomeEnabled((prev) => !prev)}
                  title="Metronome"
                >
                  <RiPulseFill size={12} />
                </button>
              </div>
              <div className="flex items-center gap-1 bg-gray-800/60 rounded-full px-3 py-1 text-xs text-gray-300">
                <button
                  type="button"
                  onClick={() => setZoomLevel(Math.max(0.25, zoomLevel - 0.25))}
                  className="px-2 py-0.5 rounded-full bg-gray-900 hover:bg-gray-700 text-white"
                  title="Zoom out"
                >
                  −
                </button>
                <span className="min-w-[48px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel(Math.min(4, zoomLevel + 0.25))}
                  className="px-2 py-0.5 rounded-full bg-gray-900 hover:bg-gray-700 text-white"
                  title="Zoom in"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-1 bg-gray-800/60 rounded-full px-3 py-1 text-xs text-gray-300">
                <span className="uppercase text-gray-400">Display</span>
                <button
                  type="button"
                  onClick={() => adjustWorkspaceScale(-WORKSPACE_SCALE_STEP)}
                  disabled={workspaceScale <= MIN_WORKSPACE_SCALE + 0.001}
                  className="px-2 py-0.5 rounded-full bg-gray-900 hover:bg-gray-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Scale entire workspace down"
                >
                  −
                </button>
                <span className="min-w-[48px] text-center">
                  {workspaceScalePercentage}%
                </span>
                <button
                  type="button"
                  onClick={() => adjustWorkspaceScale(WORKSPACE_SCALE_STEP)}
                  disabled={workspaceScale >= MAX_WORKSPACE_SCALE - 0.001}
                  className="px-2 py-0.5 rounded-full bg-gray-900 hover:bg-gray-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Scale entire workspace up"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-center">
              <div className="flex items-center bg-gray-800 rounded-full px-3 py-1 text-sm text-white gap-2">
                <span className="text-xs uppercase text-gray-400">Tempo</span>
                <input
                  type="number"
                  min={40}
                  max={300}
                  value={tempoDraft}
                  onChange={(e) => setTempoDraft(e.target.value)}
                  onBlur={commitTempoChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitTempoChange();
                    }
                  }}
                  className="bg-transparent w-16 text-white text-sm focus:outline-none"
                />
                <span className="text-xs text-gray-400">bpm</span>
              </div>
              <div className="flex items-center bg-gray-800 rounded-full px-3 py-1 text-sm text-white gap-2">
                <span className="text-xs uppercase text-gray-400">Time</span>
                <select
                  value={projectTimeSignatureName}
                  onChange={(e) => handleTimeSignatureChange(e.target.value)}
                  className="bg-transparent text-white text-sm focus:outline-none"
                >
                  {TIME_SIGNATURES.map((signature) => (
                    <option
                      key={signature}
                      className="bg-gray-900"
                      value={signature}
                    >
                      {signature}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center bg-gray-800 rounded-full px-3 py-1 text-sm text-white gap-2">
                <span className="text-xs uppercase text-gray-400">Key</span>
                <select
                  value={projectKeyName || "C Major"}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  className="bg-transparent text-white text-sm focus:outline-none"
                >
                  {KEY_OPTIONS.map((keyOption) => (
                    <option
                      key={keyOption}
                      className="bg-gray-900"
                      value={keyOption}
                    >
                      {keyOption}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center bg-gray-800 rounded-full px-3 py-1 text-sm text-white gap-2">
                <span className="text-xs uppercase text-gray-400">Swing</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Number(swingDraft)}
                  onChange={(e) => setSwingDraft(e.target.value)}
                  onMouseUp={commitSwingChange}
                  onTouchEnd={commitSwingChange}
                  className="w-24 accent-orange-500"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={swingDraft}
                  onChange={(e) => setSwingDraft(e.target.value)}
                  onBlur={commitSwingChange}
                  className="bg-transparent w-12 text-white text-sm focus:outline-none"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>

            {/* Transport Controls - Extracted Component */}
            <AudioTransportControls
              isPlaying={isPlaying}
              recordArmed={recordArmed}
              loopEnabled={loopEnabled}
              formattedPlayTime={formattedPlayTime}
              onPlay={handlePlay}
              onPause={handlePause}
              onStop={handleStop}
              onReturnToStart={handleReturnToStart}
              onRecordToggle={handleRecordToggle}
              onLoopToggle={() => setLoopEnabled((prev) => !prev)}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between text-xs text-gray-400">
            <span>
              {project.title} • {formatDate(project.createdAt)}
            </span>
            <span>
              Zoom {Math.round(zoomLevel * 100)}% · Display{" "}
              {workspaceScalePercentage}% · {projectTimeSignatureName} ·{" "}
              {projectKeyName || "Key"}
            </span>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Timeline Area - Always Visible */}
          <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden min-h-0">
            <div className="flex border-b border-gray-800 h-6">
              <div className="w-64 bg-gray-950 border-r border-gray-800 px-3 py-1.5 flex items-center">
                <button
                  onClick={handleAddTrack}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  <FaPlus size={10} />
                  Add a track
                </button>
              </div>
              <div className="flex-1 bg-gray-900 px-3 text-[10px] uppercase tracking-wide text-gray-500 flex items-center">
                Drag licks or chords onto any track to build your arrangement
              </div>
            </div>
            {/* Timeline Grid with Right Panel */}
            <div className="flex-1 flex overflow-hidden">
              {/* Main Timeline Area */}
              <div
                className="flex-1 overflow-auto relative"
                ref={timelineRef}
                onClick={() => {
                  setFocusedClipId(null);
                  closeTrackMenu();
                }}
              >
                {/* Time Ruler with Beat Markers */}
                <div className="sticky top-0 z-20 flex">
                  <div className="w-64 bg-gray-950 border-r border-gray-800 h-6 flex items-center px-4 text-xs font-semibold uppercase tracking-wide text-gray-400 sticky left-0 z-20">
                    Track
                  </div>
                  <div className="flex-1 relative bg-gray-800 border-b border-gray-700 h-6 flex items-end">
                    {/* Measure markers (every 4 beats) */}
                    {Array.from({
                      length:
                        Math.ceil(
                          timelineWidth / pixelsPerBeat / beatsPerMeasure
                        ) + 1,
                    }).map((_, measureIndex) => {
                      const measureTime =
                        measureIndex * beatsPerMeasure * secondsPerBeat;
                      const measurePosition = measureTime * pixelsPerSecond;
                      return (
                        <div
                          key={`measure-${measureIndex}`}
                          className="absolute border-l-2 border-blue-500 h-full flex items-end pb-1"
                          style={{ left: `${measurePosition}px` }}
                        >
                          <span className="text-xs text-blue-400 font-medium px-1">
                            {measureIndex + 1}
                          </span>
                        </div>
                      );
                    })}

                    {/* Beat markers */}
                    {Array.from({
                      length:
                        Math.ceil(calculateTimelineWidth() / pixelsPerBeat) + 1,
                    }).map((_, beatIndex) => {
                      const beatTime = beatIndex * secondsPerBeat;
                      const beatPosition = beatTime * pixelsPerSecond;
                      const isMeasureStart = beatIndex % beatsPerMeasure === 0;
                      return (
                        <div
                          key={`beat-${beatIndex}`}
                          className={`absolute border-l h-full ${
                            isMeasureStart
                              ? "border-blue-500"
                              : "border-gray-600"
                          }`}
                          style={{ left: `${beatPosition}px` }}
                        />
                      );
                    })}

                    {/* Second markers */}
                    {Array.from({
                      length:
                        Math.ceil(calculateTimelineWidth() / pixelsPerSecond) +
                        1,
                    }).map((_, i) => (
                      <div
                        key={`sec-${i}`}
                        className="absolute border-l border-gray-700 h-4 bottom-0"
                        style={{ left: `${i * pixelsPerSecond}px` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Playhead */}
                {(playbackPosition > 0 || isPlaying) && (
                  <div
                    ref={playheadRef}
                    className="absolute top-10 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none"
                    style={{
                      left: `${
                        TRACK_COLUMN_WIDTH + playbackPosition * pixelsPerSecond
                      }px`,
                    }}
                  >
                    <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
                  </div>
                )}

                {/* Track Lanes */}
                {orderedTracks.map((track, trackIndex) => {
                  const isHoveringTrack = dragOverTrack === track._id;
                  const isMenuOpen =
                    trackContextMenu.isOpen &&
                    trackContextMenu.trackId === track._id;
                  const trackAccent = track.color || "#2563eb";
                  const readableTrackName = formatTrackTitle(
                    track.trackName || "Track"
                  );
                  return (
                    <div
                      key={track._id}
                      className="flex border-b border-gray-800"
                      style={{ minHeight: "90px" }}
                    >
                      <div
                        className={`w-64 border-r border-gray-800/50 p-2 flex flex-col gap-1.5 sticky left-0 z-10 ${
                          isMenuOpen
                            ? "bg-gray-800/80"
                            : isHoveringTrack
                            ? "bg-gray-900/80"
                            : "bg-gray-950"
                        }`}
                        style={{
                          minHeight: "inherit",
                          borderLeft: `4px solid ${trackAccent}`,
                        }}
                        onContextMenu={(e) => openTrackMenu(e, track)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTrackId(track._id);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{
                                backgroundColor: trackAccent,
                                boxShadow:
                                  selectedTrackId === track._id
                                    ? `0 0 8px ${trackAccent}`
                                    : "none",
                              }}
                            />
                            <span
                              className={`text-white font-medium text-sm truncate ${
                                selectedTrackId === track._id
                                  ? "text-orange-400"
                                  : ""
                              }`}
                            >
                              {readableTrackName}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              className="text-gray-500 hover:text-white p-1 rounded"
                              title="Track options"
                              onClick={(e) => openTrackMenu(e, track)}
                            >
                              <FaEllipsisV size={12} />
                            </button>
                            <button
                              onClick={() =>
                                handleUpdateTrack(track._id, {
                                  muted: !track.muted,
                                })
                              }
                              className={`w-6 h-6 rounded text-xs font-bold ${
                                track.muted
                                  ? "bg-red-600 text-white"
                                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                              }`}
                              title="Mute"
                            >
                              M
                            </button>
                            <button
                              onClick={() =>
                                handleUpdateTrack(track._id, {
                                  solo: !track.solo,
                                })
                              }
                              className={`w-6 h-6 rounded text-xs font-bold ${
                                track.solo
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                              }`}
                              title="Solo"
                            >
                              S
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={track.volume}
                            onChange={(e) =>
                              handleUpdateTrack(track._id, {
                                volume: parseFloat(e.target.value),
                              })
                            }
                            className="flex-1 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                            style={{ accentColor: trackAccent }}
                          />
                        </div>
                      </div>
                      <div
                        className="relative flex-1"
                        style={{
                          backgroundColor: isHoveringTrack
                            ? "rgba(255,255,255,0.05)"
                            : "transparent",
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (!timelineRef.current) return;
                          const trackRect =
                            e.currentTarget.getBoundingClientRect();
                          const scrollLeft =
                            timelineRef.current.scrollLeft || 0;
                          const x = e.clientX - trackRect.left + scrollLeft;
                          const startTime = Math.max(0, x / pixelsPerSecond);
                          handleDragOver(e, track._id, startTime);
                        }}
                        onDrop={(e) => {
                          if (!timelineRef.current) return;
                          const trackRect =
                            e.currentTarget.getBoundingClientRect();
                          const scrollLeft =
                            timelineRef.current.scrollLeft || 0;
                          const x = e.clientX - trackRect.left + scrollLeft;
                          const rawTime = Math.max(0, x / pixelsPerSecond);
                          const magnetTime = applyMagnet(rawTime, track, null);
                          handleDrop(e, track._id, magnetTime);
                        }}
                      >
                        {/* Wavy Background Pattern */}
                        <div
                          className="absolute inset-0 opacity-10"
                          style={{
                            backgroundImage: `repeating-linear-gradient(
                      45deg,
                      transparent,
                      transparent 10px,
                      rgba(255,255,255,0.1) 10px,
                      rgba(255,255,255,0.1) 20px
                    )`,
                          }}
                        />

                        {/* Timeline Items (Clips and Chord Blocks) */}
                        {(() => {
                          const timelineItems = track.items || [];
                          const hasTimelineChords = timelineItems.some(
                            (clip) => clip?.type === "chord"
                          );
                          const combinedItems =
                            track.isBackingTrack &&
                            chordItems?.length &&
                            !hasTimelineChords
                              ? [...timelineItems, ...chordItems]
                              : timelineItems;

                          return combinedItems
                            .sort(
                              (a, b) => (a.startTime || 0) - (b.startTime || 0)
                            )
                            .map((item) => {
                              const isSelected =
                                focusedClipId === item._id ||
                                selectedItem === item._id;

                              // Calculate Dimensions & Position
                              const clipWidth = item.duration * pixelsPerSecond;
                              const clipLeft = item.startTime * pixelsPerSecond;

                              // Determine Labels
                              const isVirtualChord =
                                typeof item._id === "string" &&
                                item._id.startsWith("chord-");
                              const isTimelineChord =
                                item.type === "chord" && !isVirtualChord;
                              const isChord =
                                isTimelineChord ||
                                isVirtualChord ||
                                item._isChord ||
                                (item.chord &&
                                  (track.trackType === "backing" ||
                                    track.isBackingTrack) &&
                                  !item.lickId);

                              const mainLabel = isChord
                                ? item.chordName || item.chord || "Chord"
                                : formatLabelValue(item.lickId?.title) ||
                                  formatLabelValue(item.title) ||
                                  formatLabelValue(item.name) ||
                                  formatLabelValue(item.trackName) ||
                                  readableTrackName ||
                                  "Clip";

                              const trackInstrumentLabel =
                                formatLabelValue(track.instrumentStyle) ||
                                formatLabelValue(track.instrument) ||
                                (track.isBackingTrack
                                  ? "Backing Instrument"
                                  : "") ||
                                readableTrackName;
                              const instrumentLabel =
                                formatLabelValue(item.instrumentStyle) ||
                                trackInstrumentLabel;

                              const subLabel = isChord
                                ? (() => {
                                    const rhythmVisual =
                                      getRhythmPatternVisual(item);
                                    const patternLabel =
                                      rhythmVisual?.label || null;
                                    const formattedPatternLabel =
                                      formatLabelValue(patternLabel);
                                    return [
                                      formattedPatternLabel,
                                      instrumentLabel,
                                    ]
                                      .filter((label) => label && label.trim())
                                      .join(" • ");
                                  })()
                                : instrumentLabel || readableTrackName || null;

                              const trackAccent = track.color || "#2563eb";
                              const isMuted = Boolean(
                                track.muted || item.muted
                              );

                              // Prepare MIDI data for MidiClip component
                              // For chords, compute MIDI events using getChordMidiEvents
                              // For other items, use existing customMidiEvents or midiNotes
                              let itemWithMidi = { ...item };

                              if (isChord) {
                                // For chords, compute MIDI events from chord data and rhythm patterns
                                const rhythmVisual =
                                  getRhythmPatternVisual(item);
                                const patternSteps = rhythmVisual?.steps || [];
                                const chordMidiEvents = getChordMidiEvents(
                                  item,
                                  item.duration,
                                  patternSteps
                                );
                                // Always set customMidiEvents, even if empty, so MidiClip knows to process it
                                itemWithMidi = {
                                  ...item,
                                  customMidiEvents: chordMidiEvents,
                                };
                              } else {
                                // For non-chord items (licks, etc.), check if they have MIDI data
                                // If customMidiEvents exists, use it; otherwise check midiNotes
                                if (
                                  !item.customMidiEvents ||
                                  item.customMidiEvents.length === 0
                                ) {
                                  if (
                                    item.midiNotes &&
                                    Array.isArray(item.midiNotes) &&
                                    item.midiNotes.length > 0
                                  ) {
                                    // Convert midiNotes array to customMidiEvents format
                                    const duration = item.duration || 1;
                                    itemWithMidi = {
                                      ...item,
                                      customMidiEvents: item.midiNotes.map(
                                        (pitch) => ({
                                          pitch: Number(pitch),
                                          startTime: 0,
                                          duration: duration,
                                          velocity: 0.8,
                                        })
                                      ),
                                    };
                                  } else if (
                                    item.lickId?.midiNotes &&
                                    Array.isArray(item.lickId.midiNotes) &&
                                    item.lickId.midiNotes.length > 0
                                  ) {
                                    // Check nested lickId.midiNotes
                                    const duration = item.duration || 1;
                                    itemWithMidi = {
                                      ...item,
                                      customMidiEvents:
                                        item.lickId.midiNotes.map((pitch) => ({
                                          pitch: Number(pitch),
                                          startTime: 0,
                                          duration: duration,
                                          velocity: 0.8,
                                        })),
                                    };
                                  }
                                }
                                // If customMidiEvents already exists, itemWithMidi is already correct
                              }

                              // Show waveform for licks OR chord items with generated audio
                              const showWaveform =
                                (item.type === "lick" &&
                                  item.lickId?.waveformData) ||
                                (item.type === "chord" &&
                                  (item.waveformData ||
                                    item.audioUrl ||
                                    item.lickId?.waveformData));
                              const showResizeHandles = !isVirtualChord;

                              // Calculate loop notches
                              const loopSegmentDuration =
                                item.loopEnabled && item.sourceDuration
                                  ? item.sourceDuration
                                  : null;
                              const loopRepeats =
                                loopSegmentDuration && loopSegmentDuration > 0
                                  ? Math.floor(
                                      item.duration / loopSegmentDuration
                                    )
                                  : 0;
                              const loopNotches = Math.max(0, loopRepeats - 1);

                              return (
                                <div
                                  key={item._id}
                                  ref={(el) => {
                                    if (el) {
                                      clipRefs.current.set(item._id, el);
                                    } else {
                                      clipRefs.current.delete(item._id);
                                    }
                                  }}
                                  className={`absolute rounded-md overflow-hidden cursor-pointer group border 
                                    ${
                                      isSelected
                                        ? "border-yellow-400 shadow-md z-50"
                                        : "border-transparent z-10"
                                    }
                                  `}
                                  style={{
                                    left: `${clipLeft}px`,
                                    width: `${clipWidth}px`,
                                    top: "4px",
                                    bottom: "4px", // Use flex height to fill track lane
                                    height: "auto", // Allow it to stretch
                                    backgroundColor: trackAccent, // Fallback color
                                    opacity:
                                      isDraggingItem &&
                                      selectedItem === item._id
                                        ? 0.8
                                        : isMuted
                                        ? 0.45
                                        : 1,
                                    filter: isMuted
                                      ? "grayscale(0.35)"
                                      : undefined,
                                    transition:
                                      isDraggingItem &&
                                      selectedItem === item._id
                                        ? "none"
                                        : "left 0.1s, width 0.1s", // Disable transition during drag
                                  }}
                                  onMouseDown={(e) =>
                                    handleClipMouseDown(e, item, track._id)
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFocusedClipId(item._id);
                                  }}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenMidiEditor(item);
                                  }}
                                >
                                  {/* 1. THE RENDERED CANVAS (The Data Layer) */}
                                  <div className="absolute inset-0 w-full h-full">
                                    {showWaveform ? (
                                      (() => {
                                        try {
                                          // Get waveform data from item directly, lickId, or nested property
                                          const waveformSource =
                                            item.waveformData ||
                                            item.lickId?.waveformData ||
                                            null;

                                          if (!waveformSource) return null;

                                          const waveform =
                                            typeof waveformSource === "string"
                                              ? JSON.parse(waveformSource)
                                              : waveformSource;
                                          const waveformArray = Array.isArray(
                                            waveform
                                          )
                                            ? waveform
                                            : [];

                                          if (!waveformArray.length)
                                            return null;

                                          // Get the actual current width from the DOM element
                                          // This ensures waveform stays correct even during resize drag
                                          const clipElement =
                                            clipRefs.current.get(item._id);
                                          const actualClipWidth =
                                            clipElement?.offsetWidth ||
                                            clipWidth;

                                          // ADAPTIVE DENSITY IMPLEMENTATION
                                          // 1. Determine the full source duration to map samples to time
                                          const fullSourceDuration =
                                            item.sourceDuration ||
                                            item.lickId?.duration ||
                                            item.duration ||
                                            1;

                                          // 2. Calculate sample rate of the data
                                          const totalSamples =
                                            waveformArray.length;
                                          const samplesPerSecond =
                                            totalSamples / fullSourceDuration;

                                          // 3. Determine the visible slice of audio
                                          const startSample = Math.floor(
                                            (item.offset || 0) *
                                              samplesPerSecond
                                          );
                                          const endSample = Math.floor(
                                            ((item.offset || 0) +
                                              (item.duration || 0)) *
                                              samplesPerSecond
                                          );

                                          // 4. Get the visible samples (clamped to array bounds)
                                          const visibleSamples =
                                            waveformArray.slice(
                                              Math.max(0, startSample),
                                              Math.min(totalSamples, endSample)
                                            );

                                          if (!visibleSamples.length)
                                            return null;

                                          // 5. Calculate step to achieve target density in the visible area
                                          // We want roughly 1 bar every 5 pixels (3px width + 2px gap)
                                          const targetBarCount = Math.max(
                                            10,
                                            Math.floor(actualClipWidth / 5)
                                          );

                                          const step = Math.max(
                                            1,
                                            Math.ceil(
                                              visibleSamples.length /
                                                targetBarCount
                                            )
                                          );

                                          return (
                                            <div className="absolute inset-0 overflow-hidden">
                                              <div
                                                data-clip-waveform="true"
                                                className="absolute top-0 bottom-0 h-full flex items-end gap-0.5 opacity-80 px-2 pointer-events-none"
                                                style={{
                                                  width: "100%", // Fill the visible clip
                                                  left: 0, // No offset needed as we sliced the data
                                                }}
                                              >
                                                {visibleSamples
                                                  .filter(
                                                    (_value, idx) =>
                                                      idx % step === 0
                                                  )
                                                  .map((value, idx) => (
                                                    <div
                                                      key={idx}
                                                      className="bg-white rounded-t"
                                                      style={{
                                                        width: "3px",
                                                        flexShrink: 0,
                                                        height: `${Math.min(
                                                          100,
                                                          Math.abs(value || 0) *
                                                            100
                                                        )}%`,
                                                      }}
                                                    />
                                                  ))}
                                              </div>
                                            </div>
                                          );
                                        } catch (e) {
                                          console.error("Waveform Error:", e);
                                          return null;
                                        }
                                      })()
                                    ) : (
                                      <MidiClip
                                        data={itemWithMidi}
                                        width={clipWidth} // Pass explicit width for canvas scaling
                                        height={82} // Approximate height of track lane (90px - padding)
                                        color={trackAccent}
                                        isSelected={isSelected}
                                        isMuted={isMuted}
                                      />
                                    )}
                                    {/* Always render MidiClip behind waveform if both exist */}
                                    {showWaveform &&
                                      (itemWithMidi.customMidiEvents?.length >
                                        0 ||
                                        itemWithMidi.midiNotes?.length > 0) && (
                                        <MidiClip
                                          data={itemWithMidi}
                                          width={clipWidth}
                                          height={82}
                                          color={trackAccent}
                                          isSelected={isSelected}
                                          isMuted={isMuted}
                                        />
                                      )}
                                  </div>

                                  {/* 2. THE HEADER TEXT (HTML Overlay) */}
                                  <div className="absolute top-0 left-0 right-0 h-6 px-2 flex items-center gap-2 pointer-events-none">
                                    <span className="text-[11px] font-bold text-white truncate drop-shadow-md">
                                      {mainLabel}
                                    </span>
                                    {clipWidth > 80 && subLabel && (
                                      <span className="text-[10px] text-white/70 truncate">
                                        {subLabel}
                                      </span>
                                    )}
                                    {loopNotches > 0 && (
                                      <div className="flex items-center gap-0.5 ml-auto">
                                        {Array.from({
                                          length: loopNotches,
                                        }).map((_loop, notchIdx) => (
                                          <span
                                            key={`loop-notch-${item._id}-${notchIdx}`}
                                            className="w-1 h-2 rounded-sm bg-white/70"
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* 3. RESIZE HANDLES (Keep existing logic) */}
                                  {showResizeHandles && (
                                    <div
                                      data-resize-handle="left"
                                      className="absolute left-0 top-0 bottom-0 w-3 cursor-w-resize hover:bg-white/20 z-20 transition-colors"
                                      onMouseDown={(e) =>
                                        startClipResize(
                                          e,
                                          item,
                                          track._id,
                                          "left"
                                        )
                                      }
                                    />
                                  )}
                                  {showResizeHandles && (
                                    <div
                                      data-resize-handle="right"
                                      className="absolute right-0 top-0 bottom-0 w-3 cursor-e-resize hover:bg-white/20 z-20 transition-colors"
                                      onMouseDown={(e) =>
                                        startClipResize(
                                          e,
                                          item,
                                          track._id,
                                          "right"
                                        )
                                      }
                                    />
                                  )}

                                  {/* 4. DELETE BUTTON (Only show on Hover/Select) */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFocusedClipId((prev) =>
                                        prev === item._id ? null : prev
                                      );
                                      if (isVirtualChord) {
                                        handleRemoveChord(item._id);
                                      } else {
                                        handleDeleteTimelineItem(item._id);
                                      }
                                    }}
                                    className={`absolute top-1 right-1 w-4 h-4 flex items-center justify-center text-white/50 hover:text-white hover:bg-red-500/80 rounded z-30 transition-opacity ${
                                      isSelected
                                        ? "opacity-100"
                                        : "opacity-0 group-hover:opacity-100"
                                    }`}
                                  >
                                    <FaTimes size={10} />
                                  </button>
                                </div>
                              );
                            });
                        })()}

                        {/* Drop Zone Indicator */}
                        {dragOverTrack === track._id &&
                          dragOverPosition !== null && (
                            <div
                              className="absolute top-0 bottom-0 border-2 border-dashed border-orange-500 bg-orange-500/10"
                              style={{
                                left: `${dragOverPosition * pixelsPerSecond}px`,
                                width: "100px",
                              }}
                            />
                          )}
                      </div>
                    </div>
                  );
                })}

                {/* Drop Zone Hint */}
                {draggedLick && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800/90 border border-gray-700 rounded-lg px-6 py-3 text-gray-300 text-sm">
                    Drag and drop a loop or audio/MIDI file here
                  </div>
                )}
              </div>

              {/* Right Side Panel - Chord Library */}
              <div
                className={`bg-gray-950 border-l border-gray-800 flex flex-col transition-all duration-300 ease-in-out ${
                  chordLibraryPanelOpen ? "w-80" : "w-0"
                } overflow-hidden`}
                style={{
                  width: chordLibraryPanelOpen
                    ? `${chordLibraryPanelWidth}px`
                    : "0px",
                }}
              >
                {chordLibraryPanelOpen && (
                  <>
                    {/* Panel Header - Minimal */}
                    <div className="px-3 py-1.5 border-b border-gray-800/50 flex items-center justify-between bg-gray-950">
                      <h3 className="text-white font-semibold text-xs uppercase tracking-wide text-gray-300">
                        Chord Library
                      </h3>
                      <button
                        onClick={() => setChordLibraryPanelOpen(false)}
                        className="text-gray-500 hover:text-white p-0.5 transition-colors"
                        title="Hide chord library"
                      >
                        <FaTimes size={11} />
                      </button>
                    </div>

                    {/* Chord Library Content - Compact Layout */}
                    <div className="flex-1 overflow-y-auto p-2.5">
                      <div className="mb-2.5 space-y-1.5">
                        {/* Key Filter Dropdown */}
                        {/* Key Filter Dropdown */}
                        <select
                          value={
                            selectedKeyFilter !== null
                              ? selectedKeyFilter
                              : projectKeyName
                          }
                          onChange={(e) => setSelectedKeyFilter(e.target.value)}
                          className="w-full bg-gray-800/80 border border-gray-700/50 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        >
                          <option value="">All Keys</option>
                          <option
                            value={projectKeyName}
                            className="bg-orange-600/80"
                          >
                            {projectKeyName} (current)
                          </option>
                          {allKeys
                            .filter((key) => key !== projectKeyName)
                            .map((key) => (
                              <option key={key} value={key}>
                                {key}
                              </option>
                            ))}
                        </select>
                        <p className="text-gray-500 text-[10px] px-0.5">
                          {chordPalette.length} chords
                          {(selectedKeyFilter || projectKeyName) &&
                            ` in ${selectedKeyFilter || projectKeyName}`}
                        </p>
                      </div>
                      {loadingChords && (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-orange-500"></div>
                        </div>
                      )}
                      {chordLibraryError && (
                        <p className="text-xs text-red-400 mb-2 px-1">
                          {chordLibraryError}
                        </p>
                      )}
                      {/* Compact Grid - 2 columns, smaller padding */}
                      <div className="grid grid-cols-2 gap-1">
                        {chordPalette.map((chord) => {
                          const key =
                            chord._id || chord.chordId || chord.chordName;
                          const isInProgression = chordProgression.some(
                            (c) =>
                              c.chordName === chord.chordName ||
                              c.name === chord.chordName
                          );
                          return (
                            <button
                              key={key}
                              draggable
                              onDragStart={() => handleChordDragStart(chord)}
                              onDragEnd={() => setDraggedChord(null)}
                              onClick={() => handleAddChord(chord)}
                              className={`group relative px-2 py-1.5 rounded text-[10px] font-medium transition-all cursor-grab active:cursor-grabbing text-left border ${
                                isInProgression
                                  ? "bg-gradient-to-br from-green-600 to-green-700 border-green-500 text-white shadow-sm"
                                  : "bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 border-blue-500 text-white hover:shadow-sm"
                              }`}
                              title={`${chord.chordName} - Click to add or drag to timeline`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className="block font-semibold text-xs truncate">
                                    {chord.chordName || "Chord"}
                                  </span>
                                  {(selectedKeyFilter || projectKeyName) && (
                                    <span className="text-[9px] bg-purple-600/50 px-1 py-0.5 rounded font-medium flex-shrink-0">
                                      {getChordDegree(
                                        chord.chordName || chord.name,
                                        selectedKeyFilter || projectKeyName
                                      ) || "?"}
                                    </span>
                                  )}
                                </div>
                                {isInProgression && (
                                  <span className="text-[9px] bg-green-800/50 px-0.5 rounded flex-shrink-0">
                                    ✓
                                  </span>
                                )}
                              </div>
                              {(chord.noteNames?.length ||
                                chord.midiNotes?.length) && (
                                <span className="text-[9px] opacity-75 mt-0.5 block truncate">
                                  {chord.noteNames?.slice(0, 3).join(", ") ||
                                    chord.midiNotes
                                      ?.slice(0, 3)
                                      .map(midiToNoteNameNoOctave)
                                      .join(", ")}
                                </span>
                              )}
                              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 rounded transition-colors"></div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Expand button for complex chords */}
                      {!showComplexChords && (
                        <button
                          onClick={loadComplexChords}
                          className="w-full mt-2 py-2 px-3 bg-orange-600 hover:bg-orange-700 border border-orange-500 rounded text-xs text-white font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <span>Show Complex Chords</span>
                          <span className="text-[10px] opacity-75">
                            (7ths, 9ths, sus, add, etc.)
                          </span>
                        </button>
                      )}

                      {/* Collapse button when showing complex chords */}
                      {showComplexChords && (
                        <button
                          onClick={() => setShowComplexChords(false)}
                          className="w-full mt-2 py-2 px-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-xs text-gray-300 hover:text-white transition-colors"
                        >
                          Show 7 Basic Diatonic Chords Only
                        </button>
                      )}

                      {chordProgression.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-800 text-[10px] text-gray-400 text-center">
                          {chordProgression.length} in progression
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Resize Handle - Right Panel */}
              {chordLibraryPanelOpen && (
                <div
                  className="w-1 bg-gray-800 hover:bg-gray-700 cursor-col-resize transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startWidth = chordLibraryPanelWidth;

                    const handleMouseMove = (moveEvent) => {
                      const diff = moveEvent.clientX - startX;
                      const newWidth = Math.max(
                        200,
                        Math.min(400, startWidth + diff)
                      );
                      setChordLibraryPanelWidth(newWidth);
                    };

                    const handleMouseUp = () => {
                      document.removeEventListener(
                        "mousemove",
                        handleMouseMove
                      );
                      document.removeEventListener("mouseup", handleMouseUp);
                    };

                    document.addEventListener("mousemove", handleMouseMove);
                    document.addEventListener("mouseup", handleMouseUp);
                  }}
                />
              )}
            </div>

            {/* Toggle Right Panel Button - Positioned relative to timeline area */}
            {!chordLibraryPanelOpen && (
              <button
                onClick={() => setChordLibraryPanelOpen(true)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-50 bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-l-lg border-l border-gray-700 shadow-lg"
                style={{ top: "50%" }}
                title="Show chord library"
              >
                <FaPalette size={14} />
              </button>
            )}
          </div>

          {/* Horizontal Bottom Panel (Tools/Libraries) */}
          <div
            className={`bg-gray-950 border-t border-gray-800 flex flex-col transition-all duration-300 ease-in-out ${
              sidePanelOpen ? "h-64" : "h-0"
            } overflow-hidden`}
            style={{ height: sidePanelOpen ? `${sidePanelWidth}px` : "0px" }}
          >
            {sidePanelOpen && (
              <>
                {/* Panel Header */}
                <div className="p-2 border-b border-gray-800 flex items-center justify-between">
                  <h3 className="text-white font-semibold text-sm">
                    Tools & Libraries
                  </h3>
                  <button
                    onClick={() => setSidePanelOpen(false)}
                    className="text-gray-400 hover:text-white p-1"
                    title="Hide panel"
                  >
                    <FaTimes size={14} />
                  </button>
                </div>

                {/* Tabs - Horizontal, Compact */}
                <div className="flex items-center border-b border-gray-800/50 bg-gray-900/50">
                  <button
                    onClick={() => setActiveTab("lick-library")}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeTab === "lick-library"
                        ? "bg-gray-800/80 text-red-400 border-b-2 border-red-400"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Lick Library
                  </button>
                  <button
                    onClick={() => setActiveTab("backing-track")}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeTab === "backing-track"
                        ? "bg-gray-800/80 text-indigo-400 border-b-2 border-indigo-400"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Backing Track
                  </button>
                  <button
                    onClick={() => setActiveTab("midi-editor")}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeTab === "midi-editor"
                        ? "bg-gray-800/80 text-white border-b-2 border-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    MIDI Editor
                  </button>
                  <button
                    onClick={() => setActiveTab("instrument")}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeTab === "instrument"
                        ? "bg-gray-800/80 text-cyan-400 border-b-2 border-cyan-400"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Instrument
                  </button>
                </div>

                {/* Tab Content - Scrollable */}
                <div className="flex-1 overflow-y-auto">
                  {/* Lick Library Tab */}
                  {activeTab === "lick-library" && (
                    <div className="p-2.5 space-y-2">
                      {/* Search */}
                      <div className="relative">
                        <FaSearch
                          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                          size={14}
                        />
                        <input
                          type="text"
                          placeholder="Search licks..."
                          value={lickSearchTerm}
                          onChange={(e) => setLickSearchTerm(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-3 pl-9 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      {/* Filters */}
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={selectedGenre || ""}
                          onChange={(e) =>
                            setSelectedGenre(e.target.value || null)
                          }
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none"
                        >
                          <option value="">All Genres</option>
                          {(tagGroups.genre || []).map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                        <select
                          value={selectedType || ""}
                          onChange={(e) =>
                            setSelectedType(e.target.value || null)
                          }
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none"
                        >
                          <option value="">All Types</option>
                          {(tagGroups.type || []).map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Loading State */}
                      {loadingLicks && availableLicks.length === 0 && (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-orange-500"></div>
                          <span className="ml-2 text-gray-400 text-sm">
                            Loading licks...
                          </span>
                        </div>
                      )}

                      {/* Empty State */}
                      {!loadingLicks && availableLicks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                          <FaMusic size={32} className="mb-2 opacity-50" />
                          <p className="text-sm">
                            {lickSearchTerm || selectedGenre || selectedType
                              ? "No licks found matching your search"
                              : "No licks available. Try searching or adjusting filters."}
                          </p>
                        </div>
                      )}

                      {/* Lick Grid - Horizontal scroll with lazy loading */}
                      {availableLicks.length > 0 && (
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {availableLicks.map((lick) => {
                            const lickId = lick._id || lick.lick_id || lick.id;
                            const isPlaying = playingLickId === lickId;
                            const progress = lickProgress[lickId] || 0;
                            const waveform =
                              lick.waveformData || lick.waveform_data || [];
                            const creator = lick.creator || {};
                            const creatorName =
                              creator.display_name ||
                              creator.displayName ||
                              creator.username ||
                              "Unknown";
                            const creatorAvatar =
                              creator.avatar_url || creator.avatarUrl;
                            const duration = lick.duration || 0;
                            const tempo = lick.tempo;
                            const key = lick.key;

                            // Get genre and type from tags
                            const tags = lick.tags || [];
                            const genreTag = tags.find(
                              (t) => t.tag_type === "genre"
                            );
                            const typeTag = tags.find(
                              (t) => t.tag_type === "type"
                            );
                            const genre =
                              genreTag?.tag_name ||
                              genreTag?.name ||
                              lick.genre ||
                              "—";
                            const type =
                              typeTag?.tag_name ||
                              typeTag?.name ||
                              lick.type ||
                              "—";

                            return (
                              <div
                                key={lickId}
                                draggable
                                onDragStart={() => handleDragStart(lick)}
                                onDragEnd={() => setDraggedLick(null)}
                                className="bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-all min-w-[200px] max-w-[200px] flex-shrink-0 cursor-grab active:cursor-grabbing overflow-hidden"
                              >
                                {/* Waveform Preview */}
                                <div
                                  className="relative h-20 bg-gray-900 cursor-pointer"
                                  onClick={(e) => handleLickPlayPause(lick, e)}
                                >
                                  {waveform.length > 0 ? (
                                    <div className="absolute inset-0 flex items-end justify-center gap-0.5 px-2 pb-2">
                                      {waveform
                                        .slice(0, 60)
                                        .map((amplitude, index) => {
                                          const barProgress =
                                            index / waveform.length;
                                          const isPlayed =
                                            barProgress <= progress;
                                          return (
                                            <div
                                              key={index}
                                              className="w-0.5 bg-gray-600 transition-all duration-100"
                                              style={{
                                                height: `${Math.max(
                                                  amplitude * 100,
                                                  10
                                                )}%`,
                                                backgroundColor:
                                                  isPlaying && isPlayed
                                                    ? "#f97316"
                                                    : "#6b7280",
                                                opacity:
                                                  isPlaying && isPlayed
                                                    ? 1
                                                    : 0.6,
                                              }}
                                            />
                                          );
                                        })}
                                    </div>
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <FaMusic
                                        className="text-gray-600"
                                        size={20}
                                      />
                                    </div>
                                  )}

                                  {/* Play/Pause Button */}
                                  <button
                                    onClick={(e) =>
                                      handleLickPlayPause(lick, e)
                                    }
                                    className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/90 text-white rounded-full p-1.5 transition-colors"
                                  >
                                    {isPlaying ? (
                                      <FaPause size={10} />
                                    ) : (
                                      <FaPlay size={10} className="ml-0.5" />
                                    )}
                                  </button>
                                </div>

                                {/* Lick Info */}
                                <div className="p-2.5 space-y-1.5">
                                  {/* Title */}
                                  <div className="text-white text-sm font-semibold truncate">
                                    {lick.title}
                                  </div>

                                  {/* Creator Info */}
                                  <div className="flex items-center gap-1.5">
                                    {creatorAvatar ? (
                                      <img
                                        src={creatorAvatar}
                                        alt={creatorName}
                                        className="w-4 h-4 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-4 h-4 rounded-full bg-gray-600 flex items-center justify-center">
                                        <span className="text-[8px] text-gray-300">
                                          {creatorName.charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                    )}
                                    <span className="text-gray-400 text-xs truncate">
                                      {creatorName}
                                    </span>
                                  </div>

                                  {/* Metadata */}
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    {duration > 0 && (
                                      <span>{duration.toFixed(1)}s</span>
                                    )}
                                    {tempo && (
                                      <>
                                        <span>•</span>
                                        <span>{Math.round(tempo)} BPM</span>
                                      </>
                                    )}
                                    {key && (
                                      <>
                                        <span>•</span>
                                        <span>{key}</span>
                                      </>
                                    )}
                                  </div>

                                  {/* Tags */}
                                  <div className="flex items-center gap-1 text-xs text-gray-500 truncate">
                                    <span>{genre}</span>
                                    {type && (
                                      <>
                                        <span>•</span>
                                        <span>{type}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Load More button for licks */}
                      {lickHasMore && (
                        <button
                          onClick={loadMoreLicks}
                          disabled={loadingLicks}
                          className="w-full mt-2 py-2 px-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loadingLicks
                            ? "Loading..."
                            : `Load More (${availableLicks.length} loaded)`}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Backing Track Tab */}
                  {activeTab === "backing-track" && (
                    <BackingTrackPanel
                      chordLibrary={chordPalette}
                      instruments={instruments}
                      rhythmPatterns={rhythmPatterns}
                      getRhythmPatternVisual={getRhythmPatternVisual}
                      onAddChord={handleAddChordToTimeline}
                      onGenerateBackingTrack={handleGenerateBackingTrack}
                      onGenerateAIBackingTrack={handleGenerateAIBackingTrack}
                      selectedInstrumentId={selectedInstrumentId}
                      onInstrumentChange={setSelectedInstrumentId}
                      selectedRhythmPatternId={selectedRhythmPatternId}
                      onRhythmPatternChange={setSelectedRhythmPatternId}
                      chordProgression={chordProgression}
                      onRemoveChord={handleRemoveChord}
                      loading={
                        loadingChords ||
                        loadingInstruments ||
                        loadingRhythmPatterns ||
                        isGeneratingBackingTrack
                      }
                      project={project}
                    />
                  )}

                  {/* MIDI Editor Tab */}
                  {activeTab === "midi-editor" && (
                    <div className="p-3 space-y-2">
                      <div className="mb-3">
                        <h3 className="text-white font-semibold text-sm mb-1">
                          MIDI Editor
                        </h3>
                        <p className="text-gray-400 text-xs">
                          Edit MIDI notes for timeline items
                        </p>
                      </div>

                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {tracks.flatMap((track) =>
                          (track.items || [])
                            .filter(
                              (item) =>
                                item.type === "chord" ||
                                item.type === "midi" ||
                                (item.chordName && !item.lickId)
                            )
                            .map((item) => {
                              const itemName =
                                item.chordName ||
                                item.title ||
                                `Item at ${formatTransportTime(
                                  item.startTime || 0
                                )}`;
                              const isCustomized = item.isCustomized || false;
                              const noteCount =
                                item.customMidiEvents?.length ||
                                item.midiNotes?.length ||
                                0;

                              return (
                                <div
                                  key={item._id}
                                  className="bg-gray-800 rounded p-2 border border-gray-700 hover:border-gray-600 transition-colors min-w-[150px] flex-shrink-0"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-white text-xs">
                                      {itemName}
                                    </span>
                                    {isCustomized && (
                                      <span className="text-[10px] bg-purple-600/50 px-1 rounded">
                                        Custom
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 mb-2">
                                    {noteCount} notes •{" "}
                                    {formatTransportTime(item.duration || 0)}
                                  </div>
                                  <button
                                    onClick={() => handleOpenMidiEditor(item)}
                                    className="w-full px-2 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-white text-xs font-medium"
                                  >
                                    Edit MIDI
                                  </button>
                                </div>
                              );
                            })
                        )}

                        {tracks.every(
                          (track) =>
                            !track.items ||
                            track.items.filter(
                              (item) =>
                                item.type === "chord" ||
                                item.type === "midi" ||
                                (item.chordName && !item.lickId)
                            ).length === 0
                        ) && (
                          <div className="text-center py-8 text-gray-400 text-xs min-w-[200px]">
                            <p>No editable MIDI items</p>
                            <p className="mt-1">
                              Add chords or generate backing track
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Instrument Tab */}
                  {activeTab === "instrument" && (
                    <div className="p-3">
                      <div className="mb-3">
                        <h3 className="text-white font-semibold text-sm mb-1">
                          Select Instrument
                        </h3>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-gray-400 text-xs">Target:</span>
                          <select
                            value={selectedTrackId || "backing"}
                            onChange={(e) =>
                              setSelectedTrackId(
                                e.target.value === "backing"
                                  ? null
                                  : e.target.value
                              )
                            }
                            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-orange-500"
                          >
                            <option value="backing">Backing Track</option>
                            {tracks
                              .filter(
                                (t) =>
                                  !t.isBackingTrack && t.trackType !== "backing"
                              )
                              .map((t) => (
                                <option key={t._id} value={t._id}>
                                  {t.trackName}
                                </option>
                              ))}
                          </select>
                        </div>
                        <p className="text-gray-500 text-[10px] mb-2">
                          Select a track above, then choose an instrument below.
                        </p>
                      </div>

                      {loadingInstruments ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-orange-500"></div>
                        </div>
                      ) : (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {instruments.map((instrument) => (
                            <button
                              key={instrument._id}
                              onClick={() =>
                                handleSelectInstrument(instrument._id)
                              }
                              className={`p-3 rounded border-2 transition-all flex-shrink-0 min-w-[100px] ${
                                instrumentHighlightId === instrument._id
                                  ? "bg-orange-600 border-orange-500 text-white"
                                  : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
                              }`}
                            >
                              <div className="text-center">
                                <FaMusic className="mx-auto mb-1" size={16} />
                                <div className="font-medium text-xs">
                                  {instrument.name}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Resize Handle - Horizontal */}
          {sidePanelOpen && (
            <div
              className="h-1 bg-gray-800 hover:bg-gray-700 cursor-row-resize transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                const startY = e.clientY;
                const startHeight = sidePanelWidth;

                const handleMouseMove = (moveEvent) => {
                  const diff = startY - moveEvent.clientY; // Inverted for bottom panel
                  const newHeight = Math.max(
                    200,
                    Math.min(500, startHeight + diff)
                  );
                  setSidePanelWidth(newHeight);
                };

                const handleMouseUp = () => {
                  document.removeEventListener("mousemove", handleMouseMove);
                  document.removeEventListener("mouseup", handleMouseUp);
                };

                document.addEventListener("mousemove", handleMouseMove);
                document.addEventListener("mouseup", handleMouseUp);
              }}
            />
          )}

          {/* Toggle Bottom Panel Button */}
          {!sidePanelOpen && (
            <button
              onClick={() => setSidePanelOpen(true)}
              className="absolute bottom-0 left-1/2 -translate-x-1/2 z-50 bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-t-lg border-t border-gray-700 shadow-lg"
              title="Show tools panel"
            >
              <FaPalette size={14} />
            </button>
          )}
        </div>

        {trackContextMenu.isOpen && menuTrack && (
          <div className="fixed inset-0 z-40" onClick={closeTrackMenu}>
            <div
              className="absolute z-50 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 space-y-3"
              style={{
                top: `${menuPosition.y}px`,
                left: `${menuPosition.x}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <p className="text-sm font-semibold text-white truncate">
                  {formatTrackTitle(menuTrack.trackName || "Track")}
                </p>
                {menuTrack.isBackingTrack && (
                  <p className="text-xs text-orange-400 mt-1">Backing track</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleTrackRename(menuTrack)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-200 hover:bg-gray-800 transition-colors"
              >
                <FaPen size={12} />
                Rename track
              </button>
              <div>
                <div className="text-xs uppercase text-gray-400 mb-2 flex items-center gap-2">
                  <FaPalette size={12} />
                  Color
                </div>
                <div className="flex flex-wrap gap-2">
                  {TRACK_COLOR_PALETTE.map((color) => {
                    const isActive = menuTrack.color === color;
                    return (
                      <button
                        type="button"
                        key={color}
                        onClick={() => handleTrackColorChange(menuTrack, color)}
                        className={`w-6 h-6 rounded-full border ${
                          isActive
                            ? "ring-2 ring-white border-white"
                            : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                        title="Set track color"
                      />
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                disabled={!canMoveMenuUp}
                onClick={() => handleTrackMove(menuTrack, "up")}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                  canMoveMenuUp
                    ? "text-gray-200 hover:bg-gray-800"
                    : "text-gray-600 cursor-not-allowed"
                }`}
              >
                <FaArrowUp size={12} />
                Move up
              </button>
              <button
                type="button"
                disabled={!canMoveMenuDown}
                onClick={() => handleTrackMove(menuTrack, "down")}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                  canMoveMenuDown
                    ? "text-gray-200 hover:bg-gray-800"
                    : "text-gray-600 cursor-not-allowed"
                }`}
              >
                <FaArrowDown size={12} />
                Move down
              </button>
              <button
                type="button"
                onClick={() => handleTrackDelete(menuTrack)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-red-400 hover:text-red-200 hover:bg-red-900/20 transition-colors"
              >
                <FaTrash size={12} />
                Delete track
              </button>
            </div>
          </div>
        )}

        {/* MIDI Editor Modal */}
        {midiEditorOpen && editingTimelineItem && (
          <MidiEditor
            isOpen={midiEditorOpen}
            onClose={handleCloseMidiEditor}
            timelineItem={editingTimelineItem}
            onSave={handleSaveMidiEdit}
            project={project}
          />
        )}

        {/* AI Generation Loading Modal */}
        <AIGenerationLoadingModal
          isOpen={isGeneratingAI}
          message="✨ Creating your professional AI backing track..."
        />

        {/* AI Notification Toast */}
        {aiNotification && (
          <div
            className={`fixed top-20 right-4 z-50 px-6 py-4 rounded-lg shadow-2xl border-2 ${
              aiNotification.type === "success"
                ? "bg-green-900 border-green-500 text-white"
                : "bg-red-900 border-red-500 text-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {aiNotification.type === "success" ? "✅" : "❌"}
              </span>
              <p className="font-medium">{aiNotification.message}</p>
              <button
                onClick={() => setAiNotification(null)}
                className="ml-4 hover:opacity-70 transition"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="fixed bottom-4 right-4 bg-red-900/20 border border-red-800 rounded-lg p-4 max-w-md">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetailPage;
