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
// New extracted hooks
import { useProjectData } from "../../../hooks/useProjectData";
import { useProjectComputed } from "../../../hooks/useProjectComputed";
import { useProjectCollaborationEvents } from "../../../hooks/useProjectCollaborationEvents";
import { useProjectTracks } from "../../../hooks/useProjectTracks";
import { useProjectPlayback } from "../../../hooks/useProjectPlayback";
import { useProjectModals } from "../../../hooks/useProjectModals";
import {
  useProjectUI,
  COLLAPSED_DECK_HEIGHT,
  MIN_WORKSPACE_SCALE,
  MAX_WORKSPACE_SCALE,
  WORKSPACE_SCALE_STEP,
} from "../../../hooks/useProjectUI";
import { useProjectBackingTrack } from "../../../hooks/useProjectBackingTrack";
import { useProjectMidiEditor } from "../../../hooks/useProjectMidiEditor";
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

  // Initialize modals hook (early, no dependencies)
  const modalsHook = useProjectModals();

  // Initialize UI hook (early, no dependencies)
  const uiHook = useProjectUI();

  // Phase 4: Collaborator presence state
  const [collaborators, setCollaborators] = useState([]);
  const [activeEditors, setActiveEditors] = useState(new Map()); // Track who is editing what: { itemId: { userId, userName, avatarUrl } }
  const [isConnected, setIsConnected] = useState(false);

  // Band settings state (kept local as it's used by BandConsole)
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

  // Create refs for circular dependencies
  const pushHistoryRef = useRef(null);

  // Initialize hooks - must be called unconditionally before event handlers
  // Settings hook (needed first for bpm, key, time signature)
  // Note: project will be set later by project data hook
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState("viewer");
  const [isDeleting, setIsDeleting] = useState(false);
  const refreshProjectRef = useRef(null);

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

  // Compute orderedTracks separately (needed by both hooks)
  const orderedTracksComputed = useMemo(
    () => [...tracks].sort((a, b) => (a.trackOrder ?? 0) - (b.trackOrder ?? 0)),
    [tracks]
  );

  // Initialize tracks hook (needs to be before computed for trackContextMenu)
  const tracksHook = useProjectTracks({
    projectId,
    tracks,
    setTracks: timelineHook?.setTracks,
    pushHistory,
    broadcast,
    refreshProject: () => refreshProjectRef.current?.(),
    setBackingTrack: chordsHook?.setBackingTrack,
    setFocusedClipId: timelineHook?.setFocusedClipId,
    focusedClipId: timelineHook?.focusedClipId,
    orderedTracks: orderedTracksComputed,
  });

  // Initialize computed values hook (needs trackContextMenu from tracks hook)
  const computedValues = useProjectComputed({
    project,
    tracks,
    chordProgression: chordsHook?.chordProgression || [],
    projectId,
    availableLicks: licksHook?.availableLicks || [],
    selectedInstrumentId,
    selectedTrackId,
    selectedRhythmPatternId,
    rhythmPatterns,
    trackContextMenu: tracksHook?.trackContextMenu,
    secondsPerBeat,
    playbackPosition,
  });

  const {
    resolvedBackingInstrumentId,
    instrumentHighlightId,
    normalizedTimeSignature,
    beatsPerMeasure,
    chordDurationSeconds,
    projectSwingAmount,
    getRhythmPatternVisual,
    orderedTracks,
    userTracks,
    hasAnyUserClips,
    menuTrack,
    menuPosition,
    formattedPlayTime,
    studioSeed,
  } = computedValues;

  const {
    trackContextMenu,
    addTrackModalOpen,
    newTrackName,
    addTrackError,
    addTrackSuccess,
    setAddTrackModalOpen,
    setNewTrackName,
    setAddTrackError,
    setAddTrackSuccess,
    openTrackMenu,
    closeTrackMenu,
    handleAddTrack,
    handleConfirmAddTrack,
    handleUpdateTrack,
    handleTrackRename,
    handleTrackColorChange,
    handleTrackMove,
    handleTrackDelete,
  } = tracksHook || {};

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

  // Extract UI values from hook
  const {
    sidePanelOpen,
    sidePanelWidth,
    workspaceScale,
    setSidePanelOpen,
    setSidePanelWidth,
    setWorkspaceScale,
    startPerformanceDeckResize,
    adjustWorkspaceScale,
  } = uiHook || {};

  // Extract modal values from hook
  const {
    inviteModalOpen,
    setInviteModalOpen,
    midiEditorOpen,
    setMidiEditorOpen,
    editingTimelineItem,
    setEditingTimelineItem,
    isGeneratingAI,
    setIsGeneratingAI,
    aiNotification,
    setAiNotification,
  } = modalsHook || {};

  // Initialize collaboration events hook
  useProjectCollaborationEvents({
    project,
    setProject,
    collaborators,
    setCollaborators,
    setActiveEditors,
    setIsConnected,
    setTracks: timelineHook?.setTracks,
    setChordProgression: chordsHook?.setChordProgression,
    saveChordProgression: chordsHook?.saveChordProgression,
    setTempoDraft: settingsHook?.setTempoDraft,
    setSwingDraft: settingsHook?.setSwingDraft,
    refreshProjectRef,
    currentUserId,
    currentUserProfile,
    userRole,
    isRemoteUpdateRef,
  });

  // Audio engine (still needed for some operations)
  const audioEngine = useAudioEngine();
  const { schedulePlayback, stopPlayback, loadClipAudio } = useAudioScheduler();

  // Old collaboration events code removed - now in useProjectCollaborationEvents hook (called above)

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

  // playbackPositionRef is now in playbackHook

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

  // Initialize playback hook
  const playbackHook = useProjectPlayback({
    bpm,
    tracks,
    isPlaying,
    setIsPlaying,
    playbackPosition,
    setPlaybackPosition,
    loopEnabled,
    pixelsPerSecond,
    calculateTimelineWidth,
    playheadRef,
    TRACK_COLUMN_WIDTH,
    user,
  });

  const {
    handlePlay,
    handlePause,
    handleStop,
    handleReturnToStart,
    scheduleAudioPlayback,
    getAudioUrlForItem,
    playbackPositionRef,
  } = playbackHook || {};

  // Initialize backing track hook
  const backingTrackHook = useProjectBackingTrack({
    projectId,
    project,
    backingTrack: chordsHook?.backingTrack,
    setBackingTrack: chordsHook?.setBackingTrack,
    tracks,
    setTracks: timelineHook?.setTracks,
    setSelectedInstrumentId,
    broadcast,
    refreshProject: () => refreshProjectRef.current?.(),
    setError,
    chordLibrary: chordsHook?.chordLibrary || [],
    selectedRhythmPatternId,
    setIsGeneratingAI: modalsHook?.setIsGeneratingAI,
    setAiNotification: modalsHook?.setAiNotification,
    fetchProject,
  });

  const {
    isGeneratingBackingTrack,
    ensureBackingTrack,
    applyBackingInstrumentSelection,
    handleSelectInstrument,
    handleAddChordToTimeline,
    handleGenerateBackingTrack,
    handleGenerateAIBackingTrack,
  } = backingTrackHook || {};

  // Initialize MIDI editor hook
  const midiEditorHook = useProjectMidiEditor({
    projectId,
    tracks,
    setTracks: timelineHook?.setTracks,
    broadcast,
    broadcastEditingActivity,
    refreshProject: () => refreshProjectRef.current?.(),
    midiEditorOpen: modalsHook?.midiEditorOpen,
    setMidiEditorOpen: modalsHook?.setMidiEditorOpen,
    editingTimelineItem: modalsHook?.editingTimelineItem,
    setEditingTimelineItem: modalsHook?.setEditingTimelineItem,
  });

  const { handleOpenMidiEditor, handleCloseMidiEditor, handleSaveMidiEdit } =
    midiEditorHook || {};

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
  // studioSeed is now in computedValues hook

  // reorderChordProgression is now in useProjectChords hook

  // fetchInstruments and fetchRhythmPatterns are now in useProjectSettings hook

  // Backing track and MIDI editor handlers are now in hooks (extracted above)

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

  // Playback control logic is now in playbackHook (extracted above)

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

  // Backing track handlers are now in backingTrackHook (extracted above)

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

  // Track handlers are now in tracksHook (extracted above)

  // handleClipMouseDown, startClipResize, and drag/resize useEffects are now in useProjectTimeline hook

  // handleClipMove is now in useProjectTimeline hook

  // getChordDuration, getChordWidth, and getChordStartPosition are now in useProjectChords hook

  // Transport / playback handlers are now in playbackHook (extracted above)

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
                      console.log(
                        "(NO $) [DEBUG][ProjectExport] ShareToFeed:",
                        {
                          projectId,
                          hasAudioUrl: !!project.audioUrl,
                        }
                      );

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
