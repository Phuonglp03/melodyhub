import { useState, useRef, useCallback, useMemo } from "react";
import {
  updateTimelineItem,
  bulkUpdateTimelineItems,
  deleteTimelineItem,
  addLickToTimeline,
} from "../services/user/projectService";
import { normalizeTimelineItem, MIN_CLIP_DURATION } from "../utils/timelineHelpers";
import { getChordIndexFromId } from "../utils/timelineHelpers";

/**
 * Hook for managing timeline state and operations
 * @param {string} projectId - Project ID
 * @param {number} bpm - Beats per minute
 * @param {number} zoomLevel - Timeline zoom level
 * @param {Function} broadcast - Collaboration broadcast function
 * @param {Function} pushHistory - History push function
 * @param {Array} chordItems - Chord items for magnet snapping
 * @param {Function} setError - Error setter
 */
export const useProjectTimeline = ({
  projectId,
  bpm = 120,
  zoomLevel = 1,
  broadcast,
  pushHistory,
  chordItems = [],
  setError,
}) => {
  // Timeline state
  const [tracks, setTracks] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDraggingItem, setIsDraggingItem] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, trackId: null });
  const [resizeState, setResizeState] = useState(null);
  const [focusedClipId, setFocusedClipId] = useState(null);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [isSavingTimeline, setIsSavingTimeline] = useState(false);

  // Refs
  const timelineRef = useRef(null);
  const playheadRef = useRef(null);
  const clipRefs = useRef(new Map());
  const dragStateRef = useRef(null);
  const dirtyTimelineItemsRef = useRef(new Set());
  const saveTimeoutRef = useRef(null);
  const autosaveTimeoutRef = useRef(null);

  // Constants
  const basePixelsPerSecond = 50;
  const TRACK_COLUMN_WIDTH = 256;

  // Calculations
  const secondsPerBeat = useMemo(() => 60 / bpm, [bpm]);
  const pixelsPerSecond = useMemo(
    () => basePixelsPerSecond * zoomLevel,
    [zoomLevel]
  );
  const pixelsPerBeat = useMemo(
    () => pixelsPerSecond * secondsPerBeat,
    [pixelsPerSecond, secondsPerBeat]
  );

  // Calculate timeline width based on content
  const calculateTimelineWidth = useCallback(() => {
    let maxTime = 32; // Default 32 seconds
    tracks.forEach((track) => {
      track.items?.forEach((item) => {
        const endTime = item.startTime + item.duration;
        if (endTime > maxTime) maxTime = endTime;
      });
    });
    // Add some padding
    return Math.max(maxTime * pixelsPerSecond + 200, 1000);
  }, [tracks, pixelsPerSecond]);

  // Collect timeline item snapshot for saving
  const collectTimelineItemSnapshot = useCallback(
    (itemId) => {
      if (!itemId) return null;
      for (const track of tracks) {
        const found = (track.items || []).find((item) => item._id === itemId);
        if (found) {
          const normalized = normalizeTimelineItem(found);
          const snapshot = {
            _id: normalized._id,
            startTime: normalized.startTime,
            duration: normalized.duration,
            offset: normalized.offset,
            loopEnabled: normalized.loopEnabled,
            playbackRate: normalized.playbackRate,
            sourceDuration: normalized.sourceDuration,
          };

          // Include chord-related fields for chord timeline items
          if (normalized.type === "chord") {
            if (normalized.chordName !== undefined) {
              snapshot.chordName = normalized.chordName;
            }
            if (normalized.rhythmPatternId !== undefined) {
              snapshot.rhythmPatternId = normalized.rhythmPatternId;
            }
            if (normalized.isCustomized !== undefined) {
              snapshot.isCustomized = normalized.isCustomized;
            }
            if (normalized.customMidiEvents !== undefined) {
              snapshot.customMidiEvents = normalized.customMidiEvents;
            }
          }

          return snapshot;
        }
      }
      return null;
    },
    [tracks]
  );

  // Mark timeline item as dirty (needs saving)
  const markTimelineItemDirty = useCallback((itemId) => {
    dirtyTimelineItemsRef.current.add(itemId);
  }, []);

  // Flush timeline saves to server
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

      // Broadcast to collaborators
      if (broadcast) {
        broadcast("TIMELINE_ITEMS_BULK_UPDATE", { items: payload });
      }
    } catch (error) {
      console.error("Timeline items bulk save failed:", error);
      ids.forEach((id) => dirtyTimelineItemsRef.current.add(id));
    } finally {
      setIsSavingTimeline(false);
    }
  }, [projectId, collectTimelineItemSnapshot, broadcast]);

  // Schedule autosave
  const scheduleTimelineAutosave = useCallback(() => {
    clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(() => {
      flushTimelineSaves();
    }, 2000);
  }, [flushTimelineSaves]);

  // Snap time to grid and clip edges
  const applyMagnet = useCallback(
    (time, track, itemId) => {
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
    },
    [secondsPerBeat, chordItems]
  );

  // Handle clip overlap: Trim overlapping clips
  const handleClipOverlap = useCallback(
    (track, movedItemId, newStartTime, movedDuration) => {
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
    },
    []
  );

  // Handle dropping a lick onto the timeline
  const handleDrop = useCallback(
    async (e, trackId, startTime, draggedLick, setDraggedLick) => {
      e.preventDefault();

      if (!draggedLick) return;

      // Get lick ID - handle different field names
      const lickId = draggedLick._id || draggedLick.lick_id || draggedLick.id;
      if (!lickId) {
        if (setError) setError("Invalid lick: missing ID");
        if (setDraggedLick) setDraggedLick(null);
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
        if (setError) setError("Invalid time values");
        if (setDraggedLick) setDraggedLick(null);
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
          const rawItem = response.data;
          const uniqueId =
            rawItem._id || rawItem.id || `temp-${Date.now()}-${Math.random()}`;

          const newItem = normalizeTimelineItem({
            ...rawItem,
            _id: uniqueId,
          });

          if (pushHistory) pushHistory();
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
          if (setError) setError(null);

          // Broadcast to collaborators
          if (broadcast) {
            broadcast("LICK_ADD_TO_TIMELINE", {
              trackId: trackId.toString(),
              item: newItem,
            });
          }
        } else {
          if (setError) setError(response.message || "Failed to add lick to timeline");
        }
      } catch (err) {
        console.error("Error adding lick to timeline:", err);
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
        if (setError) setError(errorMessage);
      } finally {
        if (setDraggedLick) setDraggedLick(null);
      }
    },
    [projectId, broadcast, pushHistory, setError]
  );

  // Handle deleting a timeline item
  const handleDeleteTimelineItem = useCallback(
    async (itemId, { skipConfirm = false, refreshProject } = {}) => {
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
        if (pushHistory) pushHistory();
        setTracks((prevTracks) =>
          prevTracks.map((track) => ({
            ...track,
            items: (track.items || []).filter((item) => item._id !== itemId),
          }))
        );

        await deleteTimelineItem(projectId, itemId);

        // Broadcast to collaborators
        if (broadcast) {
          broadcast("TIMELINE_ITEM_DELETE", { itemId });
        }

        // Silent refresh in background to ensure sync
        if (refreshProject) refreshProject();
      } catch (err) {
        console.error("Error deleting timeline item:", err);
        if (setError) setError(err.message || "Failed to delete timeline item");
        // Revert on error by refreshing
        if (refreshProject) refreshProject();
      }
    },
    [projectId, broadcast, pushHistory, setError]
  );

  // Handle moving a clip
  const handleClipMove = useCallback(
    async (itemId, newStartTime, options = {}) => {
      if (newStartTime < 0) return;

      // Only push history if not skipped (e.g., when called from drag handler)
      if (!options.skipHistory && pushHistory) {
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

      // Broadcast position update in real-time
      if (broadcast) {
        broadcast("TIMELINE_ITEM_POSITION_UPDATE", {
          itemId,
          updates: { startTime: newStartTime },
        });
      }

      // mark dirty & schedule autosave
      markTimelineItemDirty(itemId);
      scheduleTimelineAutosave();
    },
    [broadcast, pushHistory, markTimelineItemDirty, scheduleTimelineAutosave]
  );

  // Handle resizing a clip
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

      if (!Object.keys(sanitized).length) return;

      if (pushHistory) pushHistory();

      // Update state optimistically
      setTracks((prevTracks) =>
        prevTracks.map((track) => {
          const hasClip = (track.items || []).some((item) => item._id === itemId);
          if (!hasClip) return track;
          return {
            ...track,
            items: (track.items || []).map((item) =>
              item._id === itemId
                ? normalizeTimelineItem({ ...item, ...sanitized })
                : item
            ),
          };
        })
      );

      // Broadcast update
      if (broadcast) {
        broadcast("TIMELINE_ITEM_POSITION_UPDATE", {
          itemId,
          updates: sanitized,
        });
      }

      // Mark dirty and schedule autosave
      markTimelineItemDirty(itemId);
      scheduleTimelineAutosave();
    },
    [broadcast, pushHistory, markTimelineItemDirty, scheduleTimelineAutosave]
  );

  // Check if there are unsaved changes
  const hasUnsavedTimelineChanges = dirtyTimelineItemsRef.current.size > 0;

  return {
    // State
    tracks,
    setTracks,
    selectedItem,
    setSelectedItem,
    isDraggingItem,
    setIsDraggingItem,
    dragOffset,
    setDragOffset,
    resizeState,
    setResizeState,
    focusedClipId,
    setFocusedClipId,
    selectedTrackId,
    setSelectedTrackId,
    isSavingTimeline,
    hasUnsavedTimelineChanges,

    // Refs
    timelineRef,
    playheadRef,
    clipRefs,
    dragStateRef,

    // Calculations
    secondsPerBeat,
    pixelsPerSecond,
    pixelsPerBeat,
    calculateTimelineWidth,
    TRACK_COLUMN_WIDTH,

    // Operations
    handleDrop,
    handleClipResize,
    handleClipMove,
    handleDeleteTimelineItem,
    handleClipOverlap,
    applyMagnet,

    // Autosave
    markTimelineItemDirty,
    scheduleTimelineAutosave,
    flushTimelineSaves,
  };
};

