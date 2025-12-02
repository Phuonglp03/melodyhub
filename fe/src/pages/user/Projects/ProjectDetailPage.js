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
  FaChevronDown,
  FaChevronUp,
  FaUserPlus,
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
import { createPost as createPostApi } from "../../../services/user/post";
import BackingTrackPanel from "../../../components/BackingTrackPanel";
import MidiEditor from "../../../components/MidiEditor";
import AIGenerationLoadingModal from "../../../components/AIGenerationLoadingModal";
import MidiClip from "../../../components/MidiClip";
import { convertProjectToStudioState } from "../Studio/studioTransformers";
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
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import ProjectBandEngine from "../../../components/ProjectBandEngine";
import ProjectLickLibrary from "../../../components/ProjectLickLibrary";
import ProjectExportButton from "../../../components/ProjectExportButton";
import ChordBlock from "../../../components/ChordBlock";
import BandConsole from "../../../components/BandConsole";
import InviteCollaboratorModal from "../../../components/InviteCollaboratorModal";
import { useProjectCollaboration } from "../../../hooks/useProjectCollaboration";
import { collabChannel } from "../../../utils/collabChannel";
// Extracted hooks
import { useProjectTimeline } from "../../../hooks/useProjectTimeline";
import { useProjectChords } from "../../../hooks/useProjectChords";
import { useProjectLicks } from "../../../hooks/useProjectLicks";
import { useProjectSettings } from "../../../hooks/useProjectSettings";
import { useProjectHistory } from "../../../hooks/useProjectHistory";
// Extracted components
import TimelineView from "../../../components/ProjectTimeline/TimelineView";
import ProjectSettingsPanel from "../../../components/ProjectSettings/ProjectSettingsPanel";
import CollaborationPanel from "../../../components/Collaboration/CollaborationPanel";
import ChordProgressionEditor from "../../../components/ChordProgression/ChordProgressionEditor";
import ChordLibrary from "../../../components/ChordProgression/ChordLibrary";
import ProjectPlaybackControls from "../../../components/AudioControls/ProjectPlaybackControls";
// Extracted utilities
import {
  formatLabelValue,
  formatTrackTitle,
  TRACK_COLOR_PALETTE,
  cloneTracksForHistory,
  cloneChordsForHistory,
  hydrateChordProgression,
  normalizeChordEntry,
  normalizeChordLibraryItem,
  cloneChordEntry,
  isChordInKey,
  getChordDegree,
  isBasicDiatonicChord,
} from "../../../utils/projectHelpers";
import {
  normalizeTimelineItem,
  getChordIndexFromId,
  formatTransportTime,
  getChordMidiEvents,
  MIN_CLIP_DURATION,
  normalizeRhythmPattern,
  normalizeRhythmSteps,
  registerPatternLookupKey,
  lookupPatternFromMap,
  createDefaultPatternSteps,
  normalizeTracks,
} from "../../../utils/timelineHelpers";
import {
  DEFAULT_BAND_MEMBERS,
  deriveLegacyMixFromMembers,
} from "../../../utils/bandDefaults";
import {
  normalizeKeyPayload,
  normalizeTimeSignaturePayload,
  getKeyDisplayName,
  getTimeSignatureDisplayName,
  clampSwingAmount,
} from "../../../utils/musicTheory";

