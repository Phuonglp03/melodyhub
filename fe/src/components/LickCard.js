import React, { useState, useRef } from "react";
import { FaHeart, FaPlay, FaPause } from "react-icons/fa";
import { playLickAudio } from "../services/user/lickService";

const LickCard = ({ lick, onClick }) => {
  const {
    lick_id,
    title,
    creator,
    created_at,
    likes_count,
    tags,
    waveform_data,
    duration,
    difficulty,
  } = lick;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0); // Track playback progress (0-1)
  const audioRef = useRef(null);

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Handle play/pause for waveform
  const handlePlayPause = async (e) => {
    e.stopPropagation();

    // If already playing, pause (keep progress)
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    try {
      setIsLoading(true);

      // Get audio URL from API
      const response = await playLickAudio(lick_id);
      console.log("Audio URL response:", response);

      if (response.success && response.data.audio_url) {
        // Create or update audio element
        if (!audioRef.current) {
          audioRef.current = new Audio();

          // Track playback progress
          audioRef.current.addEventListener("timeupdate", () => {
            const currentProgress =
              audioRef.current.currentTime / audioRef.current.duration;
            setProgress(currentProgress);
          });

          audioRef.current.addEventListener("ended", () => {
            setIsPlaying(false);
            setProgress(0); // Reset progress
          });

          audioRef.current.addEventListener("error", (error) => {
            console.error("Audio playback error:", error);
            alert("Failed to play audio. Check console for details.");
            setIsPlaying(false);
            setIsLoading(false);
            setProgress(0);
          });

          audioRef.current.addEventListener("loadeddata", () => {
            console.log("Audio loaded successfully");
          });
        }

        // Set the source and load
        audioRef.current.src = response.data.audio_url;
        audioRef.current.load();

        // Wait for the audio to be ready and then play
        await audioRef.current.play();
        setIsPlaying(true);
        console.log("Playing audio:", response.data.audio_url);
      } else {
        console.error("No audio URL in response:", response);
        alert("Audio URL not available");
      }
    } catch (error) {
      console.error("Error playing lick:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 hover:border-gray-700 transition-all duration-200 group">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3
            onClick={() => onClick(lick_id)}
            className="text-xl font-semibold text-white mb-1 hover:text-orange-400 transition-colors cursor-pointer"
          >
            {title}
          </h3>
          <p className="text-sm text-gray-400">
            by {creator?.display_name || "Unknown"} · {formatDate(created_at)}
          </p>
        </div>
        {difficulty && (
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              difficulty === "beginner"
                ? "bg-green-900 text-green-300"
                : difficulty === "intermediate"
                ? "bg-yellow-900 text-yellow-300"
                : "bg-red-900 text-red-300"
            }`}
          >
            {difficulty}
          </span>
        )}
      </div>

      <div className="flex items-center space-x-4 text-sm text-gray-400 mb-4">
        <span className="flex items-center hover:text-red-400 transition-colors">
          <FaHeart className="text-red-500 mr-1.5" /> {likes_count}
        </span>
        {duration && (
          <span className="flex items-center">
            <FaPlay className="text-gray-500 mr-1.5" size={12} />{" "}
            {duration.toFixed(1)}s
          </span>
        )}
      </div>

      {/* Waveform Visualization - Clickable */}
      <div
        className="relative h-28 bg-gradient-to-b from-orange-800 to-orange-900 rounded-lg overflow-hidden cursor-pointer hover:from-orange-700 hover:to-orange-800 transition-all group/waveform"
        onClick={handlePlayPause}
      >
        <span className="absolute top-2.5 left-2.5 bg-black/70 text-white text-xs px-2 py-1 rounded-md font-medium backdrop-blur-sm z-10">
          Lick
        </span>

        {/* Play/Pause Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/waveform:opacity-100 transition-opacity bg-black/20 z-10">
          {isLoading ? (
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          ) : (
            <button className="bg-black/60 hover:bg-black/80 text-white rounded-full p-4 transition-all">
              {isPlaying ? <FaPause size={20} /> : <FaPlay size={20} />}
            </button>
          )}
        </div>

        {/* Render Waveform */}
        {waveform_data && waveform_data.length > 0 ? (
          <div className="flex items-center justify-center h-full px-4">
            <div className="flex items-center justify-center space-x-0.5 h-full w-full">
              {waveform_data.map((amplitude, index) => {
                // Calculate if this bar should be highlighted based on progress
                const barProgress = index / waveform_data.length;
                const isPlayed = barProgress <= progress;

                return (
                  <div
                    key={index}
                    className="w-1 transition-all duration-100"
                    style={{
                      backgroundColor:
                        isPlaying && isPlayed ? "#fbbf24" : "#fdba74",
                      height: `${Math.max(amplitude * 100, 2)}%`,
                      opacity:
                        isPlaying && isPlayed ? 1 : 0.7 + amplitude * 0.3,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-orange-300 opacity-30 text-sm">
              No waveform data
            </span>
          </div>
        )}
      </div>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.tag_id}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-gray-400 hover:text-orange-400 cursor-pointer"
              >
                #{tag.tag_name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LickCard;
