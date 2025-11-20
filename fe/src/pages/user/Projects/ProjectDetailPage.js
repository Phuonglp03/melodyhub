import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaPlay,
  FaPause,
  FaStop,
  FaCircle,
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
  FaStepBackward,
  FaSync,
} from "react-icons/fa";
import { RiPulseFill } from "react-icons/ri";
import {
  getProjectById,
  updateProject,
  addLickToTimeline,
  updateTimelineItem,
  bulkUpdateTimelineItems,
  deleteTimelineItem,
  updateChordProgression as updateChordProgressionAPI,
  addTrack,
  updateTrack,
  deleteTrack,
  deleteProject as deleteProjectApi,
  getInstruments,
} from "../../../services/user/projectService";
import {
  getCommunityLicks,
  playLickAudio,
} from "../../../services/user/lickService";
import { getChords } from "../../../services/chordService";
import { useSelector } from "react-redux";
import { fetchTagsGrouped } from "../../../services/user/tagService";
import * as Tone from "tone";

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

const formatTransportTime = (seconds = 0) => {
  const totalSeconds = Math.max(0, seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  const tenths = Math.floor((totalSeconds % 1) * 10);
  return `${minutes.toString().padStart(2, "0")}:${secs}.${tenths}`;
};

const parseMidiNotes = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeChordLibraryItem = (chord) => ({
  ...chord,
  chordName: chord.chordName || chord.name || chord.label || "Chord",
  midiNotes: parseMidiNotes(chord.midiNotes),
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
    type: item.type || (item.lickId ? "lick" : "midi"),
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
  const [zoomLevel, setZoomLevel] = useState(1); // Zoom multiplier
  const [selectedItem, setSelectedItem] = useState(null);
  const [focusedClipId, setFocusedClipId] = useState(null);
  const [isDraggingItem, setIsDraggingItem] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, trackId: null });
  const [resizeState, setResizeState] = useState(null);

  // UI State
  const [activeTab, setActiveTab] = useState("lick-library"); // "lick-library", "midi-editor", "instrument"
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

  // Instruments
  const [instruments, setInstruments] = useState([]);
  const [loadingInstruments, setLoadingInstruments] = useState(false);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState(null);

  // Drag and drop
  const [draggedLick, setDraggedLick] = useState(null);
  const [draggedChord, setDraggedChord] = useState(null);
  const [dragOverTrack, setDragOverTrack] = useState(null);
  const [dragOverPosition, setDragOverPosition] = useState(null);
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
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [recordArmed, setRecordArmed] = useState(false);
  const [historyStatus, setHistoryStatus] = useState({
    canUndo: false,
    canRedo: false,
  });
  const historyRef = useRef([]);
  const futureRef = useRef([]);
  const playbackPositionRef = useRef(0);
  const dirtyTimelineItemsRef = useRef(new Set());
  const saveTimeoutRef = useRef(null);
  const playersRef = useRef(null); // Tone.Players for managing audio clips
  const audioBuffersRef = useRef(new Map()); // Cache loaded audio URLs
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
  }, [trackContextMenu.x, trackContextMenu.y, trackContextMenu.isOpen]);
  const markTimelineItemDirty = useCallback((itemId) => {
    if (!itemId) return;
    dirtyTimelineItemsRef.current.add(itemId);
  }, []);

  const hasUnsavedTimelineChanges = dirtyTimelineItemsRef.current.size > 0;

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
    futureRef.current = [];
    updateHistoryStatus();
  }, [tracks, chordProgression, updateHistoryStatus]);

  const flushTimelineSaves = useCallback(async () => {
    if (!projectId) return;
    const ids = Array.from(dirtyTimelineItemsRef.current);
    if (!ids.length) return;

    const payload = ids
      .map((id) => collectTimelineItemSnapshot(id))
      .filter(Boolean);
    if (!payload.length) {
      dirtyTimelineItemsRef.current.clear();
      return;
    }

    setIsSavingTimeline(true);
    dirtyTimelineItemsRef.current.clear();
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    try {
      await bulkUpdateTimelineItems(projectId, payload);
    } catch (err) {
      console.error("Error bulk saving timeline:", err);
      if (err.response && err.response.data) {
        console.error("Backend error details:", err.response.data);
      }
      // Don't re-throw; we don't want to break the UI.
    } finally {
      setIsSavingTimeline(false);
    }
  }, [projectId, collectTimelineItemSnapshot]);

  const scheduleTimelineAutosave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      flushTimelineSaves();
    }, 15000);
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

  useEffect(() => {
    fetchProject(true); // Show loading only on initial load
    fetchInstruments();
  }, [projectId]);

  useEffect(() => {
    const fetchChordLibrary = async () => {
      try {
        setLoadingChords(true);
        const chords = await getChords();
        setChordLibrary(
          (chords || []).map((chord) => normalizeChordLibraryItem(chord))
        );
        setChordLibraryError(null);
      } catch (err) {
        console.error("Error fetching chords:", err);
        setChordLibraryError(err.message || "Failed to load chords");
      } finally {
        setLoadingChords(false);
      }
    };

    fetchChordLibrary();
  }, []);

  useEffect(() => {
    const handlePointerUp = () => {
      if (isDraggingItem) {
        setIsDraggingItem(false);
        setSelectedItem(null);
      }
    };

    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("blur", handlePointerUp);

    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("blur", handlePointerUp);
    };
  }, [isDraggingItem]);

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
        };
      }),
    [chordProgression, chordDurationSeconds]
  );

  const chordPalette = useMemo(
    () =>
      chordLibrary.length
        ? chordLibrary
        : DEFAULT_FALLBACK_CHORDS.map((chord) =>
            normalizeChordLibraryItem(chord)
          ),
    [chordLibrary]
  );

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

  // Fetch licks on initial mount and when search term or filters change
  useEffect(() => {
    const timeout = setTimeout(
      () => {
        fetchLicks();
      },
      lickSearchTerm ? 300 : 0
    );
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lickSearchTerm, selectedGenre, selectedType, selectedEmotional, selectedTimbre, selectedArticulation, selectedCharacter]);

  // Fetch project with loading state (only for initial load)
  const fetchProject = async (showLoading = false) => {
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
        const backing = normalized.find(
          (t) => t.isBackingTrack || t.trackName === "Backing Track"
        );
        setBackingTrack(backing || null);
        historyRef.current = [];
        futureRef.current = [];
        updateHistoryStatus();
      } else {
        setError(response.message || "Failed to load project");
      }
    } catch (err) {
      console.error("Error fetching project:", err);
      setError(err.message || "Failed to load project");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Silent refresh - updates data without showing loading
  const refreshProject = useCallback(async () => {
    try {
      const response = await getProjectById(projectId);
      if (response.success) {
        setProject(response.data.project);
        setChordProgression(
          hydrateChordProgression(response.data.project.chordProgression)
        );
        const normalized = normalizeTracks(response.data.tracks || []);
        setTracks(normalized);
        // Set selected instrument
        if (response.data.project.backingInstrumentId) {
          const instrumentId =
            response.data.project.backingInstrumentId._id ||
            response.data.project.backingInstrumentId;
          setSelectedInstrumentId(instrumentId);
        } else {
          setSelectedInstrumentId(null);
        }

        const backing = normalized.find(
          (t) => t.isBackingTrack || t.trackName === "Backing Track"
        );
        setBackingTrack(backing || null);
      }
    } catch (err) {
      console.error("Error refreshing project:", err);
      // Don't show error for silent refreshes, just log it
    }
  }, [projectId]);

  const fetchLicks = async () => {
    try {
      setLoadingLicks(true);

      // Build tags filter - backend expects comma-separated tag names only
      const tagsArray = [];
      
      // Collect all selected tag names from all 6 categories
      if (selectedGenre) tagsArray.push(selectedGenre);
      if (selectedType) tagsArray.push(selectedType);
      if (selectedEmotional) tagsArray.push(selectedEmotional);
      if (selectedTimbre) tagsArray.push(selectedTimbre);
      if (selectedArticulation) tagsArray.push(selectedArticulation);
      if (selectedCharacter) tagsArray.push(selectedCharacter);
      
      const tagsFilter = tagsArray.join(",");

      const response = await getCommunityLicks({
        search: lickSearchTerm || "",
        tags: tagsFilter,
        limit: 50,
      });
      if (response.success) {
        // Handle different response structures
        const licks =
          response.data?.licks || response.data || response.licks || [];
        setAvailableLicks(licks);
      } else {
        setAvailableLicks([]);
      }
    } catch (err) {
      console.error("Error fetching licks:", err);
      setAvailableLicks([]);
    } finally {
      setLoadingLicks(false);
    }
  };

  // Playback control with playhead movement synced to Tone.Transport
  useEffect(() => {
    let animationFrame = null;
    let lastStateUpdate = 0;

    if (isPlaying) {
      const width = calculateTimelineWidth();
      const loopLenSeconds = Math.max(1, width / pixelsPerSecond);

      const animate = () => {
        // Sync position with Tone.Transport
        const position = loopEnabled 
          ? Tone.Transport.seconds % loopLenSeconds 
          : Tone.Transport.seconds;
        
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

  // Initialize Tone.js
  useEffect(() => {
    // Initialize Tone.Players for managing multiple audio clips
    if (!playersRef.current) {
      playersRef.current = new Tone.Players().toDestination();
    }

    // Set initial BPM
    Tone.Transport.bpm.value = bpm;

    return () => {
      // Cleanup: stop transport and dispose players
      if (Tone.Transport.state === "started") {
        Tone.Transport.stop();
      }
      if (playersRef.current) {
        playersRef.current.dispose();
        playersRef.current = null;
      }
    };
  }, []);

  // Sync BPM changes with Tone.Transport
  useEffect(() => {
    Tone.Transport.bpm.value = bpm;
  }, [bpm]);

  // Load audio into Tone.js Players
  const loadAudioToPlayer = async (clipId, audioUrl) => {
    if (!playersRef.current) return false;

    // Check if already loaded
    if (audioBuffersRef.current.has(clipId)) {
      return true;
    }

    try {
      // Add the audio buffer to the Tone.Players
      await new Promise((resolve, reject) => {
        playersRef.current.add(clipId, audioUrl, () => {
          audioBuffersRef.current.set(clipId, audioUrl);
          resolve();
        }, reject);
      });
      return true;
    } catch (error) {
      console.error("Error loading audio to Tone.js:", error);
      return false;
    }
  };

  // Schedule audio playback for timeline items using Tone.js
  const scheduleAudioPlayback = async (startTime = 0) => {
    if (!playersRef.current || !isPlaying) return;

    // Stop all currently playing clips
    playersRef.current.stopAll();

    // Load and schedule all clips that should be playing
    for (const track of tracks) {
      if (track.muted) continue; // Skip muted tracks

      for (const item of track.items || []) {
        if (item.type !== "lick" || !item.lickId) continue;

        const clipStart = item.startTime || 0;
        const clipEnd = clipStart + (item.duration || 0);
        const clipId = item._id;

        // Check if clip overlaps with current playback time
        if (clipEnd > startTime) {
          try {
            // Get audio URL for the lick
            const audioResponse = await playLickAudio(
              item.lickId._id || item.lickId,
              user?._id
            );
            if (!audioResponse.success || !audioResponse.data?.audioUrl)
              continue;

            const audioUrl = audioResponse.data.audioUrl;
            
            // Load audio into Tone.Players
            const loaded = await loadAudioToPlayer(clipId, audioUrl);
            if (!loaded) continue;

            // Get the player for this clip
            const player = playersRef.current.player(clipId);
            if (!player) continue;

            // Set playback rate
            player.playbackRate = item.playbackRate || 1;

            // Set volume (Tone.js uses decibels)
            const volumeDb = Tone.gainToDb((track.volume || 1) * (track.solo ? 1 : 0.7));
            player.volume.value = volumeDb;

            // Calculate when to start relative to current transport position
            const offset = item.offset || 0;
            const duration = item.duration || 0;

            // Calculate the time offset from current playback position
            let playOffset = offset;
            let timeFromNow = clipStart - startTime;
            
            if (clipStart < startTime) {
              // Clip has already started, we need to start mid-clip immediately
              playOffset = offset + (startTime - clipStart);
              timeFromNow = 0;
            }

            // Schedule playback using immediate start or scheduled time
            // Time is relative to "now", so we use `+${timeFromNow}` notation
            const startTimeNotation = timeFromNow === 0 ? "now" : `+${timeFromNow}`;
            player.start(startTimeNotation, playOffset, duration);
          } catch (error) {
            console.error("Error scheduling audio playback:", error);
          }
        }
      }
    }
  };

  const handlePlay = async () => {
    // Start Tone.js audio context if needed
    await Tone.start();

    // Set the transport position to current playback position
    Tone.Transport.seconds = playbackPositionRef.current;

    // Update BPM in case it changed
    Tone.Transport.bpm.value = bpm;

    setIsPlaying(true);
    
    // Schedule audio playback
    await scheduleAudioPlayback(playbackPositionRef.current);
    
    // Start the Tone.js Transport
    Tone.Transport.start();
  };

  const handlePause = () => {
    setIsPlaying(false);
    
    // Pause the Tone.js Transport
    Tone.Transport.pause();
    
    // Stop all audio players
    if (playersRef.current) {
      playersRef.current.stopAll();
    }
  };

  const handleStop = () => {
    setIsPlaying(false);
    setPlaybackPosition(0);
    playbackPositionRef.current = 0;
    
    // Stop the Tone.js Transport and reset position
    Tone.Transport.stop();
    Tone.Transport.seconds = 0;
    
    // Stop all audio players
    if (playersRef.current) {
      playersRef.current.stopAll();
    }
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

  // Handle instrument selection for backing track
  const handleSelectInstrument = async (instrumentId) => {
    try {
      // Optimistic update
      setSelectedInstrumentId(instrumentId);
      setProject((prev) => ({
        ...prev,
        backingInstrumentId: instrumentId,
      }));

      await updateProject(projectId, { backingInstrumentId: instrumentId });
      // Silent refresh in background
      refreshProject();
    } catch (err) {
      console.error("Error updating instrument:", err);
      // Revert on error
      refreshProject();
    }
  };

  // Ensure backing track exists
  const ensureBackingTrack = async () => {
    if (backingTrack) return backingTrack._id;

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

  const handleTimeSignatureChange = async (value) => {
    if (!project || !value || project.timeSignature === value) return;
    setProject((prev) => (prev ? { ...prev, timeSignature: value } : prev));
    try {
      await updateProject(projectId, { timeSignature: value });
    } catch (err) {
      console.error("Error updating time signature:", err);
      refreshProject();
    }
  };

  const handleKeyChange = async (value) => {
    if (!project || !value || project.key === value) return;
    setProject((prev) => (prev ? { ...prev, key: value } : prev));
    try {
      await updateProject(projectId, { key: value });
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
        // Optimistic update - add item to local state immediately
        const newItem = normalizeTimelineItem(response.data);
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
        refreshProject();
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

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      {/* Top Bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 space-y-2">
        <div className="flex flex-wrap items-center gap-3 justify-between">
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
                className={toolbarButtonClasses(false, !historyStatus.canUndo)}
                onClick={handleUndo}
                disabled={!historyStatus.canUndo}
                title="Undo"
              >
                <FaUndo size={12} />
              </button>
              <button
                type="button"
                className={toolbarButtonClasses(false, !historyStatus.canRedo)}
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
                value={project.timeSignature || "4/4"}
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
                value={project.key || "C Major"}
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
          </div>

          <div className="flex items-center gap-1 bg-gray-800/70 rounded-full px-3 py-1">
            <button
              type="button"
              onClick={handleReturnToStart}
              className={toolbarButtonClasses(false, false)}
              title="Return to start"
            >
              <FaStepBackward size={12} />
            </button>
            <button
              type="button"
              onClick={handlePlayToggle}
              className={toolbarButtonClasses(isPlaying, false)}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <FaPause size={12} /> : <FaPlay size={12} />}
            </button>
            <button
              type="button"
              onClick={handleStop}
              className={toolbarButtonClasses(false, false)}
              title="Stop"
            >
              <FaStop size={12} />
            </button>
            <button
              type="button"
              onClick={handleRecordToggle}
              className={toolbarButtonClasses(recordArmed, false)}
              title="Record arm"
            >
              <FaCircle
                size={12}
                className={recordArmed ? "text-red-500" : "text-gray-200"}
              />
            </button>
            <button
              type="button"
              onClick={() => setLoopEnabled((prev) => !prev)}
              className={toolbarButtonClasses(loopEnabled, false)}
              title="Loop playback"
            >
              <FaSync size={12} />
            </button>
            <div className="text-xs font-mono text-blue-200 px-2">
              {formattedPlayTime}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between text-xs text-gray-400">
          <span>
            {project.title} • {formatDate(project.createdAt)}
          </span>
          <span>
            Zoom {Math.round(zoomLevel * 100)}% ·{" "}
            {project.timeSignature || "4/4"} · {project.key || "Key"}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
          <div className="flex border-b border-gray-800">
            <div className="w-64 bg-gray-950 border-r border-gray-800 p-4">
              <button
                onClick={handleAddTrack}
                className="w-full bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center justify-center gap-2"
              >
                <FaPlus size={12} />
                Add a track
              </button>
            </div>
            <div className="flex-1 bg-gray-900 px-4 text-xs uppercase tracking-wide text-gray-500 flex items-center">
              Drag licks or chords onto any track to build your arrangement
            </div>
          </div>
          {/* Timeline Grid */}
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
              <div className="w-64 bg-gray-950 border-r border-gray-800 h-10 flex items-center px-4 text-xs font-semibold uppercase tracking-wide text-gray-400 sticky left-0 z-20">
                Track
              </div>
              <div className="flex-1 relative bg-gray-800 border-b border-gray-700 h-10 flex items-end">
                {/* Measure markers (every 4 beats) */}
                {Array.from({
                  length:
                    Math.ceil(timelineWidth / pixelsPerBeat / beatsPerMeasure) +
                    1,
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
                        isMeasureStart ? "border-blue-500" : "border-gray-600"
                      }`}
                      style={{ left: `${beatPosition}px` }}
                    />
                  );
                })}

                {/* Second markers */}
                {Array.from({
                  length:
                    Math.ceil(calculateTimelineWidth() / pixelsPerSecond) + 1,
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
              return (
                <div
                  key={track._id}
                  className="flex border-b border-gray-800"
                  style={{ minHeight: "90px" }}
                >
                  <div
                    className={`w-64 border-r border-gray-800 p-2.5 flex flex-col gap-2 sticky left-0 z-10 ${
                      isMenuOpen
                        ? "bg-gray-800"
                        : isHoveringTrack
                        ? "bg-gray-900"
                        : "bg-gray-950"
                    }`}
                    style={{
                      minHeight: "inherit",
                      borderLeft: `4px solid ${trackAccent}`,
                    }}
                    onContextMenu={(e) => openTrackMenu(e, track)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: trackAccent }}
                        />
                        <span className="text-white font-medium text-sm truncate">
                          {track.trackName}
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
                            handleUpdateTrack(track._id, { solo: !track.solo })
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
                      const trackRect = e.currentTarget.getBoundingClientRect();
                      const scrollLeft = timelineRef.current.scrollLeft || 0;
                      const x = e.clientX - trackRect.left + scrollLeft;
                      const startTime = Math.max(0, x / pixelsPerSecond);
                      handleDragOver(e, track._id, startTime);
                    }}
                    onDrop={(e) => {
                      if (!timelineRef.current) return;
                      const trackRect = e.currentTarget.getBoundingClientRect();
                      const scrollLeft = timelineRef.current.scrollLeft || 0;
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
                        .sort((a, b) => (a.startTime || 0) - (b.startTime || 0))
                        .map((item) => {
                          const isSelected =
                            focusedClipId === item._id ||
                            selectedItem === item._id;
                          const clipWidth = item.duration * pixelsPerSecond;
                          const clipLeft = item.startTime * pixelsPerSecond;
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
                          const sourceDurationSeconds =
                            item.sourceDuration || item.lickId?.duration || 300;
                          const clipLabel = isChord
                            ? item.chordName ||
                              item.chord ||
                              `Chord ${trackIndex + 1}`
                            : item.lickId?.title ||
                              (item.type === "midi"
                                ? item.isCustomized
                                  ? "Custom MIDI"
                                  : "MIDI Clip"
                                : `Lick ${trackIndex + 1}`);
                          const clipStyle = {
                            left: `${clipLeft}px`,
                            width: `${clipWidth}px`,
                            top: "5px",
                            height: "70px",
                            minWidth: "60px",
                            backgroundColor: !isChord ? trackAccent : undefined,
                            borderColor: isChord
                              ? isSelected
                                ? "#facc15"
                                : trackAccent
                              : isSelected
                              ? "#facc15"
                              : trackAccent,
                            boxShadow: isSelected
                              ? "0 0 0 2px rgba(250, 204, 21, 0.55)"
                              : undefined,
                          };
                          const showWaveform =
                            item.type === "lick" && item.lickId?.waveformData;
                          const showResizeHandles = !isVirtualChord;

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
                              className={`absolute rounded border-2 text-white cursor-move overflow-hidden ${
                                // Disable smooth transitions while dragging so the clip sticks to the cursor
                                isDraggingItem && selectedItem === item._id
                                  ? ""
                                  : "transition-all"
                              } ${
                                isChord
                                  ? isSelected
                                    ? "bg-green-500 border-yellow-400 shadow-lg shadow-yellow-400/50"
                                    : "bg-green-600 border-green-700 hover:bg-green-700"
                                  : ""
                              }`}
                              style={clipStyle}
                              title={clipLabel}
                              onMouseDown={(e) =>
                                handleClipMouseDown(e, item, track._id)
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                setFocusedClipId(item._id);
                              }}
                            >
                              <div className="absolute inset-0 overflow-hidden">
                                {showWaveform ? (
                                  (() => {
                                    try {
                                      const waveform =
                                        typeof item.lickId.waveformData ===
                                        "string"
                                          ? JSON.parse(item.lickId.waveformData)
                                          : item.lickId.waveformData;
                                      const waveformArray = Array.isArray(
                                        waveform
                                      )
                                        ? waveform
                                        : [];

                                      if (!waveformArray.length) return null;

                                      // Get the actual current width from the DOM element
                                      // This ensures waveform stays correct even during resize drag
                                      const clipElement = clipRefs.current.get(item._id);
                                      const actualClipWidth = clipElement?.offsetWidth || clipWidth;

                                      // ADAPTIVE DENSITY IMPLEMENTATION
                                      // 1. Determine the full source duration to map samples to time
                                      const fullSourceDuration =
                                        item.sourceDuration ||
                                        item.lickId?.duration ||
                                        item.duration ||
                                        1;

                                      // 2. Calculate sample rate of the data
                                      const totalSamples = waveformArray.length;
                                      const samplesPerSecond =
                                        totalSamples / fullSourceDuration;

                                      // 3. Determine the visible slice of audio
                                      const startSample = Math.floor(
                                        (item.offset || 0) * samplesPerSecond
                                      );
                                      const endSample = Math.floor(
                                        ((item.offset || 0) +
                                          (item.duration || 0)) *
                                          samplesPerSecond
                                      );

                                      // 4. Get the visible samples (clamped to array bounds)
                                      const visibleSamples = waveformArray.slice(
                                        Math.max(0, startSample),
                                        Math.min(totalSamples, endSample)
                                      );

                                      if (!visibleSamples.length) return null;

                                      // 5. Calculate step to achieve target density in the visible area
                                      // We want roughly 1 bar every 5 pixels (3px width + 2px gap)
                                      const targetBarCount = Math.max(
                                        10,
                                        Math.floor(actualClipWidth / 5)
                                      );

                                      const step = Math.max(
                                        1,
                                        Math.ceil(
                                          visibleSamples.length / targetBarCount
                                        )
                                      );

                                      // DEBUG LOGGING - REMOVED
                                      /*
                                      console.log("Waveform Adaptive Debug:", {
                                        id: item._id,
                                        offset: item.offset,
                                        duration: item.duration,
                                        clipWidth: actualClipWidth,
                                        fullSourceDuration,
                                        totalSamples,
                                        visibleSamplesCount:
                                          visibleSamples.length,
                                        targetBarCount,
                                        step,
                                      });
                                      */

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
                                                      Math.abs(value || 0) * 100
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
                                  <div className="absolute inset-0 flex flex-col justify-end p-2 bg-black/10">
                                    <div className="text-xs opacity-75">
                                      {item.startTime.toFixed(2)}s
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Clip title + track name label */}
                              <div className="absolute top-1 left-1 max-w-[85%] rounded bg-black/60 px-2 py-0.5 text-[10px] leading-tight font-medium truncate pointer-events-none">
                                {track.trackName || "Track"} · {clipLabel}
                              </div>

                              {/* Resize handles */}
                              {showResizeHandles && (
                                <div
                                  data-resize-handle="left"
                                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-400"
                                  onMouseDown={(e) =>
                                    startClipResize(e, item, track._id, "left")
                                  }
                                />
                              )}
                              {showResizeHandles && (
                                <div
                                  data-resize-handle="right"
                                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-400"
                                  onMouseDown={(e) =>
                                    startClipResize(e, item, track._id, "right")
                                  }
                                />
                              )}

                              {/* Delete button */}
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
                                className="absolute top-1 right-1 w-5 h-5 bg-red-600 hover:bg-red-700 rounded text-white text-xs flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                              >
                                <FaTimes size={8} />
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
        </div>

        {/* Right Panel - Libraries */}
        <div className="w-80 bg-gray-950 border-l border-gray-800 flex flex-col">
          {/* Backing Tracks */}
          <div className="p-3 border-b border-gray-800">
            <h3 className="text-white font-medium text-sm mb-2">Backing Tracks</h3>
            <div className="relative">
              <FaSearch
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={14}
              />
              <input
                type="text"
                placeholder="Search..."
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 pl-9 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Chord Library */}
          <div className="p-3 border-b border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-medium text-sm">Chord Library</h3>
              {loadingChords && (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-orange-500" />
              )}
            </div>
            {chordLibraryError && (
              <p className="text-xs text-red-400 mb-2">
                {chordLibraryError}. Showing defaults.
              </p>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {chordPalette.map((chord) => {
                const key = chord._id || chord.chordId || chord.chordName;
                return (
                  <button
                    key={key}
                    draggable
                    onDragStart={() => handleChordDragStart(chord)}
                    onDragEnd={() => setDraggedChord(null)}
                    onClick={() => handleAddChord(chord)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-2 rounded text-xs font-medium transition-colors cursor-grab active:cursor-grabbing text-left"
                    title="Drag onto the backing track or click to append"
                  >
                    <span className="block font-semibold">
                      {chord.chordName || "Chord"}
                    </span>
                    {chord.midiNotes?.length ? (
                      <span className="text-[10px] text-blue-100/70 mt-0.5 block truncate">
                        {chord.midiNotes.slice(0, 4).join(", ")}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar - Lick Library */}
      <div className="bg-gray-900 border-t border-gray-800">
        {/* Tabs */}
        <div className="flex items-center border-b border-gray-800">
          <button
            onClick={() => setActiveTab("instrument")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "instrument"
                ? "bg-gray-800 text-white border-b-2 border-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Instrument
          </button>
          <button
            onClick={() => setActiveTab("midi-editor")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "midi-editor"
                ? "bg-gray-800 text-white border-b-2 border-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            MIDI Editor
          </button>
          <button
            onClick={() => setActiveTab("lick-library")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "lick-library"
                ? "bg-gray-800 text-red-500 border-b-2 border-red-500"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Lick Library
          </button>
        </div>

        {/* Instrument Tab Content */}
        {activeTab === "instrument" && (
          <div className="p-4">
            <div className="mb-4">
              <h3 className="text-white font-semibold mb-2">
                Select Backing Instrument
              </h3>
              <p className="text-gray-400 text-sm">
                Choose an instrument to generate backing track from chord
                progression
              </p>
            </div>

            {loadingInstruments ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {instruments.map((instrument) => (
                  <button
                    key={instrument._id}
                    onClick={() => handleSelectInstrument(instrument._id)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedInstrumentId === instrument._id
                        ? "bg-orange-600 border-orange-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
                    }`}
                  >
                    <div className="text-center">
                      <FaMusic className="mx-auto mb-2" size={24} />
                      <div className="font-medium text-sm">
                        {instrument.name}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedInstrumentId && (
              <div className="mt-6 p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 text-white">
                  <FaMusic className="text-orange-500" />
                  <span className="font-medium">
                    Selected:{" "}
                    {instruments.find((i) => i._id === selectedInstrumentId)
                      ?.name || "Unknown"}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mt-2">
                  Backing track chord blocks will play using this instrument's
                  sound.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Lick Library Content */}
        {activeTab === "lick-library" && (
          <div className="p-3 flex flex-col gap-3 h-full">
            {/* Search and Filters Row */}
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <FaSearch
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={14}
                />
                <input
                  type="text"
                  placeholder="Search Licks..."
                  value={lickSearchTerm}
                  onChange={(e) => setLickSearchTerm(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 pl-9 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Filters - All 6 Tag Categories */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const value = prompt(
                      "Filter by genre (leave empty to clear):",
                      selectedGenre || ""
                    );
                    if (value === null) return;
                    setSelectedGenre(value.trim() || null);
                  }}
                  className={`px-3 py-2 rounded text-sm transition-colors ${
                    selectedGenre
                      ? "bg-orange-600 hover:bg-orange-700 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}
                >
                  🎶 Genre {selectedGenre && `(${selectedGenre})`}
                </button>
                <button
                  onClick={() => {
                    const value = prompt(
                      "Filter by type/instrument (leave empty to clear):",
                      selectedType || ""
                    );
                    if (value === null) return;
                    setSelectedType(value.trim() || null);
                  }}
                  className={`px-3 py-2 rounded text-sm transition-colors ${
                    selectedType
                      ? "bg-orange-600 hover:bg-orange-700 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}
                >
                  🎸 Type {selectedType && `(${selectedType})`}
                </button>
                <button
                  onClick={() => {
                    const value = prompt(
                      "Filter by emotional/mood (leave empty to clear):",
                      selectedEmotional || ""
                    );
                    if (value === null) return;
                    setSelectedEmotional(value.trim() || null);
                  }}
                  className={`px-3 py-2 rounded text-sm transition-colors ${
                    selectedEmotional
                      ? "bg-orange-600 hover:bg-orange-700 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}
                >
                  💖 Emotional {selectedEmotional && `(${selectedEmotional})`}
                </button>
                <button
                  onClick={() => {
                    const value = prompt(
                      "Filter by timbre (leave empty to clear):",
                      selectedTimbre || ""
                    );
                    if (value === null) return;
                    setSelectedTimbre(value.trim() || null);
                  }}
                  className={`px-3 py-2 rounded text-sm transition-colors ${
                    selectedTimbre
                      ? "bg-orange-600 hover:bg-orange-700 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}
                >
                  🌈 Timbre {selectedTimbre && `(${selectedTimbre})`}
                </button>
                <button
                  onClick={() => {
                    const value = prompt(
                      "Filter by articulation (leave empty to clear):",
                      selectedArticulation || ""
                    );
                    if (value === null) return;
                    setSelectedArticulation(value.trim() || null);
                  }}
                  className={`px-3 py-2 rounded text-sm transition-colors ${
                    selectedArticulation
                      ? "bg-orange-600 hover:bg-orange-700 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}
                >
                  ⚙️ Articulation {selectedArticulation && `(${selectedArticulation})`}
                </button>
                <button
                  onClick={() => {
                    const value = prompt(
                      "Filter by character (leave empty to clear):",
                      selectedCharacter || ""
                    );
                    if (value === null) return;
                    setSelectedCharacter(value.trim() || null);
                  }}
                  className={`px-3 py-2 rounded text-sm transition-colors ${
                    selectedCharacter
                      ? "bg-orange-600 hover:bg-orange-700 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}
                >
                  💫 Character {selectedCharacter && `(${selectedCharacter})`}
                </button>
              </div>
            </div>

            {/* Lick Cards - Scrollable Grid */}
            <div className="flex-1 overflow-y-auto">
              {loadingLicks ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
                </div>
              ) : availableLicks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <FaMusic size={32} className="mb-2 opacity-50" />
                  <p className="text-sm">No licks found</p>
                  {lickSearchTerm && (
                    <p className="text-xs mt-1">Try a different search term</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2.5">
                  {availableLicks.map((lick) => (
                    <div
                      key={lick._id || lick.lick_id}
                      draggable
                      onDragStart={() => handleDragStart(lick)}
                      className="bg-gray-800 border border-gray-700 rounded-lg p-2.5 cursor-grab active:cursor-grabbing hover:border-orange-500 transition-colors"
                    >
                      <div className="font-medium text-white text-xs mb-0.5 truncate">
                        {lick.title || lick.name}
                      </div>
                      <div className="text-[11px] text-gray-400 mb-1 truncate">
                        by{" "}
                        {lick.userId?.displayName ||
                          lick.userId?.username ||
                          lick.creator?.displayName ||
                          lick.creator?.username ||
                          "Unknown"}
                      </div>
                      {(lick.tags || lick.tag_names) && (
                        <div className="flex flex-wrap gap-1">
                          {(lick.tags || lick.tag_names || [])
                            .slice(0, 3)
                            .map((tag, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded"
                              >
                                {typeof tag === "string"
                                  ? tag
                                  : tag.tag_name || tag.name}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
                {menuTrack.trackName}
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

      {/* Error Message */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-900/20 border border-red-800 rounded-lg p-4 max-w-md">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default ProjectDetailPage;
