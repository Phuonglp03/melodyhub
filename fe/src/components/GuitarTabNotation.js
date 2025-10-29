import React, { useState, useEffect } from "react";
import { FaPlay, FaPause, FaPlus, FaMinus, FaEdit } from "react-icons/fa";

const GuitarTabNotation = ({
  tabData = "",
  isEditable = false,
  onChange,
  tempo = 120,
  audioRef = null, // Audio element reference for syncing
  audioDuration = 0, // Audio duration in seconds
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);

  // Parse tab string into structured format
  const parseTab = (tabString) => {
    if (!tabString || tabString.trim() === "") {
      return getDefaultTab();
    }

    const lines = tabString.split("\n").filter((line) => line.trim());
    const strings = [];

    for (let line of lines) {
      if (line.includes("|")) {
        strings.push(line);
      }
    }

    return strings.length > 0 ? strings : getDefaultTab();
  };

  const getDefaultTab = () => {
    return [
      "e|--------------------------------|",
      "B|--------------------------------|",
      "G|--------------------------------|",
      "D|--------------------------------|",
      "A|--------------------------------|",
      "E|--------------------------------|",
    ];
  };

  const tabLines = parseTab(tabData);

  // Calculate actual tab length from parsed tab
  const calculateTabLength = () => {
    if (tabLines.length === 0) return 32;
    const firstLine = tabLines[0];
    const parts = firstLine.split("|");
    const notes = parts.slice(1, -1).join(""); // Remove string label and last pipe
    return notes.length;
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
  }, [audioRef, audioDuration, tabLines]);

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

  // Toggle playback - control actual audio
  const handlePlayPause = () => {
    if (audioRef && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch((err) => {
          console.error("Playback error:", err);
        });
      }
    } else {
      // Fallback to mock playback if no audio
      setIsPlaying(!isPlaying);
      if (!isPlaying) {
        let pos = 0;
        const tabLength = calculateTabLength();
        const interval = setInterval(() => {
          pos += 1;
          setCurrentPosition(pos);
          if (pos >= tabLength) {
            clearInterval(interval);
            setIsPlaying(false);
            setCurrentPosition(0);
          }
        }, 60000 / tempo / 4);
      }
    }
  };

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
            className="p-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-colors ml-2"
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

      {/* Time Display and Progress Bar (if audio is connected) */}
      {audioRef && audioDuration > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(audioDuration)}</span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-red-600 transition-all duration-100"
              style={{
                width: `${(currentTime / audioDuration) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Tab Display */}
      <div className="bg-gray-950 rounded-lg p-4 overflow-x-auto">
        <div
          className="font-mono text-sm leading-relaxed whitespace-pre"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            transition: "transform 0.2s ease",
          }}
        >
          {tabLines.map((line, index) => {
            // Extract string label and notes
            const parts = line.split("|");
            const stringLabel = parts[0];
            const notes = parts.slice(1).join("|");

            return (
              <div key={index} className="flex items-center mb-1">
                {/* String Label */}
                <span className="text-orange-400 font-bold mr-2 min-w-[20px]">
                  {stringLabel}
                </span>

                {/* Tab Line with Notes */}
                <div className="flex-1 flex items-center relative">
                  <span className="text-gray-500">|</span>
                  <span className="text-gray-400 tracking-wider relative">
                    {notes.split("").map((char, charIndex) => {
                      const isCurrentPosition =
                        isPlaying && charIndex === currentPosition;
                      return (
                        <span
                          key={charIndex}
                          className={`inline-block ${
                            isCurrentPosition ? "bg-orange-600 text-white" : ""
                          } ${
                            char >= "0" && char <= "9"
                              ? "text-white font-semibold"
                              : "text-gray-600"
                          }`}
                          style={{
                            minWidth: "12px",
                            textAlign: "center",
                          }}
                        >
                          {char}
                        </span>
                      );
                    })}
                  </span>
                </div>
              </div>
            );
          })}
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
