import { useState, useEffect, useMemo, useCallback } from "react";
import { getChords } from "../services/chordService";
import { updateChordProgression as updateChordProgressionAPI } from "../services/user/projectService";
import {
  normalizeChordEntry,
  normalizeChordLibraryItem,
  cloneChordEntry,
  getDiatonicChords,
  isChordInKey,
  DEFAULT_FALLBACK_CHORDS,
} from "../utils/projectHelpers";

/**
 * Hook for managing chord progression and chord library
 * @param {string} projectId - Project ID
 * @param {string} projectKeyName - Current project key name
 * @param {Function} broadcast - Collaboration broadcast function
 * @param {Function} pushHistory - History push function
 * @param {Function} refreshProject - Function to refresh project data
 */
export const useProjectChords = ({
  projectId,
  projectKeyName,
  broadcast,
  pushHistory,
  refreshProject,
}) => {
  // Chord progression state
  const [chordProgression, setChordProgression] = useState([]);
  const [backingTrack, setBackingTrack] = useState(null);
  const [selectedChordIndex, setSelectedChordIndex] = useState(null);

  // Chord library state
  const [chordLibrary, setChordLibrary] = useState([]);
  const [loadingChords, setLoadingChords] = useState(false);
  const [chordLibraryError, setChordLibraryError] = useState(null);
  const [showComplexChords, setShowComplexChords] = useState(false);
  const [chordLibraryTotal, setChordLibraryTotal] = useState(0);
  const [selectedKeyFilter, setSelectedKeyFilter] = useState(null);

  // Fetch chord library
  useEffect(() => {
    const fetchChordLibrary = async () => {
      try {
        setLoadingChords(true);
        // Load ALL chords from database (we'll filter to 7 diatonic basic on frontend)
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
  const loadComplexChords = useCallback(() => {
    if (showComplexChords) return;
    setShowComplexChords(true);
  }, [showComplexChords]);

  // Save chord progression
  const saveChordProgression = useCallback(
    async (chords, isRemote = false) => {
      try {
        if (pushHistory) pushHistory();
        const normalized = (chords || [])
          .map((entry) => normalizeChordEntry(entry))
          .filter((entry) => entry && entry.chordName);

        // Optimistic update - update chord progression in local state immediately
        setChordProgression(normalized);
        await updateChordProgressionAPI(projectId, normalized);

        // Broadcast to collaborators (if not a remote update)
        if (!isRemote && broadcast) {
          broadcast("CHORD_PROGRESSION_UPDATE", { chords: normalized });
        }

        // Silent refresh in background
        if (refreshProject) refreshProject();
      } catch (err) {
        console.error("Error updating chord progression:", err);
        // Revert on error by refreshing
        if (refreshProject) refreshProject();
      }
    },
    [projectId, broadcast, pushHistory, refreshProject]
  );

  // Reorder chord progression
  const reorderChordProgression = useCallback(
    (fromIndex, toIndex) => {
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
    },
    [chordProgression, saveChordProgression]
  );

  // Add chord to progression
  const handleAddChord = useCallback(
    async (chord, ensureBackingTrack) => {
      if (ensureBackingTrack) await ensureBackingTrack();
      const entry = cloneChordEntry(chord);
      if (!entry) return;
      const updated = [...chordProgression, entry];
      saveChordProgression(updated);
    },
    [chordProgression, saveChordProgression]
  );

  // Handle chord selection (add or update)
  const handleChordSelect = useCallback(
    async (chord, ensureBackingTrack) => {
      if (selectedChordIndex === null) {
        // Add new chord if none selected
        if (ensureBackingTrack) await ensureBackingTrack();
        const entry = cloneChordEntry(chord);
        if (!entry) return;
        const updated = [...chordProgression, entry];
        saveChordProgression(updated);
        setSelectedChordIndex(updated.length - 1);
      } else {
        // Update existing chord
        if (ensureBackingTrack) await ensureBackingTrack();
        const entry = cloneChordEntry(chord);
        if (entry) {
          const updated = [...chordProgression];
          updated[selectedChordIndex] = entry;
          saveChordProgression(updated);
          // Auto-advance to next chord
          if (selectedChordIndex < updated.length - 1) {
            setSelectedChordIndex(selectedChordIndex + 1);
          } else {
            setSelectedChordIndex(null);
          }
        }
      }
    },
    [selectedChordIndex, chordProgression, saveChordProgression]
  );

  // Add chord from deck
  const handleAddChordFromDeck = useCallback(
    async (ensureBackingTrack) => {
      if (ensureBackingTrack) await ensureBackingTrack();
      const entry = cloneChordEntry("C");
      if (!entry) return;
      const updated = [...chordProgression, entry];
      saveChordProgression(updated);
      setSelectedChordIndex(updated.length - 1);
    },
    [chordProgression, saveChordProgression]
  );

  // Remove chord from progression
  const handleRemoveChord = useCallback(
    (itemIdOrIndex) => {
      const { getChordIndexFromId } = require("../utils/timelineHelpers");
      const index =
        typeof itemIdOrIndex === "number"
          ? itemIdOrIndex
          : getChordIndexFromId(itemIdOrIndex);
      if (index === null || index < 0 || index >= chordProgression.length)
        return;
      const updated = chordProgression.filter((_, i) => i !== index);
      saveChordProgression(updated);
    },
    [chordProgression, saveChordProgression]
  );

  // Compute chord palette (filtered and sorted chords)
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

  return {
    // State
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
    chordLibraryTotal,
    selectedKeyFilter,
    setSelectedKeyFilter,

    // Computed
    chordPalette,

    // Operations
    saveChordProgression,
    reorderChordProgression,
    handleAddChord,
    handleChordSelect,
    handleAddChordFromDeck,
    handleRemoveChord,
    loadComplexChords,
  };
};
