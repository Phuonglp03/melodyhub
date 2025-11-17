import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaPlay,
  FaPause,
  FaStop,
  FaCircle,
  FaLock,
  FaUser,
  FaMusic,
  FaTrash,
  FaPlus,
  FaSearch,
  FaTimes,
} from "react-icons/fa";
import {
  getProjectById,
  updateProject,
  addLickToTimeline,
  updateTimelineItem,
  deleteTimelineItem,
  updateChordProgression as updateChordProgressionAPI,
  addTrack,
  updateTrack,
  getInstruments,
} from "../../../services/user/projectService";
import { getCommunityLicks } from "../../../services/user/lickService";
import { getChords } from "../../../services/chordService";
import { useSelector } from "react-redux";

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

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  const [project, setProject] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1); // Zoom multiplier
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapValue, setSnapValue] = useState(1); // Snap to 1 beat by default
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDraggingItem, setIsDraggingItem] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // UI State
  const [activeTab, setActiveTab] = useState("lick-library"); // "lick-library", "midi-editor", "instrument"
  const [selectedLick, setSelectedLick] = useState(null);
  const [showLickLibrary, setShowLickLibrary] = useState(true);
  const [lickSearchTerm, setLickSearchTerm] = useState("");
  const [availableLicks, setAvailableLicks] = useState([]);
  const [loadingLicks, setLoadingLicks] = useState(false);

  // Tag filters for lick search
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [selectedInstrumentTag, setSelectedInstrumentTag] = useState(null);
  const [selectedMood, setSelectedMood] = useState(null);

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

  const timelineRef = useRef(null);
  const playheadRef = useRef(null);
  const basePixelsPerSecond = 50; // Base scale for timeline
  const beatsPerMeasure = 4; // For 4/4 time
  const TRACK_COLUMN_WIDTH = 256; // Tailwind w-64 keeps labels aligned with lanes

  // Calculate BPM-dependent values
  const bpm = project?.tempo || 120;
  const secondsPerBeat = 60 / bpm;
  const pixelsPerSecond = basePixelsPerSecond * zoomLevel; // Zoom-adjusted scale
  const pixelsPerBeat = pixelsPerSecond * secondsPerBeat;

  const normalizeTracks = (incomingTracks = []) =>
    incomingTracks.map((track) => ({
      ...track,
      isBackingTrack:
        track.isBackingTrack ||
        track.trackType === "backing" ||
        track.trackName?.toLowerCase() === "backing track",
    }));

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

  const getChordIndexFromId = (itemId) => {
    if (typeof itemId !== "string") return null;
    if (!itemId.startsWith("chord-")) return null;
    const parts = itemId.split("-");
    const index = parseInt(parts[1], 10);
    return Number.isNaN(index) ? null : index;
  };

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
  }, [lickSearchTerm, selectedGenre, selectedInstrumentTag, selectedMood]);

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
  const refreshProject = async () => {
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
  };

  const fetchLicks = async () => {
    try {
      setLoadingLicks(true);

      // Build tags filter
      const tagsArray = [];
      if (selectedGenre) tagsArray.push(`genre:${selectedGenre}`);
      if (selectedInstrumentTag)
        tagsArray.push(`instrument:${selectedInstrumentTag}`);
      if (selectedMood) tagsArray.push(`mood:${selectedMood}`);
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

  // Playback control with playhead movement
  useEffect(() => {
    let animationFrame;
    let startTime;

    if (isPlaying) {
      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsed = (timestamp - startTime) / 1000; // Convert to seconds
        setPlaybackPosition(elapsed);
        animationFrame = requestAnimationFrame(animate);
      };
      animationFrame = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isPlaying]);

  const handlePlay = () => {
    setIsPlaying(true);
    // Playback is handled by the playhead animation
    // TODO: Implement actual audio playback with Tone.js for full DAW functionality
    // This would require:
    // 1. Loading audio files for licks
    // 2. Scheduling playback based on timeline items
    // 3. Generating backing track audio from chord progression + selected instrument
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setPlaybackPosition(0);
  };

  // Snap time to grid
  const snapTime = (time) => {
    if (!snapToGrid) return time;
    const beats = time / secondsPerBeat;
    const snappedBeats = Math.round(beats / snapValue) * snapValue;
    return snappedBeats * secondsPerBeat;
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
      const response = await addTrack(projectId, {
        trackName: "Backing Track",
        isBackingTrack: true,
        trackType: "backing",
      });
      if (response.success) {
        const createdTrack = {
          ...response.data,
          isBackingTrack: true,
          trackType: "backing",
        };
        setBackingTrack(createdTrack);
        setTracks((prev) => [...prev, createdTrack]);
        return createdTrack._id;
      }
    } catch (err) {
      console.error("Error creating backing track:", err);
    }
    return null;
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
      const response = await addLickToTimeline(projectId, {
        trackId: trackId.toString(),
        lickId: lickId.toString(),
        startTime: numericStartTime,
        duration: numericDuration,
      });

      if (response.success) {
        // Optimistic update - add item to local state immediately
        const newItem = response.data;
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
        // Silent refresh in background to ensure sync
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

  const handleDeleteTimelineItem = async (itemId) => {
    if (
      !window.confirm(
        "Are you sure you want to remove this lick from the timeline?"
      )
    ) {
      return;
    }

    try {
      // Optimistic update - remove item from local state immediately
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

  const handleAddTrack = async () => {
    const typeInput = prompt(
      "Create which type of track? Enter 'backing' or 'lick':",
      "lick"
    );
    if (!typeInput) return;
    const normalizedType = typeInput.trim().toLowerCase();
    const isBackingTrack = normalizedType === "backing";

    if (isBackingTrack && backingTrack) {
      alert(
        "A backing track already exists. Remove it before creating another."
      );
      return;
    }

    const defaultName = isBackingTrack ? "Backing Track" : "New Lick Track";
    const trackName = prompt("Enter track name:", defaultName);
    if (!trackName) return;

    try {
      const response = await addTrack(projectId, {
        trackName,
        isBackingTrack,
        trackType: isBackingTrack ? "backing" : "lick",
      });
      if (response.success) {
        const normalizedTrack = {
          ...response.data,
          isBackingTrack,
          trackType: isBackingTrack ? "backing" : "lick",
        };
        setTracks((prevTracks) => [...prevTracks, normalizedTrack]);
        if (isBackingTrack) {
          setBackingTrack(normalizedTrack);
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

  // Handle clip dragging with smooth real-time updates
  useEffect(() => {
    if (!isDraggingItem || !selectedItem) return;

    let currentItem = null;
    let currentTrack = null;

    // Find the item being dragged
    tracks.forEach((track) => {
      const item = track.items?.find((i) => i._id === selectedItem);
      if (item) {
        currentItem = item;
        currentTrack = track;
      }
    });

    if (!currentItem || !currentTrack) return;

    const handleMouseMove = (e) => {
      if (!timelineRef.current) return;

      const timelineElement = timelineRef.current;
      const timelineRect = timelineElement.getBoundingClientRect();
      const scrollLeft = timelineElement.scrollLeft || 0;
      const x = e.clientX - timelineRect.left + scrollLeft;
      const rawTime = Math.max(0, x / pixelsPerSecond);
      const snappedTime = snapTime(rawTime);

      // Real-time visual update during drag
      setTracks((prevTracks) =>
        prevTracks.map((track) => ({
          ...track,
          items: (track.items || []).map((item) =>
            item._id === selectedItem
              ? { ...item, startTime: snappedTime }
              : item
          ),
        }))
      );
    };

    const handleMouseUp = async (e) => {
      if (!timelineRef.current || !selectedItem) return;

      const timelineElement = timelineRef.current;
      const timelineRect = timelineElement.getBoundingClientRect();
      const scrollLeft = timelineElement.scrollLeft || 0;
      const x = e.clientX - timelineRect.left + scrollLeft;
      const rawTime = Math.max(0, x / pixelsPerSecond);
      const snappedTime = snapTime(rawTime);

      await handleClipMove(selectedItem, snappedTime);

      setIsDraggingItem(false);
      setSelectedItem(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isDraggingItem,
    selectedItem,
    pixelsPerSecond,
    snapToGrid,
    snapValue,
    secondsPerBeat,
    tracks,
  ]);

  const handleClipMouseDown = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedItem(item._id);
    setIsDraggingItem(true);
  };

  // Handle clip move
  const handleClipMove = async (itemId, newStartTime) => {
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
    try {
      // Optimistic update - update item position in local state immediately
      setTracks((prevTracks) =>
        prevTracks.map((track) => ({
          ...track,
          items: (track.items || []).map((item) =>
            item._id === itemId ? { ...item, startTime: newStartTime } : item
          ),
        }))
      );

      await updateTimelineItem(projectId, itemId, { startTime: newStartTime });
      // Silent refresh in background to ensure sync
      refreshProject();
    } catch (err) {
      console.error("Error moving clip:", err);
      // Revert on error by refreshing
      refreshProject();
    }
  };

  // Handle clip resize
  const handleClipResize = async (itemId, newDuration) => {
    const chordIndex = getChordIndexFromId(itemId);
    if (chordIndex !== null) {
      // Chord blocks have fixed duration for now
      return;
    }
    const snappedDuration = snapTime(newDuration);
    if (snappedDuration < 0.1) return; // Minimum duration
    try {
      // Optimistic update - update item duration in local state immediately
      setTracks((prevTracks) =>
        prevTracks.map((track) => ({
          ...track,
          items: (track.items || []).map((item) =>
            item._id === itemId ? { ...item, duration: snappedDuration } : item
          ),
        }))
      );

      await updateTimelineItem(projectId, itemId, {
        duration: snappedDuration,
      });
      // Silent refresh in background to ensure sync
      refreshProject();
    } catch (err) {
      console.error("Error resizing clip:", err);
      // Revert on error by refreshing
      refreshProject();
    }
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

  const timelineWidth = calculateTimelineWidth();
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      {/* Top Bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        {/* Left: Back Button and Project Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/projects")}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <FaTimes size={14} className="rotate-45" />
            Back to Projects
          </button>
          <h2 className="text-white font-semibold text-lg">
            {project.title} - {formatDate(project.createdAt)}
          </h2>
        </div>

        {/* Center: Playback Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isPlaying ? (
              <button
                onClick={handlePause}
                className="w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded text-white"
              >
                <FaPause size={14} />
              </button>
            ) : (
              <button
                onClick={handlePlay}
                className="w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded text-white"
              >
                <FaPlay size={14} />
              </button>
            )}
            <button
              onClick={handleStop}
              className="w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded text-white"
            >
              <FaStop size={14} />
            </button>
            <button className="w-10 h-10 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded text-white">
              <FaCircle size={12} />
            </button>
          </div>
          <div className="text-center">
            <div className="text-white font-medium">
              {project.tempo || 120} BPM
            </div>
            <div className="text-gray-400 text-xs">
              {project.timeSignature || "4/4"}
            </div>
          </div>
        </div>

        {/* Right: Action Buttons & Zoom Controls */}
        <div className="flex items-center gap-3">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1">
            <button
              onClick={() => setZoomLevel(Math.max(0.25, zoomLevel - 0.25))}
              className="text-gray-400 hover:text-white px-2"
              title="Zoom Out"
            >
              −
            </button>
            <span className="text-xs text-gray-400 min-w-[60px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(Math.min(4, zoomLevel + 0.25))}
              className="text-gray-400 hover:text-white px-2"
              title="Zoom In"
            >
              +
            </button>
          </div>

          {/* Snap Toggle */}
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`px-3 py-1 rounded text-xs font-medium ${
              snapToGrid
                ? "bg-orange-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
            title="Toggle Snap to Grid"
          >
            Snap
          </button>

          <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium">
            Invite
          </button>
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-gray-900"></div>
            <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-gray-900"></div>
            <div className="w-6 h-6 rounded-full bg-gray-600 border-2 border-gray-900"></div>
          </div>
          <button className="text-gray-400 hover:text-white">
            <FaLock size={16} />
          </button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium">
            Publish
          </button>
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
          <div className="flex-1 overflow-auto relative" ref={timelineRef}>
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
            {playbackPosition > 0 && (
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
            {tracks.map((track, trackIndex) => {
              const isHoveringTrack = dragOverTrack === track._id;
              return (
                <div
                  key={track._id}
                  className="flex border-b border-gray-800"
                  style={{ minHeight: "120px" }}
                >
                  <div
                    className={`w-64 border-r border-gray-800 p-4 flex flex-col gap-3 sticky left-0 z-10 ${
                      isHoveringTrack ? "bg-gray-900" : "bg-gray-950"
                    }`}
                    style={{ minHeight: "inherit" }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium text-sm">
                        {track.trackName}
                      </span>
                      <div className="flex gap-1">
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
                        className="flex-1 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
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
                      const snappedTime = snapTime(rawTime);
                      handleDrop(e, track._id, snappedTime);
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
                    {(track.isBackingTrack
                      ? [...(track.items || []), ...chordItems].sort(
                          (a, b) => (a.startTime || 0) - (b.startTime || 0)
                        )
                      : track.items || []
                    ).map((item) => {
                      const isSelected = selectedItem === item._id;
                      const clipWidth = item.duration * pixelsPerSecond;
                      const clipLeft = item.startTime * pixelsPerSecond;
                      const isChord =
                        item._isChord ||
                        (item.chord && track.isBackingTrack && !item.lickId);

                      return (
                        <div
                          key={item._id}
                          className={`absolute rounded border-2 ${
                            isChord
                              ? isSelected
                                ? "bg-green-500 border-yellow-400 shadow-lg shadow-yellow-400/50"
                                : "bg-green-600 border-green-700 hover:bg-green-700"
                              : isSelected
                              ? "bg-blue-500 border-yellow-400 shadow-lg shadow-yellow-400/50"
                              : "bg-blue-600 border-blue-700 hover:bg-blue-700"
                          } text-white cursor-move transition-all`}
                          style={{
                            left: `${clipLeft}px`,
                            width: `${clipWidth}px`,
                            top: "10px",
                            height: "100px",
                            minWidth: "60px",
                          }}
                          title={
                            isChord ? item.chord : item.lickId?.title || "Lick"
                          }
                          onMouseDown={(e) => handleClipMouseDown(e, item)}
                        >
                          {/* Waveform visualization if available */}
                          {item.lickId?.waveformData ? (
                            (() => {
                              try {
                                const waveform =
                                  typeof item.lickId.waveformData === "string"
                                    ? JSON.parse(item.lickId.waveformData)
                                    : item.lickId.waveformData;
                                const waveformArray = Array.isArray(waveform)
                                  ? waveform
                                  : [];
                                const sampleCount = Math.min(
                                  50,
                                  Math.floor(clipWidth / 4)
                                );
                                const step = Math.max(
                                  1,
                                  Math.floor(waveformArray.length / sampleCount)
                                );

                                return (
                                  <div className="absolute inset-0 p-2 flex items-center justify-center">
                                    <div className="w-full h-full bg-blue-800/30 rounded flex items-end justify-around gap-0.5">
                                      {waveformArray
                                        .filter((_, idx) => idx % step === 0)
                                        .slice(0, sampleCount)
                                        .map((value, idx) => (
                                          <div
                                            key={idx}
                                            className="bg-white rounded-t"
                                            style={{
                                              width: "2px",
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
                                return null;
                              }
                            })()
                          ) : (
                            <div className="flex flex-col justify-between h-full p-2">
                              <div className="font-medium text-sm truncate">
                                {isChord
                                  ? item.chord
                                  : item.lickId?.title ||
                                    `Lick ${trackIndex + 1}`}
                              </div>
                              <div className="text-xs opacity-75">
                                {item.startTime.toFixed(2)}s
                              </div>
                            </div>
                          )}

                          {/* Resize handle (right edge) */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-400"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              // TODO: Implement resize drag
                            }}
                          />

                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isChord) {
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
                    })}

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
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-white font-medium mb-3">Backing Tracks</h3>
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
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium">Chord Library</h3>
              {loadingChords && (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-orange-500" />
              )}
            </div>
            {chordLibraryError && (
              <p className="text-xs text-red-400 mb-2">
                {chordLibraryError}. Showing defaults.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {chordPalette.map((chord) => {
                const key = chord._id || chord.chordId || chord.chordName;
                return (
                  <button
                    key={key}
                    draggable
                    onDragStart={() => handleChordDragStart(chord)}
                    onDragEnd={() => setDraggedChord(null)}
                    onClick={() => handleAddChord(chord)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded text-sm font-medium transition-colors cursor-grab active:cursor-grabbing text-left"
                    title="Drag onto the backing track or click to append"
                  >
                    <span className="block font-semibold">
                      {chord.chordName || "Chord"}
                    </span>
                    {chord.midiNotes?.length ? (
                      <span className="text-[11px] text-blue-100/80 mt-1 block">
                        MIDI: {chord.midiNotes.join(", ")}
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
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "instrument"
                ? "bg-gray-800 text-white border-b-2 border-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Instrument
          </button>
          <button
            onClick={() => setActiveTab("midi-editor")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
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
          <div className="p-6">
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
          <div className="p-4 flex flex-col gap-4 h-full">
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

              {/* Filters */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const value = prompt(
                      "Filter by genre (leave empty to clear):",
                      selectedGenre || ""
                    );
                    if (value === null) return;
                    setSelectedGenre(value.trim() || null);
                  }}
                  className={`px-4 py-2 rounded text-sm transition-colors ${
                    selectedGenre
                      ? "bg-orange-600 hover:bg-orange-700 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}
                >
                  Genre {selectedGenre && `(${selectedGenre})`}
                </button>
                <button
                  onClick={() => {
                    const value = prompt(
                      "Filter by instrument (leave empty to clear):",
                      selectedInstrumentTag || ""
                    );
                    if (value === null) return;
                    setSelectedInstrumentTag(value.trim() || null);
                  }}
                  className={`px-4 py-2 rounded text-sm transition-colors ${
                    selectedInstrumentTag
                      ? "bg-orange-600 hover:bg-orange-700 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}
                >
                  Instrument{" "}
                  {selectedInstrumentTag && `(${selectedInstrumentTag})`}
                </button>
                <button
                  onClick={() => {
                    const value = prompt(
                      "Filter by mood (leave empty to clear):",
                      selectedMood || ""
                    );
                    if (value === null) return;
                    setSelectedMood(value.trim() || null);
                  }}
                  className={`px-4 py-2 rounded text-sm transition-colors ${
                    selectedMood
                      ? "bg-orange-600 hover:bg-orange-700 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}
                >
                  Mood {selectedMood && `(${selectedMood})`}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {availableLicks.map((lick) => (
                    <div
                      key={lick._id || lick.lick_id}
                      draggable
                      onDragStart={() => handleDragStart(lick)}
                      className="bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-orange-500 transition-colors"
                    >
                      <div className="font-medium text-white text-sm mb-1 truncate">
                        {lick.title || lick.name}
                      </div>
                      <div className="text-xs text-gray-400 mb-2">
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
                                className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded"
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
