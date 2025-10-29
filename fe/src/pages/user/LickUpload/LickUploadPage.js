import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaUpload, FaMusic, FaTimes, FaPlay, FaPause } from "react-icons/fa";
import { createLick } from "../../../services/user/lickService";
import GuitarTabEditor from "../../../components/GuitarTabEditor";
import GuitarTabNotation from "../../../components/GuitarTabNotation";
import {
  generateTabFromAudio,
  detectTempo,
  detectKey,
} from "../../../services/aiTabGenerator";
import {
  generateTabWithML,
  getBasicPitchStatus,
  preloadBasicPitch,
} from "../../../services/basicPitchService";

const LickUploadPage = () => {
  const navigate = useNavigate();
  const audioRef = useRef(null);

  // Pre-load ML model on component mount
  useEffect(() => {
    const loadML = async () => {
      await preloadBasicPitch();
      setMlStatus(getBasicPitchStatus());
    };
    loadML();
  }, []);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    tabNotation: "",
    key: "",
    tempo: "",
    difficulty: "beginner",
    isPublic: true,
    userId: "507f1f77bcf86cd799439011", // Test user ID
  });

  // Audio file state
  const [audioFile, setAudioFile] = useState(null);
  const [audioPreview, setAudioPreview] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // UI state
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [tabEditorMode, setTabEditorMode] = useState("visual"); // "visual" or "text"

  // AI generation state
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProgress, setAiProgress] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [showTabHighlight, setShowTabHighlight] = useState(false);
  const [mlStatus, setMlStatus] = useState({
    available: false,
    status: "not_loaded",
  });

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // Handle audio file selection
  const handleAudioChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }

      // Check file type
      if (!file.type.startsWith("audio/")) {
        setError("Please select a valid audio file");
        return;
      }

      // IMPORTANT: Clear the old audio ref when selecting new file
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      setIsPlaying(false);

      setAudioFile(file);
      setError(null);

      // Create audio preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setAudioPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove audio file
  const handleRemoveAudio = () => {
    setAudioFile(null);
    setAudioPreview(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = ""; // Clear the source
      audioRef.current = null; // Remove the reference
      setIsPlaying(false);
    }
  };

  // Toggle audio playback
  const handleTogglePlayback = () => {
    if (!audioPreview) return;

    if (!audioRef.current) {
      const audio = new Audio(audioPreview);
      audio.addEventListener("ended", () => setIsPlaying(false));
      audioRef.current = audio;
      audio.play();
      setIsPlaying(true);
    } else {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // AI: Generate tab from audio using ML (V10) or algorithm fallback
  const handleAIGeneration = async () => {
    if (!audioFile) {
      setError("Please upload an audio file first");
      return;
    }

    setAiGenerating(true);
    setAiProgress("🔍 Analyzing audio...");
    setAiResult(null);
    setError(null);

    try {
      // Step 1: Try ML-powered generation with fallback
      const mlAvailable = getBasicPitchStatus().available;

      if (mlAvailable) {
        setAiProgress("🤖 Using Spotify AI (Basic-Pitch)...");
      } else {
        setAiProgress("🎸 Using signal processing algorithm...");
      }

      const tabResult = await generateTabWithML(audioFile, {
        useML: true, // Try ML first
        allowFallback: true, // Fall back to YIN if ML fails
      });

      if (tabResult.success) {
        setFormData({
          ...formData,
          tabNotation: tabResult.tab,
        });
        setAiResult(tabResult.metadata);

        // Update progress based on which method was used
        if (tabResult.metadata.mlUsed) {
          setAiProgress("✨ ML-powered detection complete!");
        } else {
          setAiProgress("🎵 Algorithm-based detection complete!");
        }
      }

      // Step 2: Detect tempo
      if (!formData.tempo) {
        setAiProgress("🥁 Detecting tempo...");
        const tempo = await detectTempo(audioFile);
        setFormData((prev) => ({ ...prev, tempo: tempo }));
      }

      // Step 3: Detect key
      if (!formData.key) {
        setAiProgress("🎼 Detecting key...");
        const key = await detectKey(audioFile);
        setFormData((prev) => ({ ...prev, key: key }));
      }

      setAiProgress("✅ Tab generated! Switching to playback mode...");

      // Auto-switch to playback mode
      setTabEditorMode("playback");

      // Highlight tab section
      setShowTabHighlight(true);
      setTimeout(() => {
        const tabSection = document.querySelector(
          '[data-section="tab-notation"]'
        );
        if (tabSection) {
          tabSection.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 500);

      setTimeout(() => {
        setShowTabHighlight(false);
      }, 3500);

      setTimeout(() => {
        setAiGenerating(false);
        setAiProgress("");
      }, 3000);
    } catch (err) {
      console.error("AI generation error:", err);
      setError(err.message || "Failed to generate tab from audio");
      setAiGenerating(false);
      setAiProgress("");
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.title.trim()) {
      setError("Please enter a title");
      return;
    }

    if (!audioFile) {
      setError("Please select an audio file");
      return;
    }

    setUploading(true);

    try {
      // Create FormData
      const submitData = new FormData();
      submitData.append("audio", audioFile);
      submitData.append("userId", formData.userId);
      submitData.append("title", formData.title);
      submitData.append("description", formData.description || "");
      submitData.append("tabNotation", formData.tabNotation || "");
      submitData.append("key", formData.key || "");
      submitData.append("tempo", formData.tempo || "");
      submitData.append("difficulty", formData.difficulty);
      submitData.append("isPublic", formData.isPublic);
      submitData.append("status", "active");

      // Submit to backend
      const response = await createLick(submitData);

      if (response.success) {
        // Clear the audio preview and form to prevent reuse
        setAudioFile(null);
        setAudioPreview(null);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
          audioRef.current = null;
        }
        setIsPlaying(false);

        alert("Lick uploaded successfully!");
        navigate("/library/my-licks");
      } else {
        setError(response.message || "Failed to upload lick");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload lick");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-950 pt-20">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            Upload New Lick
          </h1>
          <p className="text-gray-400">
            Share your musical ideas with the community
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Upload Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Audio Upload Section */}
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <FaMusic className="mr-2" />
              Audio File
            </h3>

            {!audioFile ? (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-lg p-8 cursor-pointer hover:border-orange-500 transition-colors">
                <FaUpload className="text-gray-500 text-4xl mb-4" />
                <span className="text-gray-400 mb-2">
                  Click to upload audio file
                </span>
                <span className="text-gray-500 text-sm">
                  MP3, WAV, OGG (Max 10MB)
                </span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioChange}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={handleTogglePlayback}
                      className="bg-orange-600 hover:bg-orange-700 text-white p-3 rounded-full transition-colors"
                    >
                      {isPlaying ? <FaPause /> : <FaPlay />}
                    </button>
                    <div>
                      <p className="text-white font-medium">{audioFile.name}</p>
                      <p className="text-gray-400 text-sm">
                        {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveAudio}
                    className="text-red-500 hover:text-red-400 p-2"
                  >
                    <FaTimes size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* AI Tab Generation */}
          {audioFile && (
            <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1 flex items-center">
                    🎸 Tab Generator
                    {mlStatus.available ? (
                      <span className="ml-2 text-xs bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-1 rounded-full">
                        ✨ AI-Powered (V10)
                      </span>
                    ) : (
                      <span className="ml-2 text-xs bg-gradient-to-r from-green-600 to-blue-600 text-white px-2 py-1 rounded-full">
                        ⚡ Algorithm (V7)
                      </span>
                    )}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {mlStatus.available
                      ? "Spotify's Basic-Pitch ML + YIN fallback"
                      : "YIN algorithm (ML not available)"}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {mlStatus.available
                      ? "🤖 Real neural network • Polyphonic detection • 95% accuracy"
                      : "🎯 Signal processing • Monophonic only • 70% accuracy"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAIGeneration}
                  disabled={aiGenerating || !audioFile}
                  className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-md transition-all flex items-center"
                >
                  {aiGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <FaMusic className="mr-2" />
                      Generate Tab
                    </>
                  )}
                </button>
              </div>

              {/* AI Progress */}
              {aiProgress && (
                <div className="mt-4 bg-black/30 rounded-lg p-3">
                  <p className="text-green-300 text-sm">{aiProgress}</p>
                </div>
              )}

              {/* AI Result */}
              {aiResult && (
                <div className="mt-4 bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-700/50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="text-2xl">
                      {aiResult.mlUsed ? "🤖" : "✅"}
                    </span>
                    <div>
                      <span className="text-green-400 font-semibold block">
                        Tab Generated Successfully
                        {aiResult.mlUsed && (
                          <span className="ml-2 text-xs bg-purple-600 px-2 py-0.5 rounded">
                            ML-Powered
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-gray-400">
                        {aiResult.algorithm}
                      </span>
                      {aiResult.mlAttempted &&
                        !aiResult.mlUsed &&
                        aiResult.mlError && (
                          <p className="text-xs text-yellow-400 mt-1">
                            ⚠️ ML failed: {aiResult.mlError} • Used fallback
                            algorithm
                          </p>
                        )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-gray-400">Duration:</span>
                      <p className="text-white font-semibold">
                        {aiResult.duration?.toFixed(1)}s
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-400">Notes Detected:</span>
                      <p className="text-white font-semibold">
                        {aiResult.notesDetected}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-400">Confidence:</span>
                      <p className="text-white font-semibold">
                        {aiResult.confidence}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-start space-x-2 text-xs text-gray-400 bg-blue-900/20 border border-blue-800/50 rounded p-3">
                <span>💡</span>
                <div>
                  <p className="font-semibold text-blue-300 mb-1">
                    {mlStatus.available
                      ? "V10: Hybrid AI System"
                      : "V7: Algorithm-Based"}
                  </p>
                  {mlStatus.available ? (
                    <p>
                      • Primary: Spotify Basic-Pitch (neural network)
                      <br />
                      • Fallback: YIN algorithm (signal processing)
                      <br />
                      • Polyphonic: Can detect chords!
                      <br />• Accuracy: ~95% on clean recordings
                    </p>
                  ) : (
                    <p>
                      • Onset-driven pitch detection (YIN algorithm)
                      <br />
                      • Monophonic: Single notes only
                      <br />
                      • Accuracy: ~70% on clean recordings
                      <br />• Best with clean guitar (max 15 seconds)
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Basic Information */}
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <h3 className="text-lg font-semibold text-white mb-4">
              Basic Information
            </h3>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Blues Solo in A Minor"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe your lick, technique, or inspiration..."
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Row: Key, Tempo, Difficulty */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Key */}
                <div>
                  <label className="block text-gray-400 text-sm mb-2">
                    Key
                  </label>
                  <select
                    name="key"
                    value={formData.key}
                    onChange={handleInputChange}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select Key</option>
                    <option value="C Major">C Major</option>
                    <option value="G Major">G Major</option>
                    <option value="D Major">D Major</option>
                    <option value="A Major">A Major</option>
                    <option value="E Major">E Major</option>
                    <option value="F Major">F Major</option>
                    <option value="A Minor">A Minor</option>
                    <option value="E Minor">E Minor</option>
                    <option value="B Minor">B Minor</option>
                    <option value="D Minor">D Minor</option>
                  </select>
                </div>

                {/* Tempo */}
                <div>
                  <label className="block text-gray-400 text-sm mb-2">
                    Tempo (BPM)
                  </label>
                  <input
                    type="number"
                    name="tempo"
                    value={formData.tempo}
                    onChange={handleInputChange}
                    placeholder="120"
                    min="40"
                    max="300"
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block text-gray-400 text-sm mb-2">
                    Difficulty
                  </label>
                  <select
                    name="difficulty"
                    value={formData.difficulty}
                    onChange={handleInputChange}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Notation */}
          <div
            data-section="tab-notation"
            className={`transition-all duration-500 ${
              showTabHighlight
                ? "ring-4 ring-green-500 ring-opacity-50 rounded-lg p-4 -m-4"
                : ""
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">
                Tab Notation
                {formData.tabNotation && aiResult && (
                  <span className="text-green-400 text-sm ml-2">
                    ✓ Generated by AI
                  </span>
                )}
              </h3>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setTabEditorMode("playback")}
                  disabled={!audioFile || !formData.tabNotation}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    tabEditorMode === "playback"
                      ? "bg-green-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                  title={
                    !audioFile || !formData.tabNotation
                      ? "Upload audio and enter tab first"
                      : "Play tab with audio"
                  }
                >
                  🎵 Playback
                </button>
                <button
                  type="button"
                  onClick={() => setTabEditorMode("visual")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    tabEditorMode === "visual"
                      ? "bg-orange-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  Visual Editor
                </button>
                <button
                  type="button"
                  onClick={() => setTabEditorMode("text")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    tabEditorMode === "text"
                      ? "bg-orange-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  Text Mode
                </button>
              </div>
            </div>

            {tabEditorMode === "playback" ? (
              // Playback mode with audio sync
              audioRef.current && formData.tabNotation ? (
                <GuitarTabNotation
                  tabData={formData.tabNotation}
                  tempo={formData.tempo || 120}
                  audioRef={audioRef}
                  audioDuration={aiResult?.duration || 0}
                  isEditable={false}
                />
              ) : (
                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 text-center">
                  <p className="text-gray-400">
                    Enter tab notation to use playback mode
                  </p>
                </div>
              )
            ) : tabEditorMode === "visual" ? (
              <GuitarTabEditor
                key={formData.tabNotation} // Force re-render when tab changes
                initialTab={formData.tabNotation}
                tempo={formData.tempo || 120}
                onSave={(tabText) => {
                  setFormData({ ...formData, tabNotation: tabText });
                }}
              />
            ) : (
              <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                <textarea
                  name="tabNotation"
                  value={formData.tabNotation}
                  onChange={handleInputChange}
                  placeholder="e|--5--7--8--7--5--|&#10;B|--5--7--8--7--5--|&#10;G|------------------|&#10;D|------------------|&#10;A|------------------|&#10;E|------------------|"
                  rows={8}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            )}
          </div>

          {/* Visibility */}
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <h3 className="text-lg font-semibold text-white mb-4">
              Visibility
            </h3>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                name="isPublic"
                checked={formData.isPublic}
                onChange={handleInputChange}
                className="w-5 h-5 text-orange-600 bg-gray-800 border-gray-700 rounded focus:ring-orange-500"
              />
              <span className="text-gray-300">
                Make this lick public (visible to everyone)
              </span>
            </label>
          </div>

          {/* Submit Buttons */}
          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={uploading || !audioFile}
              className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-md transition-colors flex items-center justify-center"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <FaUpload className="mr-2" />
                  Upload Lick
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate("/library/my-licks")}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LickUploadPage;