// All utility functions moved to utils/projectHelpers.js and utils/timelineHelpers.js
// TrackDropZone component moved to components/ProjectTimeline/TrackDropZone.js

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const currentUserProfile =
    (user?.user && typeof user.user === "object" ? user.user : user) || {};
  const currentUserId =
    user?._id ||
    user?.id ||
    user?.user?._id ||
    user?.user?.id ||
    currentUserProfile?._id ||
    currentUserProfile?.id ||
    null;

  // Initialize collaboration (Phase 2: Frontend Middleware)
  const { broadcast, broadcastCursor, broadcastEditingActivity } =
    useProjectCollaboration(projectId, user);
  const isRemoteUpdateRef = useRef(false);
  const refreshProjectRef = useRef(null);

  // Phase 4: Collaborator presence state
  const [collaborators, setCollaborators] = useState([]);
  const [activeEditors, setActiveEditors] = useState(new Map()); // Track who is editing what: { itemId: { userId, userName, avatarUrl } }
  const [isConnected, setIsConnected] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [addTrackModalOpen, setAddTrackModalOpen] = useState(false);
  const [newTrackName, setNewTrackName] = useState("");
  const [addTrackError, setAddTrackError] = useState(null);
  const [addTrackSuccess, setAddTrackSuccess] = useState(null);

  // Project state (not in hooks)
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState("viewer");
  const [isDeleting, setIsDeleting] = useState(false);
  const [workspaceScale, setWorkspaceScale] = useState(0.9); // Overall UI scale

  // UI State (not in hooks)
  const [sidePanelOpen, setSidePanelOpen] = useState(true); // Bottom panel visibility
  const [sidePanelWidth, setSidePanelWidth] = useState(450); // Bottom panel height (resizable)
  const [bandSettings, setBandSettings] = useState(() => {
    const members = DEFAULT_BAND_MEMBERS;
    const legacy = deriveLegacyMixFromMembers(members);
    return {
      style: "Swing",
      swingAmount: 0.6,
      members,
      volumes: legacy.volumes,
      mutes: legacy.mutes,
    };
  });
  const [currentBeat, setCurrentBeat] = useState(0);
  const [midiEditorOpen, setMidiEditorOpen] = useState(false);
  const [editingTimelineItem, setEditingTimelineItem] = useState(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiNotification, setAiNotification] = useState(null); // { type: 'success'|'error', message: '' }
  const [trackContextMenu, setTrackContextMenu] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    trackId: null,
  });

  // Create refs for circular dependencies
  const pushHistoryRef = useRef(null);

  // Initialize hooks - must be called unconditionally before event handlers
  // Settings hook (needed first for bpm, key, time signature)
  const settingsHook = useProjectSettings({
    projectId,
    project,
    setProject,
    broadcast,
    refreshProject: () => refreshProjectRef.current?.(),
  });

  // Licks hook (independent, can be called early)
  const licksHook = useProjectLicks(user);

  // Timeline hook - needs bpm from settings
  const timelineHook = useProjectTimeline({
    projectId,
    bpm: settingsHook?.bpm || project?.tempo || 120,
    zoomLevel: 1, // Will be managed by hook
    broadcast,
    pushHistory: () => pushHistoryRef.current?.(),
    chordItems: [], // Will be updated from chords hook
    setError,
  });

  // Chords hook - needs projectKeyName from settings
  const chordsHook = useProjectChords({
    projectId,
    projectKeyName: settingsHook?.projectKeyName || null,
    broadcast,
    pushHistory: () => pushHistoryRef.current?.(),
    refreshProject: () => refreshProjectRef.current?.(),
  });

  // History hook - needs tracks and chordProgression from other hooks
  const historyHook = useProjectHistory({
    tracks: timelineHook?.tracks || [],
    chordProgression: chordsHook?.chordProgression || [],
    setTracks: timelineHook?.setTracks,
    setChordProgression: chordsHook?.setChordProgression,
    setSelectedItem: timelineHook?.setSelectedItem,
    setFocusedClipId: timelineHook?.setFocusedClipId,
  });

  // Update pushHistory ref
  useEffect(() => {
    pushHistoryRef.current = historyHook?.pushHistory;
  }, [historyHook?.pushHistory]);

  // Extract values from hooks for easier access
  const {
    tempoDraft,
    setTempoDraft,
    swingDraft,
    setSwingDraft,
    instruments,
    loadingInstruments,
    selectedInstrumentId,
    setSelectedInstrumentId,
    rhythmPatterns,
    loadingRhythmPatterns,
    selectedRhythmPatternId,
    setSelectedRhythmPatternId,
    bpm,
    projectKeyName: settingsProjectKeyName,
    projectTimeSignatureName,
    projectSwingAmount: settingsProjectSwingAmount,
    fetchInstruments,
    fetchRhythmPatterns,
    commitTempoChange,
    commitSwingChange,
    handleTimeSignatureChange,
    handleKeyChange,
  } = settingsHook || {};

  const resolvedBackingInstrumentId = useMemo(
    () => selectedInstrumentId || project?.backingInstrumentId || null,
    [selectedInstrumentId, project?.backingInstrumentId]
  );

  const {
    tracks,
    setTracks,
    zoomLevel,
    setZoomLevel,
    selectedItem,
    setSelectedItem,
    focusedClipId,
    setFocusedClipId,
    isDraggingItem,
    setIsDraggingItem,
    dragOffset,
    setDragOffset,
    resizeState,
    setResizeState,
    draggedLick,
    setDraggedLick,
    dragOverTrack,
    setDragOverTrack,
    dragOverPosition,
    setDragOverPosition,
    selectedTrackId,
    setSelectedTrackId,
    isPlaying,
    setIsPlaying,
    playbackPosition,
    setPlaybackPosition,
    metronomeEnabled,
    setMetronomeEnabled,
    loopEnabled,
    setLoopEnabled,
    isSavingTimeline,
    markTimelineItemDirty,
    flushTimelineSaves,
    scheduleTimelineAutosave,
    applyMagnet,
    handleClipOverlap,
    calculateTimelineWidth,
    handleDrop,
    handleDeleteTimelineItem,
    handleClipResize,
    handleClipMove,
    handleClipMouseDown,
    startClipResize,
    secondsPerBeat,
    timelineRef,
    playheadRef,
    clipRefs,
    TRACK_COLUMN_WIDTH,
    basePixelsPerSecond,
    pixelsPerSecond,
    pixelsPerBeat,
    hasUnsavedTimelineChanges,
  } = timelineHook || {};

  const instrumentHighlightId = useMemo(() => {
    if (!selectedTrackId) return resolvedBackingInstrumentId;
    const targetTrack = tracks.find((t) => t._id === selectedTrackId);
    if (!targetTrack) return null;
    if (targetTrack.isBackingTrack || targetTrack.trackType === "backing") {
      return resolvedBackingInstrumentId;
    }
    return targetTrack.instrument || null;
  }, [selectedTrackId, tracks, resolvedBackingInstrumentId]);

  const {
    chordProgression,
    setChordProgression,
    backingTrack,
    setBackingTrack,
    selectedChordIndex,
    setSelectedChordIndex,
    chordLibrary,
    loadingChords,
    chordLibraryError,
    showComplexChords,
    setShowComplexChords,
    chordLibraryTotal,
    selectedKeyFilter,
    setSelectedKeyFilter,
    draggedChord,
    setDraggedChord,
    chordItems,
    chordPalette,
    reorderChordProgression,
    saveChordProgression,
    handleAddChord,
    handleChordSelect,
    handleAddChordFromDeck,
    handleRemoveChord,
    handleChordDragStart,
    fetchChordLibrary,
    loadComplexChords,
    getChordDuration,
    getChordWidth,
    getChordStartPosition,
  } = chordsHook || {};

  const {
    lickSearchTerm,
    setLickSearchTerm,
    availableLicks,
    setAvailableLicks,
    loadingLicks,
    selectedGenre,
    setSelectedGenre,
    selectedType,
    setSelectedType,
    selectedEmotional,
    setSelectedEmotional,
    selectedTimbre,
    setSelectedTimbre,
    selectedArticulation,
    setSelectedArticulation,
    selectedCharacter,
    setSelectedCharacter,
    tagGroups,
    setTagGroups,
    activeTagDropdown,
    setActiveTagDropdown,
    tagDropdownRef: licksTagDropdownRef,
    lickPage,
    setLickPage,
    lickHasMore,
    setLickHasMore,
    playingLickId,
    setPlayingLickId,
    lickAudioRefs,
    setLickAudioRefs,
    lickProgress,
    setLickProgress,
    fetchLicks,
    loadMoreLicks,
    handleLickPlayPause,
    setLoadingLicks,
    LICKS_PER_PAGE,
  } = licksHook || {};

  const {
    historyStatus,
    pushHistory,
    handleUndo,
    handleRedo,
    updateHistoryStatus,
  } = historyHook || {};

  // Computed values that depend on hooks
  const normalizedTimeSignature = useMemo(
    () => normalizeTimeSignaturePayload(project?.timeSignature),
    [project?.timeSignature]
  );
  const beatsPerMeasure = normalizedTimeSignature?.numerator || 4;
  // Each chord in the STRUCTURE lane spans exactly one bar
  const chordDurationSeconds = beatsPerMeasure * secondsPerBeat;
  const projectSwingAmount = useMemo(
    () => clampSwingAmount(project?.swingAmount ?? 0),
    [project?.swingAmount]
  );

  // Rhythm Patterns lookup - depends on rhythmPatterns from hook
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

  // Track-related computed values
  const closeTrackMenu = useCallback(
    () => setTrackContextMenu({ isOpen: false, x: 0, y: 0, trackId: null }),
    []
  );
  const orderedTracks = useMemo(
    () => [...tracks].sort((a, b) => (a.trackOrder ?? 0) - (b.trackOrder ?? 0)),
    [tracks]
  );
  const userTracks = useMemo(
    () =>
      orderedTracks.filter(
        (track) => !track.isBackingTrack && track.trackType !== "backing"
      ),
    [orderedTracks]
  );
  const hasAnyUserClips = useMemo(
    () => userTracks.some((track) => (track.items || []).length > 0),
    [userTracks]
  );
  const menuTrack = useMemo(
    () =>
      trackContextMenu.trackId
        ? tracks.find((track) => track._id === trackContextMenu.trackId) || null
        : null,
    [trackContextMenu.trackId, tracks]
  );
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

  // Helper functions
  const updateBandSettings = (updater) => {
    setBandSettings((prev) => {
      const next =
        typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      const members = next.members || prev.members || [];
      const legacy = deriveLegacyMixFromMembers(members);
      return {
        ...prev,
        ...next,
        members,
        volumes: legacy.volumes,
        mutes: legacy.mutes,
      };
    });
  };

  const startPerformanceDeckResize = (e) => {
    if (!sidePanelOpen) return;
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = sidePanelWidth;

    const handleMouseMove = (moveEvent) => {
      const diff = startY - moveEvent.clientY; // Inverted for bottom panel
      const newHeight = Math.max(200, Math.min(500, startHeight + diff));
      setSidePanelWidth(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const adjustWorkspaceScale = useCallback((delta) => {
    setWorkspaceScale((prev) => {
      const next = parseFloat((prev + delta).toFixed(2));
      return Math.min(MAX_WORKSPACE_SCALE, Math.max(MIN_WORKSPACE_SCALE, next));
    });
  }, []);

  // Constants
  const COLLAPSED_DECK_HEIGHT = 44;
  const MIN_WORKSPACE_SCALE = 0.75;
  const MAX_WORKSPACE_SCALE = 1.1;
  const WORKSPACE_SCALE_STEP = 0.05;

  // Audio engine
  const audioEngine = useAudioEngine();
  const { schedulePlayback, stopPlayback, loadClipAudio } = useAudioScheduler();

  // Listen for remote collaboration updates
  useEffect(() => {
    const handleRemoteChordProgression = (payload) => {
      if (isRemoteUpdateRef.current) return;
      isRemoteUpdateRef.current = true;
      const { chords } = payload || {};
      saveChordProgression(chords, true).finally(() => {
        isRemoteUpdateRef.current = false;
      });
    };

    const handleRemoteLickAdd = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { trackId, item } = payload || {};

      // Optimistically add the item immediately (Google Docs-like)
      if (trackId && item) {
        setTracks((prevTracks) =>
          prevTracks.map((track) =>
            track._id === trackId
              ? {
                  ...track,
                  items: [...(track.items || []), normalizeTimelineItem(item)],
                }
              : track
          )
        );
      }

      // No delay - updates are already optimistic, refresh only for final sync
      // Removed delay for instant updates
    };

    const handleRemoteTimelineUpdate = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { itemId, customMidiEvents, isCustomized, updates = {} } =
        payload || {};

      if (!itemId) return;
      console.log("[Collaboration] Remote timeline update:", itemId);

      setTracks((prevTracks) =>
        prevTracks.map((track) => {
          const hasClip = (track.items || []).some(
            (item) => item._id === itemId
          );
          if (!hasClip) return track;

          return {
            ...track,
            items: (track.items || []).map((item) =>
              item._id === itemId
                ? normalizeTimelineItem({
                    ...item,
                    ...updates,
                    customMidiEvents:
                      customMidiEvents !== undefined
                        ? customMidiEvents
                        : item.customMidiEvents,
                    isCustomized:
                      isCustomized !== undefined
                        ? isCustomized
                        : item.isCustomized,
                  })
                : item
            ),
          };
        })
      );
    };

    const handleRemoteTimelineDelete = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { itemId } = payload || {};
      if (!itemId) return;
      console.log("[Collaboration] Remote timeline delete:", itemId);

      setTracks((prevTracks) =>
        prevTracks.map((track) => ({
          ...track,
          items: (track.items || []).filter((item) => item._id !== itemId),
        }))
      );
    };

    const handleRemoteTimelineBulkUpdate = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { items } = payload || {};
      if (!Array.isArray(items) || !items.length) return;
      console.log(
        "[Collaboration] Remote timeline bulk update:",
        items.map((item) => item._id)
      );

      setTracks((prevTracks) =>
        prevTracks.map((track) => {
          const updatedItems = (track.items || []).map((item) => {
            const incoming = items.find((entry) => entry._id === item._id);
            if (!incoming) return item;

            return normalizeTimelineItem({
              ...item,
              ...incoming,
            });
          });

          return {
            ...track,
            items: updatedItems,
          };
        })
      );
    };

    const handleRemoteSettingsUpdate = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const {
        tempo,
        swingAmount,
        timeSignature,
        key,
        style,
        backingInstrumentId,
      } = payload || {};

      // Apply settings updates optimistically
      if (project) {
        const updates = {};
        if (tempo !== undefined) updates.tempo = tempo;
        if (swingAmount !== undefined) updates.swingAmount = swingAmount;
        if (timeSignature !== undefined) updates.timeSignature = timeSignature;
        if (key !== undefined) updates.key = key;
        if (style !== undefined) updates.style = style;
        if (backingInstrumentId !== undefined)
          updates.backingInstrumentId = backingInstrumentId;

        if (Object.keys(updates).length > 0) {
          setProject((prev) => (prev ? { ...prev, ...updates } : prev));

          // Update draft values if they exist
          if (tempo !== undefined) setTempoDraft(String(tempo));
          if (swingAmount !== undefined) setSwingDraft(String(swingAmount));
        }
      }

      // Removed refresh call - optimistic update is sufficient
    };

    const handleRemoteTrackAdd = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { track } = payload || {};
      if (!track) return;
      console.log("[Collaboration] Remote track add received:", track?._id);

      const [normalizedTrack] =
        normalizeTracks([track], TRACK_COLOR_PALETTE) || [];
      if (!normalizedTrack) return;

      setTracks((prev) => {
        const exists = prev.some((t) => t._id === normalizedTrack._id);
        if (exists) {
          return prev.map((t) =>
            t._id === normalizedTrack._id ? { ...t, ...normalizedTrack } : t
          );
        }
        return [...prev, normalizedTrack];
      });
    };

    const handleRemoteTrackUpdate = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { trackId, updates } = payload || {};

      // Optimistically update track in local state
      if (trackId && updates) {
        setTracks((prevTracks) =>
          prevTracks.map((track) =>
            track._id === trackId ? { ...track, ...updates } : track
          )
        );
      }

      // Removed refresh call - optimistic update is sufficient
    };

    const handleRemoteTrackDelete = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { trackId } = payload || {};

      // Optimistically remove track from local state
      if (trackId) {
        setTracks((prev) => prev.filter((t) => t._id !== trackId));
      }

      // Removed refresh call - optimistic update is sufficient
    };

    const handleRemoteTimelinePositionUpdate = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { itemId, updates } = payload || {};

      if (!itemId || !updates) return;

      // Optimistically update timeline item position immediately (Google Docs-like)
      setTracks((prevTracks) =>
        prevTracks.map((track) => {
          const hasClip = (track.items || []).some(
            (item) => item._id === itemId
          );
          if (!hasClip) return track;

          const currentItem = (track.items || []).find(
            (item) => item._id === itemId
          );
          if (!currentItem) return track;

          // Check if update is needed
          const needsUpdate =
            (updates.startTime !== undefined &&
              currentItem.startTime !== updates.startTime) ||
            (updates.duration !== undefined &&
              currentItem.duration !== updates.duration) ||
            (updates.offset !== undefined &&
              currentItem.offset !== updates.offset);

          if (!needsUpdate) return track;

          // Apply updates optimistically
          const updatedItem = {
            ...currentItem,
            ...updates,
          };

          return {
            ...track,
            items: (track.items || []).map((item) =>
              item._id === itemId ? normalizeTimelineItem(updatedItem) : item
            ),
          };
        })
      );

      // Note: Remote updates don't need to be marked dirty since they're already saved on server
    };

    const handleRemotePresence = (payload) => {
      const {
        type,
        collaborators: remoteCollaborators,
        userId: eventUserId,
      } = payload || {};

      const ensureCollaboratorEntry = (list, userId, profile, roleLabel) => {
        if (!userId) return;
        const exists = list.some(
          (entry) => String(entry.userId) === String(userId)
        );
        if (exists) return;
        list.push({
          userId,
          user: profile
            ? {
                _id: profile._id || profile.id || userId,
                displayName: profile.displayName || profile.username || "",
                username: profile.username,
                avatarUrl: profile.avatarUrl,
                email: profile.email,
              }
            : undefined,
          role: roleLabel,
          status: "accepted",
        });
      };

      const normalizeCollaborators = (list = []) => {
        const next = Array.isArray(list) ? [...list] : [];
        const ownerProfile = project?.creatorId;
        const ownerId = ownerProfile?._id || ownerProfile?.id;

        ensureCollaboratorEntry(next, ownerId, ownerProfile, "owner");
        ensureCollaboratorEntry(
          next,
          currentUserId,
          currentUserProfile,
          userRole || "collaborator"
        );

        return next;
      };

      if (type === "SYNC" || type === "JOIN") {
        if (remoteCollaborators) {
          setCollaborators(normalizeCollaborators(remoteCollaborators));
        }
      } else if (type === "LEAVE") {
        if (eventUserId) {
          setCollaborators((prev) =>
            prev.filter((c) => c.userId !== eventUserId)
          );
        }
      } else if (remoteCollaborators) {
        setCollaborators(normalizeCollaborators(remoteCollaborators));
      }
    };

    const handleRemoteConnection = (payload) => {
      const { connected } = payload || {};
      setIsConnected(connected);
    };

    const handleRemoteEditingActivity = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { userId, itemId, isEditing } = payload || {};

      if (!userId || !itemId) return;

      setActiveEditors((prev) => {
        const next = new Map(prev);

        if (isEditing) {
          // Find user info from collaborators
          const collaborator = collaborators.find((c) => c.userId === userId);
          if (collaborator) {
            next.set(itemId, {
              userId,
              userName:
                collaborator.user?.displayName ||
                collaborator.user?.username ||
                "Someone",
              avatarUrl: collaborator.user?.avatarUrl,
            });
          }
        } else {
          // Remove editing indicator
          const current = next.get(itemId);
          if (current && current.userId === userId) {
            next.delete(itemId);
          }
        }

        return next;
      });
    };

    const handleRemoteSnapshot = (snapshot) => {
      if (!snapshot) {
        if (typeof refreshProjectRef.current === "function") {
          refreshProjectRef.current(false);
        }
        return;
      }

      const { project: snapshotProject, tracks: snapshotTracks } = snapshot;

      if (snapshotProject) {
        setProject((prev) => ({
          ...(prev || {}),
          ...snapshotProject,
        }));

        if (snapshotProject.chordProgression) {
          setChordProgression(
            hydrateChordProgression(snapshotProject.chordProgression)
          );
        }

        if (snapshotProject.tempo !== undefined) {
          setTempoDraft(String(snapshotProject.tempo));
        }

        if (snapshotProject.swingAmount !== undefined) {
          setSwingDraft(String(snapshotProject.swingAmount));
        }
      }

      if (Array.isArray(snapshotTracks)) {
        const normalizedTracks = normalizeTracks(
          snapshotTracks,
          TRACK_COLOR_PALETTE
        );
        setTracks(normalizedTracks);
      } else if (typeof refreshProjectRef.current === "function") {
        refreshProjectRef.current(false);
      }
    };

    const unsubscribers = [
      collabChannel.on(
        "project:remote:chordProgression",
        handleRemoteChordProgression
      ),
      collabChannel.on("project:remote:lickAdd", handleRemoteLickAdd),
      collabChannel.on(
        "project:remote:timelineUpdate",
        handleRemoteTimelineUpdate
      ),
      collabChannel.on(
        "project:remote:timelineDelete",
        handleRemoteTimelineDelete
      ),
      collabChannel.on(
        "project:remote:settingsUpdate",
        handleRemoteSettingsUpdate
      ),
      collabChannel.on("project:remote:trackAdd", handleRemoteTrackAdd),
      collabChannel.on("project:remote:trackUpdate", handleRemoteTrackUpdate),
      collabChannel.on("project:remote:trackDelete", handleRemoteTrackDelete),
      collabChannel.on(
        "project:remote:timelineBulkUpdate",
        handleRemoteTimelineBulkUpdate
      ),
      collabChannel.on(
        "project:remote:timelinePositionUpdate",
        handleRemoteTimelinePositionUpdate
      ),
      collabChannel.on("project:remote:presence", handleRemotePresence),
      collabChannel.on("project:remote:connection", handleRemoteConnection),
      collabChannel.on(
        "project:remote:editingActivity",
        handleRemoteEditingActivity
      ),
      collabChannel.on("project:remote:snapshot", handleRemoteSnapshot),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe && unsubscribe());
    };
  }, [
    collaborators,
    setTracks,
    setChordProgression,
    saveChordProgression,
    setTempoDraft,
    setSwingDraft,
    setProject,
    refreshProjectRef,
    normalizeTimelineItem,
    project?.creatorId?._id,
    currentUserId,
    userRole,
  ]);

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
          if (response.data.project.bandSettings?.members?.length) {
            updateBandSettings(response.data.project.bandSettings);
          }
          setChordProgression(
            hydrateChordProgression(response.data.project.chordProgression)
          );
          const normalized = normalizeTracks(
            response.data.tracks || [],
            TRACK_COLOR_PALETTE
          );
          setTracks(normalized);

          // Store userRole if available
          if (response.data.userRole) {
            setUserRole(response.data.userRole);
          }

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
    [
      projectId,
      setChordProgression,
      setTracks,
      setSelectedInstrumentId,
      setBackingTrack,
      setLoadingLicks,
      setProject,
      setUserRole,
      setError,
      setLoading,
      updateBandSettings,
      hydrateChordProgression,
      normalizeTracks,
      TRACK_COLOR_PALETTE,
    ]
  );

  const refreshProject = useCallback(() => fetchProject(false), [fetchProject]);

  // Update ref when refreshProject changes
  useEffect(() => {
    refreshProjectRef.current = refreshProject;
  }, [refreshProject]);

  // fetchLicks, loadMoreLicks, and handleLickPlayPause are now in useProjectLicks hook

  // Fetch project, instruments, and rhythm patterns on mount or projectId change
  // Note: fetchInstruments and fetchRhythmPatterns are memoized with empty deps, so they're stable
  // fetchProject may change, but we only want to refetch when projectId changes
  useEffect(() => {
    fetchProject(true); // Show loading only on initial load
    fetchInstruments();
    fetchRhythmPatterns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]); // Only depend on projectId - fetchInstruments/fetchRhythmPatterns are stable, fetchProject may change but we only refetch on projectId change

  // fetchChordLibrary is now in useProjectChords hook
  // loadComplexChords is now in useProjectChords hook
  // Pointer up handler is now handled in useProjectTimeline hook's drag useEffect

  // playbackPositionRef for immediate position access
  const playbackPositionRef = useRef(playbackPosition);
  useEffect(() => {
    playbackPositionRef.current = playbackPosition;
  }, [playbackPosition]);

  // Warn on page unload if there are unsaved timeline changes
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedTimelineChanges) return;
      event.preventDefault();
      // Chrome requires returnValue to be set.
      event.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedTimelineChanges]);

  useEffect(() => {
    setTempoDraft(String(project?.tempo || 120));
  }, [project?.tempo, setTempoDraft]);

  useEffect(() => {
    setSwingDraft(String(projectSwingAmount));
  }, [projectSwingAmount, setSwingDraft]);

  const formattedPlayTime = useMemo(
    () => formatTransportTime(playbackPosition),
    [playbackPosition]
  );

  // Resolve audio URL for a timeline item (licks & chord audio)
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

  // Schedule audio playback for current tracks
  const scheduleAudioPlayback = useCallback(async () => {
    await schedulePlayback(tracks, getAudioUrlForItem);
  }, [tracks, schedulePlayback, getAudioUrlForItem]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closeTrackMenu();
        setFocusedClipId(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeTrackMenu, setFocusedClipId]);

  // chordDurationSeconds, chordItems, and chordPalette are now in useProjectChords hook

  const studioSeed = useMemo(() => {
    if (!project) return null;
    const base = convertProjectToStudioState({
      ...project,
      chordProgression,
    });
    if (!base) return null;
    return {
      ...base,
      projectId: project._id || project.id || projectId,
      projectTitle:
        base.projectTitle || project.title || project.name || "Untitled",
      licks: availableLicks, // share current lick list to studio
    };
  }, [project, chordProgression, projectId, availableLicks]);

  // reorderChordProgression is now in useProjectChords hook

  // fetchInstruments and fetchRhythmPatterns are now in useProjectSettings hook

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
        // Broadcast to collaborators immediately (before refresh)
        if (broadcast) {
          broadcast("LICK_ADD_TO_TIMELINE", {
            trackId: timelineData.trackId,
            item: response.data,
          });
        }

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

    // Broadcast that we're editing this item
    if (broadcastEditingActivity && timelineItem?._id) {
      broadcastEditingActivity(timelineItem._id, true);
    }
  };

  // Handle closing MIDI editor
  const handleCloseMidiEditor = () => {
    // Broadcast that we're done editing
    if (broadcastEditingActivity && editingTimelineItem?._id) {
      broadcastEditingActivity(editingTimelineItem._id, false);
    }

    setMidiEditorOpen(false);
    setEditingTimelineItem(null);
  };

  // Handle saving MIDI edits
  const handleSaveMidiEdit = async (updatedItem) => {
    try {
      // Optimistic update - update local state immediately
      setTracks((prevTracks) =>
        prevTracks.map((track) => {
          const hasClip = (track.items || []).some(
            (item) => item._id === updatedItem._id
          );
          if (!hasClip) return track;

          return {
            ...track,
            items: (track.items || []).map((item) =>
              item._id === updatedItem._id
                ? {
                    ...item,
                    customMidiEvents: updatedItem.customMidiEvents,
                    isCustomized: updatedItem.isCustomized,
                  }
                : item
            ),
          };
        })
      );

      // Broadcast to collaborators immediately (before API call)
      if (broadcast) {
        broadcast("TIMELINE_ITEM_UPDATE", {
          itemId: updatedItem._id,
          customMidiEvents: updatedItem.customMidiEvents,
          isCustomized: updatedItem.isCustomized,
        });
      }

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
  // getAudioUrlForItem and scheduleAudioPlayback are now in useProjectTimeline hook

  //  Auto-reschedule audio when tracks change during playback
  // This is key for live editing while playing (like professional DAWs)
  useEffect(() => {
    if (isPlaying && audioEngine.players.size > 0) {
      const timeoutId = setTimeout(() => {
        scheduleAudioPlayback();
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [tracks, isPlaying, scheduleAudioPlayback, audioEngine]); // Reschedule when tracks or playback state changes

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

  // handlePlay, handlePause, handleStop, handleReturnToStart, handlePlayToggle are now in useProjectTimeline hook

  // Snap time to grid and clip edges
  // applyMagnet, handleClipOverlap, and calculateTimelineWidth are now in useProjectTimeline hook

  // saveChordProgression is now in useProjectChords hook

  const applyBackingInstrumentSelection = async (instrumentId) => {
    setSelectedInstrumentId(instrumentId);
    setProject((prev) => ({
      ...prev,
      backingInstrumentId: instrumentId,
    }));

    // Broadcast to collaborators immediately (before API call)
    if (broadcast) {
      broadcast("PROJECT_SETTINGS_UPDATE", {
        backingInstrumentId: instrumentId,
      });
    }

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
        const [createdTrack] = normalizeTracks(
          [
            {
              ...response.data,
              isBackingTrack: true,
              trackType: "backing",
              color: response.data.color || defaultColor,
            },
          ],
          TRACK_COLOR_PALETTE
        );
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

  // commitTempoChange, commitSwingChange, handleTimeSignatureChange, and handleKeyChange are now in useProjectSettings hook

  // handleAddChord, handleChordSelect, handleAddChordFromDeck, and handleRemoveChord are now in useProjectChords hook

  // handleDragStart is now in useProjectLicks hook
  // handleChordDragStart is now in useProjectChords hook

  const finishDragging = () => {
    setIsDraggingItem(false);
    setSelectedItem(null);
    setDragOffset({ x: 0, trackId: null });
  };

  // handleDrop is now in useProjectTimeline hook

  // handleDeleteTimelineItem is now in useProjectTimeline hook

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

  const handleAddTrack = () => {
    // Check track limit (max 10 tracks per project)
    if (tracks.length >= 10) {
      setAddTrackError(
        "Maximum of 10 tracks allowed per project. Please remove a track before adding a new one."
      );
      setAddTrackModalOpen(true);
      return;
    }
    setNewTrackName(`New Audio Track ${tracks.length + 1}`);
    setAddTrackError(null);
    setAddTrackSuccess(null);
    setAddTrackModalOpen(true);
  };

  const handleConfirmAddTrack = async () => {
    if (!newTrackName.trim()) {
      setAddTrackError("Please enter a track name");
      return;
    }

    // Check track limit again
    if (tracks.length >= 10) {
      setAddTrackError(
        "Maximum of 10 tracks allowed per project. Please remove a track before adding a new one."
      );
      return;
    }

    // Default to audio track type
    const trackTypeValue = "audio";
    const isBackingTrack = false;

    try {
      setAddTrackError(null);
      setAddTrackSuccess(null);

      const defaultColor =
        TRACK_COLOR_PALETTE[tracks.length % TRACK_COLOR_PALETTE.length];
      const response = await addTrack(projectId, {
        trackName: newTrackName.trim(),
        isBackingTrack,
        trackType: trackTypeValue,
        color: defaultColor,
      });

      if (response.success) {
        const [normalizedTrack] = normalizeTracks(
          [
            {
              ...response.data,
              isBackingTrack,
              trackType: trackTypeValue,
              color: response.data.color || defaultColor,
            },
          ],
          TRACK_COLOR_PALETTE
        );
        if (normalizedTrack) {
          pushHistory();
          setTracks((prevTracks) => [...prevTracks, normalizedTrack]);

          if (broadcast) {
            broadcast("TRACK_ADD", { track: normalizedTrack });
          }

          setAddTrackSuccess(
            `Track "${newTrackName.trim()}" added successfully!`
          );
          setTimeout(() => {
            setAddTrackModalOpen(false);
            setNewTrackName("");
            setAddTrackSuccess(null);
          }, 1500);
        }
        refreshProject();
      }
    } catch (err) {
      console.error("Error adding track:", err);
      setAddTrackError(err.message || "Failed to add track");
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

      // Broadcast to collaborators immediately (before API call)
      if (broadcast) {
        broadcast("TRACK_UPDATE", { trackId, updates });
      }

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

    // Broadcast to collaborators immediately (before API call)
    if (broadcast) {
      broadcast("TRACK_UPDATE", {
        trackId: track._id,
        updates: { trackOrder: targetOrder },
      });
      broadcast("TRACK_UPDATE", {
        trackId: targetTrack._id,
        updates: { trackOrder: currentOrder },
      });
    }

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
      pushHistory();
      // Optimistic update - remove track from local state immediately
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

      // Broadcast to collaborators immediately (before API call)
      if (broadcast) {
        broadcast("TRACK_DELETE", { trackId: track._id });
      }

      await deleteTrack(projectId, track._id);

      refreshProject();
    } catch (err) {
      console.error("Error deleting track:", err);
      refreshProject();
    }
  };

  // handleClipMouseDown, startClipResize, and drag/resize useEffects are now in useProjectTimeline hook

  // handleClipMove is now in useProjectTimeline hook

  // getChordDuration, getChordWidth, and getChordStartPosition are now in useProjectChords hook

  // Transport / playback handlers
  const handlePlay = useCallback(async () => {
    await audioEngine.ensureStarted();
    if (!audioEngine.transport) {
      console.error("Tone.Transport is not available");
      return;
    }

    // Set transport position to current playhead
    audioEngine.setPosition(playbackPositionRef.current);
    audioEngine.setBpm(bpm);

    setIsPlaying(true);

    // Schedule audio clips
    await scheduleAudioPlayback();

    // Start transport
    audioEngine.startTransport();
  }, [audioEngine, bpm, scheduleAudioPlayback]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    audioEngine.pauseTransport();
    audioEngine.stopAllPlayers();
  }, [audioEngine, setIsPlaying]);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    setPlaybackPosition(0);
    playbackPositionRef.current = 0;
    audioEngine.stopTransport();
    audioEngine.stopAllPlayers();
  }, [audioEngine, setPlaybackPosition, setIsPlaying]);

  const handleReturnToStart = useCallback(() => {
    setIsPlaying(false);
    setPlaybackPosition(0);
    playbackPositionRef.current = 0;
    audioEngine.setPosition(0);
  }, [audioEngine, setPlaybackPosition, setIsPlaying]);

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

  // Extract project key and style for components
  const projectKeyRaw = project?.key;
  const projectKey =
    typeof projectKeyRaw === "string"
      ? projectKeyRaw.replace(" Major", "").replace(" Minor", "m")
      : typeof projectKeyRaw === "object" && projectKeyRaw?.root
      ? projectKeyRaw.root
      : "C";
  const projectStyle = project?.style || "Swing";

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-screen w-full overflow-hidden bg-black">
        {/* Hidden Band Engine */}
        <ProjectBandEngine
          chordProgression={chordProgression}
          isPlaying={isPlaying}
          bpm={project?.bpm || 120}
          style={projectStyle}
          bandSettings={bandSettings}
          onBeatUpdate={(beat, chordIndex) => {
            setCurrentBeat(beat);
          }}
        />
        <div
          className="flex flex-col h-screen bg-black text-white overflow-hidden"
          style={{
            transform: `scale(${workspaceScale})`,
            transformOrigin: "top left",
            width: `${(1 / workspaceScale) * 100}%`,
            height: `${(1 / workspaceScale) * 100}%`,
          }}
        >
          {/* Top Bar - Compact Controls */}
          <div className="bg-gray-950 border-b border-gray-800/60 px-4 py-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => navigate("/projects")}
                  className="h-9 px-3 rounded-full bg-gray-900 text-white text-xs font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors"
                >
                  <FaTimes size={12} className="rotate-45" />
                  Back
                </button>
                <div className="flex items-center gap-1 bg-gray-900/70 border border-gray-800 rounded-full px-2 py-1">
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
                  <span className="text-[10px] uppercase tracking-wide text-gray-400 px-1">
                    {isSavingTimeline
                      ? "Saving..."
                      : hasUnsavedTimelineChanges
                      ? "Unsaved"
                      : "Synced"}
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
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-gray-900/60 border border-gray-800 rounded-full px-2 py-1 text-[11px] text-gray-300">
                    <button
                      type="button"
                      onClick={() =>
                        setZoomLevel(Math.max(0.25, zoomLevel - 0.25))
                      }
                      className="px-2 py-0.5 rounded-full bg-gray-950 hover:bg-gray-800 text-white"
                      title="Zoom out"
                    >
                      −
                    </button>
                    <span className="min-w-[44px] text-center font-mono">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setZoomLevel(Math.min(4, zoomLevel + 0.25))
                      }
                      className="px-2 py-0.5 rounded-full bg-gray-950 hover:bg-gray-800 text-white"
                      title="Zoom in"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-1 bg-gray-900/60 border border-gray-800 rounded-full px-2 py-1 text-[11px] text-gray-300">
                    <span className="uppercase text-gray-500">Display</span>
                    <button
                      type="button"
                      onClick={() =>
                        adjustWorkspaceScale(-WORKSPACE_SCALE_STEP)
                      }
                      disabled={workspaceScale <= MIN_WORKSPACE_SCALE + 0.001}
                      className="px-2 py-0.5 rounded-full bg-gray-950 hover:bg-gray-800 text-white disabled:opacity-40"
                      title="Scale entire workspace down"
                    >
                      −
                    </button>
                    <span className="min-w-[44px] text-center font-mono">
                      {workspaceScalePercentage}%
                    </span>
                    <button
                      type="button"
                      onClick={() => adjustWorkspaceScale(WORKSPACE_SCALE_STEP)}
                      disabled={workspaceScale >= MAX_WORKSPACE_SCALE - 0.001}
                      className="px-2 py-0.5 rounded-full bg-gray-950 hover:bg-gray-800 text-white disabled:opacity-40"
                      title="Scale entire workspace up"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
                <ProjectPlaybackControls
                  isPlaying={isPlaying}
                  loopEnabled={loopEnabled}
                  metronomeEnabled={metronomeEnabled}
                  formattedPlayTime={formattedPlayTime}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onStop={handleStop}
                  onReturnToStart={handleReturnToStart}
                  onLoopToggle={() => setLoopEnabled((prev) => !prev)}
                  onMetronomeToggle={() => setMetronomeEnabled((prev) => !prev)}
                  className="shadow-inner"
                />
                <ProjectSettingsPanel
                  tempoDraft={tempoDraft}
                  setTempoDraft={setTempoDraft}
                  onTempoCommit={commitTempoChange}
                  projectKey={settingsProjectKeyName}
                  onKeyChange={handleKeyChange}
                  projectTimeSignature={projectTimeSignatureName}
                  onTimeSignatureChange={handleTimeSignatureChange}
                />
                <ProjectExportButton
                  variant="compact"
                  className="shadow-lg"
                  projectId={projectId}
                  projectName={project?.name || project?.title || "Untitled"}
                  chordProgression={chordProgression}
                  bpm={project?.bpm || 120}
                  projectKey={projectKey}
                  style={projectStyle}
                  bandSettings={bandSettings}
                  status={project?.status}
                  timeSignature={normalizedTimeSignature}
                  onExportComplete={(exportData) => {
                    setProject((prev) =>
                      prev
                        ? {
                            ...prev,
                            audioUrl: exportData.audioUrl,
                            audioDuration: exportData.audioDuration,
                            waveformData: exportData.waveformData,
                          }
                        : prev
                    );
                  }}
                />
                <button
                  type="button"
                  disabled={!project?.audioUrl}
                  onClick={async () => {
                    if (!project?.audioUrl) {
                      alert("Please export project audio before sharing.");
                      return;
                    }
                    try {
                      console.log("(NO $) [DEBUG][ProjectExport] ShareToFeed:", {
                        projectId,
                        hasAudioUrl: !!project.audioUrl,
                      });

                      const payload = {
                        postType: "status_update",
                        textContent: `🎵 New project export: ${
                          project.title || "Untitled Project"
                        }`,
                        media: [
                          {
                            url: project.audioUrl,
                            type: "audio",
                          },
                        ],
                      };
                      const res = await createPostApi(payload);
                      if (res?.success) {
                        alert("Shared to feed!");
                      } else {
                        alert("Failed to share. Please try again.");
                      }
                    } catch (err) {
                      console.error("Error sharing project export:", err);
                      alert(
                        err?.response?.data?.message ||
                          err?.message ||
                          "Failed to share project export"
                      );
                    }
                  }}
                  className="h-9 px-3 rounded-full bg-gray-900 text-white text-xs font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={
                    project?.audioUrl
                      ? "Share this exported audio to your feed"
                      : "Export audio first to share"
                  }
                >
                  Share to Feed
                </button>
                <CollaborationPanel
                  collaborators={collaborators}
                  currentUserId={user?._id}
                  activeEditors={activeEditors}
                  isConnected={isConnected}
                  onInvite={() => setInviteModalOpen(true)}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-400 mt-2">
              <span>
                {project.title} • {formatDate(project.createdAt)}
              </span>
              <span className="flex items-center gap-2">
                <span>Zoom {Math.round(zoomLevel * 100)}%</span>
                <span>Display {workspaceScalePercentage}%</span>
                <span>{projectTimeSignatureName}</span>
                <span>{settingsProjectKeyName || "Key"}</span>
              </span>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Timeline Area - Always Visible */}
            <div className="flex-1 flex bg-gray-900 overflow-hidden min-h-0">
              {/* Lick Vault - Left Edge */}
              <div className="w-80 border-r border-gray-900 bg-black flex flex-col flex-shrink-0">
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <ProjectLickLibrary
                    initialLicks={availableLicks}
                    onLickDrop={(lick) => {
                      console.log("Lick dropped:", lick);
                    }}
                  />
                </div>
              </div>

              {/* Main Timeline Column */}
              <div className="flex-1 flex flex-col min-w-0 bg-gray-900">
                {/* Main Timeline Area */}
                <div className="flex-1 relative flex flex-col min-w-0">
                  <div
                    className="flex-1 relative flex flex-col min-w-0"
                    style={{
                      paddingBottom:
                        (sidePanelOpen
                          ? sidePanelWidth
                          : COLLAPSED_DECK_HEIGHT) + 24,
                    }}
                  >
                    <TimelineView
                      tracks={tracks}
                      chordProgression={chordProgression}
                      pixelsPerSecond={pixelsPerSecond}
                      pixelsPerBeat={pixelsPerBeat}
                      secondsPerBeat={secondsPerBeat}
                      beatsPerMeasure={beatsPerMeasure}
                      timelineWidth={timelineWidth}
                      playbackPosition={playbackPosition}
                      isPlaying={isPlaying}
                      chordDurationSeconds={chordDurationSeconds}
                      selectedChordIndex={selectedChordIndex}
                      collaborators={collaborators}
                      broadcastCursor={broadcastCursor}
                      timelineRef={timelineRef}
                      playheadRef={playheadRef}
                      clipRefs={clipRefs}
                      TRACK_COLUMN_WIDTH={TRACK_COLUMN_WIDTH}
                      calculateTimelineWidth={calculateTimelineWidth}
                      selectedTrackId={selectedTrackId}
                      setSelectedTrackId={setSelectedTrackId}
                      dragOverTrack={dragOverTrack}
                      setDragOverTrack={setDragOverTrack}
                      dragOverPosition={dragOverPosition}
                      setDragOverPosition={setDragOverPosition}
                      focusedClipId={focusedClipId}
                      setFocusedClipId={setFocusedClipId}
                      selectedItem={selectedItem}
                      setSelectedItem={setSelectedItem}
                      isDraggingItem={isDraggingItem}
                      draggedLick={draggedLick}
                      setDraggedLick={setDraggedLick}
                      activeEditors={activeEditors}
                      currentUserId={user?._id}
                      handleDrop={handleDrop}
                      handleClipMouseDown={handleClipMouseDown}
                      handleClipResizeStart={startClipResize}
                      handleOpenMidiEditor={handleOpenMidiEditor}
                      handleUpdateTrack={handleUpdateTrack}
                      handleDeleteTimelineItem={handleDeleteTimelineItem}
                      handleRemoveChord={handleRemoveChord}
                      setSelectedChordIndex={setSelectedChordIndex}
                      openTrackMenu={openTrackMenu}
                      trackContextMenu={trackContextMenu}
                      getRhythmPatternVisual={getRhythmPatternVisual}
                      applyMagnet={applyMagnet}
                      onTimelineClick={() => {
                        setFocusedClipId(null);
                        closeTrackMenu();
                      }}
                      hasAnyUserClips={hasAnyUserClips}
                      userTracksLength={userTracks.length}
                      onAddTrack={handleAddTrack}
                      canAddTrack={tracks.length < 10}
                    />
                  </div>

                  <div className="flex border-t border-gray-850">
                    <div className="w-64 bg-gray-950 border-r border-gray-850 px-3 py-2">
                      <button
                        onClick={handleAddTrack}
                        disabled={tracks.length >= 10}
                        className={`w-full px-3 py-1.5 rounded-full text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                          tracks.length >= 10
                            ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                            : "bg-gray-900 hover:bg-gray-800 text-white"
                        }`}
                        title={
                          tracks.length >= 10
                            ? "Maximum of 10 tracks allowed per project"
                            : "Add a new track"
                        }
                      >
                        <FaPlus size={10} />
                        Add Track
                      </button>
                    </div>
                    <div className="flex-1 bg-gray-900 px-4 py-2 text-[11px] text-gray-500 flex items-center">
                      {userTracks.length} / 10 tracks •{" "}
                      {hasAnyUserClips ? "Editing" : "Empty arrangement"}
                    </div>
                  </div>

                  {/* Embedded Bottom Panel */}
                  <div
                    className="absolute left-0 right-0 transition-all duration-300 ease-in-out"
                    style={{
                      height: sidePanelOpen
                        ? sidePanelWidth
                        : COLLAPSED_DECK_HEIGHT,
                      bottom: 0,
                    }}
                  >
                    <div className="h-full flex flex-col shadow-2xl shadow-black/50">
                      <div className="flex items-center justify-between h-11 px-4 bg-gray-950 border-t border-gray-800">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          <FaPalette size={12} className="text-orange-400" />
                          Performance Deck
                        </div>
                        <div className="flex items-center gap-2">
                          {sidePanelOpen && (
                            <button
                              onMouseDown={startPerformanceDeckResize}
                              className="text-gray-500 hover:text-white px-2 py-1 rounded-md border border-gray-700 text-[11px]"
                              title="Drag to resize"
                            >
                              Resize
                            </button>
                          )}
                          <button
                            onClick={() => setSidePanelOpen((prev) => !prev)}
                            className="text-gray-400 hover:text-white p-1 rounded-md border border-gray-700"
                            title={
                              sidePanelOpen ? "Collapse panel" : "Expand panel"
                            }
                          >
                            {sidePanelOpen ? (
                              <FaChevronDown size={12} />
                            ) : (
                              <FaChevronUp size={12} />
                            )}
                          </button>
                        </div>
                      </div>

                      <div
                        className={`bg-gray-950 border-t border-gray-800 flex-1 flex flex-col transition-opacity duration-200 ${
                          sidePanelOpen
                            ? "opacity-100"
                            : "opacity-0 pointer-events-none"
                        }`}
                      >
                        {sidePanelOpen && (
                          <BandConsole
                            selectedChordIndex={selectedChordIndex}
                            onChordSelect={handleChordSelect}
                            onAddChord={handleAddChordFromDeck}
                            projectKey={projectKey}
                            bandSettings={bandSettings}
                            onSettingsChange={updateBandSettings}
                            style={projectStyle}
                            onStyleChange={(newStyle) => {
                              if (project) {
                                setProject({ ...project, style: newStyle });

                                // Broadcast to collaborators immediately (before API call)
                                if (broadcast) {
                                  broadcast("PROJECT_SETTINGS_UPDATE", {
                                    style: newStyle,
                                  });
                                }

                                updateProject(projectId, { style: newStyle });
                              }
                            }}
                            instruments={instruments}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
                    <p className="text-xs text-orange-400 mt-1">
                      Backing track
                    </p>
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
                          onClick={() =>
                            handleTrackColorChange(menuTrack, color)
                          }
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

          {/* Invite Collaborator Modal */}
          <InviteCollaboratorModal
            isOpen={inviteModalOpen}
            onClose={() => setInviteModalOpen(false)}
            projectId={projectId}
            currentUserId={user?._id}
            userRole={userRole}
            projectOwner={project?.creatorId}
            onCollaboratorAdded={(newCollaborator) => {
              // Refresh project to get updated collaborator list
              if (refreshProjectRef.current) {
                refreshProjectRef.current();
              }
            }}
            onCollaboratorRemoved={(userId) => {
              // Update local state
              setCollaborators((prev) =>
                prev.filter((c) => (c.userId || c._id) !== userId)
              );
              // Refresh project
              if (refreshProjectRef.current) {
                refreshProjectRef.current();
              }
            }}
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

          {/* Add Track Modal */}
          {addTrackModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
              <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-md mx-4 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                  <h2 className="text-lg font-semibold text-white">
                    Add New Track
                  </h2>
                  <button
                    onClick={() => {
                      setAddTrackModalOpen(false);
                      setNewTrackName("");
                      setAddTrackError(null);
                      setAddTrackSuccess(null);
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <FaTimes size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Track Name
                    </label>
                    <input
                      type="text"
                      value={newTrackName}
                      onChange={(e) => setNewTrackName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && newTrackName.trim()) {
                          handleConfirmAddTrack();
                        }
                      }}
                      placeholder="Enter track name"
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                      autoFocus
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Track type: Audio (default)
                    </p>
                  </div>

                  {/* Messages */}
                  {addTrackError && (
                    <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-red-400 text-sm">
                      {addTrackError}
                    </div>
                  )}
                  {addTrackSuccess && (
                    <div className="p-3 bg-green-900/20 border border-green-700/50 rounded-lg text-green-400 text-sm">
                      {addTrackSuccess}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setAddTrackModalOpen(false);
                      setNewTrackName("");
                      setAddTrackError(null);
                      setAddTrackSuccess(null);
                    }}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmAddTrack}
                    disabled={!newTrackName.trim() || !!addTrackSuccess}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <FaPlus size={14} />
                    {addTrackSuccess ? "Added!" : "Add Track"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DndProvider>
  );
}; // ProjectDetailPage component

export default ProjectDetailPage;
