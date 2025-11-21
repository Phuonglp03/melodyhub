import React, { useState, useEffect } from "react";
import { FaMusic, FaPlay, FaPlus, FaMagic } from "react-icons/fa";

/**
 * BackingTrackPanel Component
 * Allows users to create backing tracks by selecting chords, instruments, and rhythm patterns
 * Now includes AI generation with Suno
 */
const BackingTrackPanel = ({
  chordLibrary = [],
  instruments = [],
  rhythmPatterns = [],
  onAddChord,
  onGenerateBackingTrack,
  onGenerateAIBackingTrack, // NEW: AI generation handler
  selectedInstrumentId,
  onInstrumentChange,
  selectedRhythmPatternId,
  onRhythmPatternChange,
  chordProgression = [],
  loading = false,
  project = {}, // NEW: Need project data for tempo/key
}) => {
  const [selectedChord, setSelectedChord] = useState(null);
  const [chordDuration, setChordDuration] = useState(4); // Duration in beats
  const [aiStyle, setAiStyle] = useState("jazz"); // NEW: AI music style
  const [isGeneratingAI, setIsGeneratingAI] = useState(false); // NEW: Loading state

  const musicStyles = ["Jazz", "Rock", "Pop", "Bossa Nova", "Blues", "Country", "Classical", "Funk"];

  const handleChordClick = (chord) => {
    setSelectedChord(chord);
  };

  const handleAddChordToTimeline = () => {
    if (!selectedChord) {
      alert("Please select a chord first");
      return;
    }
    
    if (onAddChord) {
      onAddChord({
        ...selectedChord,
        duration: chordDuration,
        instrumentId: selectedInstrumentId,
        rhythmPatternId: selectedRhythmPatternId,
      });
    }
  };

  const handleGenerateFullBackingTrack = () => {
    if (chordProgression.length === 0) {
      alert("Please add some chords to the progression first");
      return;
    }

    if (onGenerateBackingTrack) {
      onGenerateBackingTrack({
        chords: chordProgression,
        instrumentId: selectedInstrumentId,
        rhythmPatternId: selectedRhythmPatternId,
        chordDuration,
      });
    }
  };

  // NEW: Handle AI generation
  const handleGenerateAIBackingTrack = async () => {
    if (chordProgression.length === 0) {
      alert("Please add some chords to build a progression first!");
      return;
    }

    if (!selectedInstrumentId) {
      alert("Please select an instrument first!");
      return;
    }

    setIsGeneratingAI(true);
    try {
      const selectedInstrument = instruments.find(i => i._id === selectedInstrumentId);
      
      if (onGenerateAIBackingTrack) {
        await onGenerateAIBackingTrack({
          chords: chordProgression,
          instrument: selectedInstrument?.name || "Piano",
          style: aiStyle,
          tempo: project.tempo || 120,
          key: project.key || "C Major",
          duration: chordProgression.length * chordDuration
        });
      }
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Compact Settings Section - Fixed Height */}
      <div className="p-3 space-y-2 border-b border-gray-700 flex-shrink-0">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-400">Instrument</label>
            <select
              value={selectedInstrumentId || ""}
              onChange={(e) => onInstrumentChange?.(e.target.value || null)}
              className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select</option>
              {instruments.map((instrument) => (
                <option key={instrument._id} value={instrument._id}>
                  {instrument.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-gray-400">Rhythm</label>
            <select
              value={selectedRhythmPatternId || ""}
              onChange={(e) => onRhythmPatternChange?.(e.target.value || null)}
              className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select</option>
              {rhythmPatterns.map((pattern) => (
                <option key={pattern._id} value={pattern._id}>
                  {pattern.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1 text-gray-400">
            Duration (beats)
          </label>
          <input
            type="number"
            min="1"
            max="16"
            value={chordDuration}
            onChange={(e) => setChordDuration(parseInt(e.target.value, 10) || 4)}
            className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Chord Library - Scrollable */}
      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wide">
          Chord Library
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
          </div>
        ) : chordLibrary.length === 0 ? (
          <p className="text-gray-500 text-xs">No chords available</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {chordLibrary.map((chord) => {
              const midiNotes = chord.midiNotes || [];
              const noteDisplay = Array.isArray(midiNotes) 
                ? midiNotes.slice(0, 3).join(", ")
                : (typeof midiNotes === 'string' ? JSON.parse(midiNotes).slice(0, 3).join(", ") : "");
              
              return (
                <button
                  key={chord._id || chord.chordName}
                  onClick={() => handleChordClick(chord)}
                  className={`px-3 py-3 rounded-lg text-left transition-all border-2 ${
                    selectedChord?.chordName === chord.chordName
                      ? "bg-blue-600 border-blue-400 text-white shadow-lg"
                      : "bg-blue-700 border-blue-600 text-white hover:bg-blue-600 hover:border-blue-500"
                  }`}
                >
                  <div className="font-bold text-sm">{chord.chordName}</div>
                  <div className="text-xs opacity-75 mt-0.5">{noteDisplay}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Buttons - Fixed at Bottom */}
      <div className="p-3 space-y-2 border-t border-gray-700 flex-shrink-0">
        {/* AI Style Selector */}
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-400">AI Music Style</label>
          <select
            value={aiStyle}
            onChange={(e) => setAiStyle(e.target.value)}
            className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {musicStyles.map(style => (
              <option key={style} value={style.toLowerCase()}>{style}</option>
            ))}
          </select>
        </div>

        {/* AI Generation Button */}
        <button
          onClick={handleGenerateAIBackingTrack}
          disabled={chordProgression.length === 0 || !selectedInstrumentId || isGeneratingAI}
          className="w-full px-3 py-2 text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded font-medium flex items-center justify-center gap-2 transition-all shadow-lg"
        >
          <FaMagic size={12} />
          {isGeneratingAI ? "Generating AI Track..." : "🎵 Generate AI Backing Track"}
        </button>

        {/* Divider */}
        {chordProgression.length > 0 && (
          <div className="border-t border-gray-600 my-2"></div>
        )}

        {/* Regular MIDI Buttons */}
        <button
          onClick={handleAddChordToTimeline}
          disabled={!selectedChord || loading}
          className="w-full px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <FaPlus size={12} />
          Add to Timeline
        </button>

        {chordProgression.length > 0 && (
          <button
            onClick={handleGenerateFullBackingTrack}
            disabled={loading}
            className="w-full px-3 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <FaPlay size={12} />
            Generate MIDI Track
          </button>
        )}
      </div>
    </div>
  );
};

export default BackingTrackPanel;
