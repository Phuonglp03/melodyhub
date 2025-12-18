import { useCallback, useEffect, useRef } from "react";
import { useAudioEngine } from "./useAudioEngine";
import { useAudioScheduler } from "./useAudioScheduler";
import { playLickAudio } from "../services/user/lickService";

/**
 * Hook for managing project playback controls and audio scheduling
 * @param {Object} options - Configuration options
 * @param {number} options.bpm - Beats per minute
 * @param {Array} options.tracks - Tracks array
 * @param {boolean} options.isPlaying - Is playing state
 * @param {Function} options.setIsPlaying - Setter for is playing
 * @param {number} options.playbackPosition - Current playback position
 * @param {Function} options.setPlaybackPosition - Setter for playback position
 * @param {boolean} options.loopEnabled - Loop enabled state
 * @param {number} options.pixelsPerSecond - Pixels per second for timeline
 * @param {Function} options.calculateTimelineWidth - Function to calculate timeline width
 * @param {Object} options.playheadRef - Ref to playhead element
 * @param {number} options.TRACK_COLUMN_WIDTH - Track column width
 * @param {Object} options.user - User object
 * @returns {Object} Playback handlers and state
 */
export const useProjectPlayback = ({
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
}) => {
  const audioEngine = useAudioEngine();
  const { schedulePlayback } = useAudioScheduler();
  const playbackPositionRef = useRef(playbackPosition);
  const isSchedulingRef = useRef(false); // Flag to prevent auto-reschedule during initial play

  // Update playback position ref
  useEffect(() => {
    playbackPositionRef.current = playbackPosition;
  }, [playbackPosition]);

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

  // Playback control handlers
  const handlePlay = useCallback(async () => {
    await audioEngine.ensureStarted();
    if (!audioEngine.transport) {
      console.error("Tone.Transport is not available");
      return;
    }

    // #region agent log
    console.log("(NO $) [DEBUG][Playback] H1 beforeSetPosition:", {
      playbackPositionState: playbackPosition,
      playbackPositionRef: playbackPositionRef.current,
      transportSecondsBefore: audioEngine.getPosition?.() ?? null,
      transportStateBefore: audioEngine.transport?.state ?? null,
    });
    // #endregion agent log

    // Set BPM first
    audioEngine.setBpm(bpm);

    // Lock the playhead visually at current position BEFORE any async work
    // This prevents the visual jump during scheduling
    if (playheadRef.current) {
      playheadRef.current.style.left = `${TRACK_COLUMN_WIDTH + playbackPosition * pixelsPerSecond}px`;
    }

    // Mark that we're in the middle of scheduling (prevent auto-reschedule effect)
    isSchedulingRef.current = true;

    setIsPlaying(true);

    // Schedule audio clips FIRST (this may reset transport position)
    await scheduleAudioPlayback();

    // Set transport position AFTER scheduling, right before starting
    // This ensures the position isn't reset by unsyncAllPlayers() in schedulePlayback
    audioEngine.setPosition(playbackPosition);
    playbackPositionRef.current = playbackPosition;
    
    isSchedulingRef.current = false;

    // #region agent log
    console.log("(NO $) [DEBUG][Playback] H2 afterSetPosition:", {
      playbackPositionState: playbackPosition,
      playbackPositionRef: playbackPositionRef.current,
      transportSecondsAfterSet: audioEngine.getPosition?.() ?? null,
      transportStateAfterSet: audioEngine.transport?.state ?? null,
    });
    // #endregion agent log

    // Start transport
    audioEngine.startTransport();

    // #region agent log
    console.log("(NO $) [DEBUG][Playback] H3 afterStartTransport:", {
      playbackPositionState: playbackPosition,
      playbackPositionRef: playbackPositionRef.current,
      transportSecondsAfterStart: audioEngine.getPosition?.() ?? null,
      transportStateAfterStart: audioEngine.transport?.state ?? null,
    });
    // #endregion agent log
  }, [audioEngine, bpm, scheduleAudioPlayback, setIsPlaying, playbackPosition]);

  const handlePause = useCallback(() => {
    // Capture current position BEFORE stopping
    const currentPos = audioEngine.getPosition();
    
    // #region agent log
    console.log("(NO $) [DEBUG][Pause] handlePause called:", {
      currentPos,
      playbackPositionRef: playbackPositionRef.current,
    });
    // #endregion agent log
    
    setIsPlaying(false);
    audioEngine.pauseTransport();
    audioEngine.stopAllPlayers();
    
    // Ensure playhead stays at paused position (prevent visual jump)
    setPlaybackPosition(currentPos);
    playbackPositionRef.current = currentPos;
    if (playheadRef.current) {
      playheadRef.current.style.left = `${TRACK_COLUMN_WIDTH + currentPos * pixelsPerSecond}px`;
    }
  }, [audioEngine, setIsPlaying, setPlaybackPosition, playheadRef, TRACK_COLUMN_WIDTH, pixelsPerSecond]);

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

  // Playback position sync with audioEngine transport
  useEffect(() => {
    let animationFrame = null;
    let lastStateUpdate = 0;

    if (isPlaying) {
      const width = calculateTimelineWidth();
      const loopLenSeconds = Math.max(1, width / pixelsPerSecond);

      const animate = () => {
        // Sync position with audioEngine transport
        const transportPos = audioEngine.getPosition();
        let position = loopEnabled
          ? transportPos % loopLenSeconds
          : transportPos;

        // Prevent visual jumps backwards (e.g., brief reset to 0 when resuming)
        // by never letting the visual playhead go behind the last known ref position.
        if (
          typeof playbackPositionRef.current === "number" &&
          playbackPositionRef.current > 0 &&
          position < playbackPositionRef.current
        ) {
          position = playbackPositionRef.current;
        }

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
  }, [
    isPlaying,
    loopEnabled,
    pixelsPerSecond,
    tracks,
    calculateTimelineWidth,
    playheadRef,
    TRACK_COLUMN_WIDTH,
    audioEngine,
    setPlaybackPosition,
  ]);

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
  }, [bpm, audioEngine]);

  // Auto-reschedule audio when tracks change during playback
  useEffect(() => {
    // Skip if we're in the middle of initial scheduling (handlePlay)
    if (isSchedulingRef.current) return;
    
    if (isPlaying && audioEngine.players.size > 0) {
      const timeoutId = setTimeout(async () => {
        // Save current position before rescheduling
        const currentPos = audioEngine.getPosition();
        await scheduleAudioPlayback();
        // Restore position after rescheduling (unsyncAllPlayers may reset it)
        audioEngine.setPosition(currentPos);
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [tracks, isPlaying, scheduleAudioPlayback, audioEngine]);

  return {
    handlePlay,
    handlePause,
    handleStop,
    handleReturnToStart,
    scheduleAudioPlayback,
    getAudioUrlForItem,
    playbackPositionRef,
  };
};

