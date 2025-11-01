import React, { useState, useEffect, useRef } from "react";
import {
  FaPlay,
  FaPause,
  FaPlus,
  FaMinus,
  FaEdit,
  FaMusic,
  FaVolumeUp,
} from "react-icons/fa";
import GuitarSynthesizer from "../services/guitarSynthesizer";

const GuitarTabNotation = ({
  tabData = "",
  isEditable = false,
  onChange,
  tempo = 120,
  audioRef = null, // Audio element reference for syncing
  audioDuration = 0, // Audio duration in seconds
  timeSignatureTop = 4,
  timeSignatureBottom = 4,
  showTimingRuler = true,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackMode, setPlaybackMode] = useState(
    audioRef ? "audio" : "instrument"
  ); // 'audio' or 'instrument'

  const playbackIntervalRef = useRef(null);
  const synthesizerRef = useRef(null);

  // Parse tab string into structured format by measures
  const parseTab = (tabString) => {
    if (!tabString || tabString.trim() === "") {
      return [getDefaultMeasure()];
    }

    const lines = tabString.split("\n").filter((line) => line.trim());
    const measures = [];
    let currentMeasure = [];

    for (let line of lines) {
      if (line.includes("|")) {
        currentMeasure.push(line);

        // A complete measure has 6 strings (e, B, G, D, A, E)
        if (currentMeasure.length === 6) {
          measures.push([...currentMeasure]);
          currentMeasure = [];
        }
      }
    }

    // Add any remaining incomplete measure
    if (currentMeasure.length > 0) {
      measures.push(currentMeasure);
    }

    return measures.length > 0 ? measures : [getDefaultMeasure()];
  };

  const getDefaultMeasure = () => {
    return [
      "e|--------------------------------|",
      "B|--------------------------------|",
      "G|--------------------------------|",
      "D|--------------------------------|",
      "A|--------------------------------|",
      "E|--------------------------------|",
    ];
  };

  const measures = parseTab(tabData);

  // Initialize synthesizer
  useEffect(() => {
    synthesizerRef.current = new GuitarSynthesizer();
    return () => {
      if (synthesizerRef.current) {
        synthesizerRef.current.destroy();
      }
    };
  }, []);

  // Calculate actual tab length from parsed tab
  const calculateTabLength = () => {
    if (measures.length === 0 || measures[0].length === 0) return 32;
    const firstLine = measures[0][0];
    const parts = firstLine.split("|");
    const notes = parts.slice(1, -1).join(""); // Remove string label and last pipe
    // Total length = measure length * number of measures
    return notes.length * measures.length;
  };

  // (Removed timing ruler to match clean pro UI)

  // (Removed bottom ruler to match clean pro UI)

  // Parse notes from tab for playback (consumes multi-digit frets correctly)
  const parseNotesFromTab = () => {
    const notes = [];
    const stringNames = ["e", "B", "G", "D", "A", "E"];

    const tabLength = calculateTabLength();
    const totalDuration = audioDuration || (tabLength * 60) / tempo / 4;

    measures.forEach((measure, measureIndex) => {
      if (measure.length < 6) return;

      const measureLength = measure[0].split("|").slice(1, -1).join("").length;
      const measureStartPos = measureIndex * measureLength;

      // Check each string
      measure.forEach((line, stringIndex) => {
        const parts = line.split("|");
        const noteContent = parts.slice(1, -1).join("");

        let pos = 0;
        while (pos < noteContent.length) {
          const char = noteContent[pos];

          if (char && char >= "0" && char <= "9") {
            let fret = parseInt(char);
            let fretWidth = 1;

            // Handle 2-digit frets
            if (pos + 1 < noteContent.length) {
              const nextChar = noteContent[pos + 1];
              if (nextChar >= "0" && nextChar <= "9") {
                fret = parseInt(char + nextChar);
                fretWidth = 2;
              }
            }

            const globalPos = measureStartPos + pos;

            notes.push({
              string: stringNames[stringIndex],
              fret: fret,
              position: globalPos,
              time: (globalPos / tabLength) * totalDuration,
            });

            pos += fretWidth; // consume whole note
          } else {
            pos += 1;
          }
        }
      });
    });

    return notes.sort((a, b) => a.time - b.time);
  };

  // Sync with audio playback
  useEffect(() => {
    if (!audioRef || !audioRef.current) return;

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // Calculate position in tab based on audio time
      if (audioDuration > 0) {
        // Calculate actual tab length from parsed tab
        const tabLength = calculateTabLength();
        const position = Math.floor(
          (audio.currentTime / audioDuration) * tabLength
        );
        setCurrentPosition(position);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentPosition(0);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioRef, audioDuration, measures]);

  // Handle zoom
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.1, 0.5));
  };

  // Format time in MM:SS format
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Stop playback
  const stopPlayback = () => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    if (synthesizerRef.current) {
      synthesizerRef.current.stopAll();
    }
    setIsPlaying(false);
    setCurrentPosition(0);
    setCurrentTime(0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  // Toggle playback - with mode selection
  const handlePlayPause = () => {
    if (isPlaying) {
      // Stop playback
      if (playbackMode === "audio" && audioRef && audioRef.current) {
        audioRef.current.pause();
      } else {
        stopPlayback();
      }
      return;
    }

    // Start playback
    if (playbackMode === "audio" && audioRef && audioRef.current) {
      // Audio sync mode
      audioRef.current.play().catch((err) => {
        console.error("Playback error:", err);
      });
    } else {
      // Instrument simulation mode
      playWithInstrument();
    }
  };

  // Play tab with synthesized instrument sounds
  const playWithInstrument = () => {
    const notes = parseNotesFromTab();
    if (notes.length === 0) {
      console.warn("No notes found in tab");
      return;
    }

    setIsPlaying(true);
    setCurrentPosition(0);

    const tabLength = calculateTabLength();
    const msPerPosition = 60000 / tempo / 4; // Milliseconds per position
    const totalDuration = tabLength * msPerPosition;

    let startTime = Date.now();
    let lastPlayedIndex = -1;

    playbackIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / totalDuration;
      const position = Math.floor(progress * tabLength);

      setCurrentPosition(position);
      setCurrentTime(elapsed / 1000);

      // Play notes at this position
      notes.forEach((note, index) => {
        if (note.position === position && index > lastPlayedIndex) {
          if (synthesizerRef.current) {
            // Calculate note duration (distance to next note on same string)
            const nextNote = notes.find(
              (n, i) => i > index && n.string === note.string
            );
            const duration = nextNote
              ? ((nextNote.position - note.position) * msPerPosition) / 1000
              : 0.5;

            synthesizerRef.current.playNote(
              note.string,
              note.fret,
              Math.min(duration, 2)
            );
          }
          lastPlayedIndex = index;
        }
      });

      // Check if playback finished
      if (position >= tabLength) {
        stopPlayback();
      }
    }, msPerPosition / 4); // Update 4 times per position for smooth animation
  };

  // Split measures into systems (rows)
  const measuresPerRow = 4;
  const systems = [];
  for (let i = 0; i < measures.length; i += measuresPerRow) {
    systems.push(measures.slice(i, i + measuresPerRow));
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
      {/* Header Controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-white flex items-center">
            Guitar Tablature
          </h3>
          <span className="text-gray-400 text-sm">Tempo: {tempo} BPM</span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Playback Mode Toggle */}
          {audioRef && (
            <div className="flex bg-gray-800 rounded-md overflow-hidden">
              <button
                onClick={() => setPlaybackMode("audio")}
                className={`px-3 py-2 text-xs transition-colors ${
                  playbackMode === "audio"
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
                title="Sync with Audio"
              >
                <FaVolumeUp size={12} className="inline mr-1" />
                Audio
              </button>
              <button
                onClick={() => setPlaybackMode("instrument")}
                className={`px-3 py-2 text-xs transition-colors ${
                  playbackMode === "instrument"
                    ? "bg-orange-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
                title="Simulated Instrument"
              >
                <FaMusic size={12} className="inline mr-1" />
                Instrument
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          <button
            onClick={handleZoomOut}
            className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors"
            title="Zoom Out"
          >
            <FaMinus size={12} />
          </button>
          <span className="text-gray-400 text-sm min-w-[50px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors"
            title="Zoom In"
          >
            <FaPlus size={12} />
          </button>

          {/* Play Button */}
          <button
            onClick={handlePlayPause}
            className={`p-2 ${
              playbackMode === "instrument"
                ? "bg-orange-600 hover:bg-orange-700"
                : "bg-blue-600 hover:bg-blue-700"
            } text-white rounded-md transition-colors ml-2`}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <FaPause size={14} /> : <FaPlay size={14} />}
          </button>

          {isEditable && (
            <button
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              title="Edit Tab"
            >
              <FaEdit size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Playback Mode Info */}
      <div className="mb-4 bg-blue-900/20 border border-blue-800 rounded-lg p-3">
        <p className="text-blue-300 text-sm">
          <strong>Playback Mode:</strong>{" "}
          {playbackMode === "audio"
            ? "Synced with audio track"
            : "Simulated guitar instrument sounds"}
        </p>
      </div>

      {/* Time Display and Progress Bar */}
      {(audioRef && audioDuration > 0 && playbackMode === "audio") ||
      (playbackMode === "instrument" && isPlaying) ? (
        <div className="mb-4 space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>
              {playbackMode === "audio"
                ? formatTime(audioDuration)
                : formatTime((calculateTabLength() * 60) / tempo / 4)}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${
                playbackMode === "instrument"
                  ? "bg-gradient-to-r from-orange-500 to-red-600"
                  : "bg-gradient-to-r from-blue-500 to-purple-600"
              }`}
              style={{
                width:
                  playbackMode === "audio"
                    ? `${(currentTime / audioDuration) * 100}%`
                    : `${(currentPosition / calculateTabLength()) * 100}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Tab Display (TabSheet) */}
      <div className="bg-gray-950 rounded-lg p-4 overflow-x-auto">
        <div
          className="font-mono text-sm leading-relaxed flex flex-col gap-8"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            transition: "transform 0.2s ease",
          }}
        >
          {systems.map((systemMeasures, systemIdx) => (
            <div key={systemIdx} className="flex items-start gap-6">
              {/* String labels */}
              <div className="flex flex-col items-center mr-2 select-none">
                {["e", "B", "G", "D", "A", "E"].map((s) => (
                  <span
                    key={s}
                    className="text-orange-400 font-bold h-6 leading-6"
                  >
                    {s}
                  </span>
                ))}
              </div>
              {/* System (row of measures) */}
              <div className="flex flex-wrap gap-8 items-start flex-1">
                {systemMeasures.map((measure, relativeIdx) => {
                  const measureIndex = systemIdx * measuresPerRow + relativeIdx;
                  // Get measure length for position calculation
                  const measureLength = measure[0]
                    ? measure[0].split("|").slice(1, -1).join("").length
                    : 16;
                  const measureStartPos = measureIndex * measureLength;
                  const beats = Math.max(1, timeSignatureTop);
                  const positionsPerBeat = Math.max(
                    1,
                    Math.floor(measureLength / beats)
                  );
                  const slotWidthPx = 12; // base width per tab slot for scaling
                  const stringSpacingPx = 24; // distance between string lines
                  const measureWidthPx = measureLength * slotWidthPx;
                  const measureHeightPx = stringSpacingPx * 5 + 2; // 6 lines -> 5 gaps

                  return (
                    <div
                      key={measureIndex}
                      className="mb-6 inline-block relative"
                      style={{ width: `${measureWidthPx + 40}px` }}
                    >
                      {/* MeasureHeader */}
                      <div className="flex items-baseline justify-between mb-1">
                        <div className="text-xs text-gray-500">
                          {measureIndex + 1}
                        </div>
                        {/* Chord placeholder */}
                        <div className="text-sm text-white font-semibold opacity-60"></div>
                        <div className="text-xs text-gray-500"></div>
                      </div>
                      {/* Stage: solid string lines and bar lines */}
                      <div
                        className="relative"
                        style={{
                          height: `${measureHeightPx}px`,
                          width: `${measureWidthPx}px`,
                        }}
                      >
                        {/* Left and right bar lines */}
                        <div
                          className="absolute top-0 bottom-0 border-l border-gray-600"
                          style={{ left: 0 }}
                        />
                        <div
                          className="absolute top-0 bottom-0 border-r border-gray-600"
                          style={{ right: 0 }}
                        />

                        {/* Six string lines */}
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className="absolute left-0 right-0 bg-gray-600"
                            style={{
                              height: "1px",
                              top: `${i * stringSpacingPx}px`,
                            }}
                          />
                        ))}

                        {/* NoteLayer: absolute notes + stems and beams */}
                        <div className="absolute inset-0">
                          {(() => {
                            const stringOrder = ["e", "B", "G", "D", "A", "E"];
                            const notesAll = parseNotesFromTab().filter(
                              (n) =>
                                n.position >= measureStartPos &&
                                n.position < measureStartPos + measureLength
                            );

                            // Group notes at the same slot position
                            const groupsMap = new Map();
                            for (const n of notesAll) {
                              const key = n.position;
                              if (!groupsMap.has(key)) groupsMap.set(key, []);
                              groupsMap.get(key).push(n);
                            }

                            const beats = Math.max(1, timeSignatureTop);
                            const positionsPerBeat = Math.max(
                              1,
                              Math.floor(measureLength / beats)
                            );
                            const sortedPositions = Array.from(
                              groupsMap.keys()
                            ).sort((a, b) => a - b);

                            const beatGroups = sortedPositions.map(
                              (pos, idx) => {
                                const nextPos =
                                  sortedPositions[idx + 1] ??
                                  pos + positionsPerBeat;
                                const delta = nextPos - pos;
                                const rhythm =
                                  delta < positionsPerBeat
                                    ? "eighth"
                                    : "quarter";
                                return {
                                  position: pos,
                                  rhythm,
                                  notes: groupsMap.get(pos),
                                };
                              }
                            );

                            const elements = [];
                            const beams = [];
                            let pending = [];

                            // Collision tracker per string
                            const stringLayoutTracker = {
                              e: 0,
                              B: 0,
                              G: 0,
                              D: 0,
                              A: 0,
                              E: 0,
                            };
                            const NOTE_PADDING = 8;
                            let currentBeatIndex = null;

                            for (const g of beatGroups) {
                              const idealX =
                                ((g.position - measureStartPos) /
                                  measureLength) *
                                measureWidthPx;
                              const beatIndex = Math.floor(
                                (g.position - measureStartPos) /
                                  positionsPerBeat
                              );

                              // Reset beams on new beat
                              if (currentBeatIndex === null)
                                currentBeatIndex = beatIndex;
                              if (beatIndex !== currentBeatIndex) {
                                if (pending.length > 1)
                                  beams.push([...pending]);
                                pending = [];
                                currentBeatIndex = beatIndex;
                              }

                              let lowestY = 0;
                              let minActualX = Infinity;

                              // Draw notes with collision avoidance per string
                              for (const n of g.notes) {
                                const sIdx = stringOrder.indexOf(n.string);
                                const yCenter =
                                  sIdx * stringSpacingPx + stringSpacingPx / 2;
                                const highlight =
                                  isPlaying &&
                                  Math.round(currentPosition) ===
                                    Math.round(n.position);

                                const fretText = String(n.fret ?? "");
                                let noteWidth = 12;
                                if (fretText.length === 2) noteWidth = 20;
                                else if (fretText.length >= 3) noteWidth = 40;

                                const lastX = stringLayoutTracker[n.string];
                                const actualX = Math.max(idealX, lastX);
                                stringLayoutTracker[n.string] =
                                  actualX + noteWidth + NOTE_PADDING;

                                elements.push(
                                  <div
                                    key={`n-${g.position}-${n.string}`}
                                    className="absolute font-mono text-sm"
                                    style={{
                                      top: `${yCenter}px`,
                                      left: `${actualX}px`,
                                      backgroundColor: "#121212",
                                      color: highlight ? "#22c55e" : "#ffffff",
                                      transform: "translateY(-50%)",
                                      padding: "1px 2px",
                                      lineHeight: 1,
                                    }}
                                  >
                                    {n.fret}
                                  </div>
                                );
                                lowestY = Math.max(lowestY, yCenter);
                                minActualX = Math.min(minActualX, actualX);
                              }

                              // Stem for this beat (align to earliest actual note)
                              const stemTop = lowestY + 10;
                              const stemX =
                                (minActualX === Infinity
                                  ? idealX
                                  : minActualX) + 6;
                              elements.push(
                                <div
                                  key={`s-${g.position}`}
                                  className="absolute bg-gray-400"
                                  style={{
                                    width: "1px",
                                    height: "25px",
                                    top: `${stemTop}px`,
                                    left: `${stemX}px`,
                                  }}
                                />
                              );

                              if (g.rhythm === "eighth") {
                                pending.push({ x: stemX, y: stemTop });
                              } else {
                                if (pending.length > 1)
                                  beams.push([...pending]);
                                pending = [];
                              }
                            }

                            if (pending.length > 1) beams.push([...pending]);

                            // Draw beams
                            for (const seg of beams) {
                              const first = seg[0];
                              const last = seg[seg.length - 1];
                              elements.push(
                                <div
                                  key={`b-${first.x}-${last.x}`}
                                  className="absolute bg-gray-400"
                                  style={{
                                    left: `${first.x}px`,
                                    top: `${Math.min(
                                      ...seg.map((s) => s.y)
                                    )}px`,
                                    width: `${last.x - first.x}px`,
                                    height: "2px",
                                  }}
                                />
                              );
                            }

                            return elements;
                          })()}
                        </div>
                      </div>

                      {/* PlaybackIndicator (green line) */}
                      {audioDuration > 0 && (
                        <div
                          className="pointer-events-none absolute top-0 bottom-10"
                          style={{
                            left:
                              currentPosition >= measureStartPos &&
                              currentPosition < measureStartPos + measureLength
                                ? `${
                                    ((currentPosition - measureStartPos) /
                                      measureLength) *
                                    measureWidthPx
                                  }px`
                                : "-9999px",
                          }}
                        >
                          <div className="h-full w-[3px] bg-green-500 shadow-[0_0_8px_2px_rgba(34,197,94,0.6)]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-gray-800">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-400">
            <div>
              <span className="text-white font-semibold">Numbers:</span> Fret
              positions
            </div>
            <div>
              <span className="text-white font-semibold">-:</span> Empty string
            </div>
            <div>
              <span className="text-white font-semibold">0:</span> Open string
            </div>
            <div>
              <span className="text-white font-semibold">|:</span> Measure bar
            </div>
          </div>

          {/* Additional Notation Guide */}
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-400">
            <div>
              <span className="text-white font-semibold">h:</span> Hammer-on
            </div>
            <div>
              <span className="text-white font-semibold">p:</span> Pull-off
            </div>
            <div>
              <span className="text-white font-semibold">b:</span> Bend
            </div>
            <div>
              <span className="text-white font-semibold">/\:</span> Slide
            </div>
          </div>
        </div>
      </div>

      {/* Quick Tips */}
      {isEditable && (
        <div className="mt-4 bg-blue-900/20 border border-blue-800 rounded-lg p-3">
          <p className="text-blue-300 text-sm">
            <strong>Tip:</strong> Use standard tab notation format. Each line
            represents a string (e-B-G-D-A-E from high to low), numbers indicate
            frets, and dashes fill empty space.
          </p>
        </div>
      )}
    </div>
  );
};

export default GuitarTabNotation;
