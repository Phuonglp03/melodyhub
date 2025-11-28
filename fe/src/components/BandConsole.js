// fe/src/components/BandConsole.js
// Unified Band Console: Chord Input + Band Mixer (No Tabs)
import React, { useState } from "react";
import ProjectChordDeck from "./ProjectChordDeck";
import ProjectBandMixer from "./ProjectBandMixer";

const BandConsole = ({
  // Chord Props
  selectedChordIndex,
  onChordSelect,
  onAddChord,
  projectKey,
  // Band Props
  bandSettings,
  onSettingsChange,
  style,
  onStyleChange,
  instruments = [],
}) => {
  const [showMixer, setShowMixer] = useState(true);

  return (
    <div className="h-full flex bg-gray-950 border-t border-gray-800">
      {/* LEFT: CHORD INPUT (Always Visible) */}
      <div className="flex-1 border-r border-gray-800 p-2 overflow-y-auto">
        <div className="flex justify-between items-center mb-2 px-2">
          <span className="text-xs font-bold text-gray-500 uppercase">
            Harmony
          </span>
          {/* Toggle Mixer View Button */}
          <button
            onClick={() => setShowMixer(!showMixer)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              showMixer
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "border-gray-700 text-gray-400 hover:border-gray-600"
            }`}
          >
            {showMixer ? "Hide Band" : "Show Band"}
          </button>
        </div>
        <ProjectChordDeck
          selectedChordIndex={selectedChordIndex}
          onChordSelect={onChordSelect}
          onAddChord={onAddChord}
          projectKey={projectKey}
        />
      </div>

      {/* RIGHT: BAND MIXER (Collapsible) */}
      {showMixer && (
        <div className="w-[400px] flex-shrink-0 bg-[#0f0f10] p-4 flex flex-col border-l border-gray-800">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold text-indigo-400 uppercase">
              The Band
            </span>
            <select
              value={style}
              onChange={(e) => onStyleChange(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-orange-500"
            >
              <option value="Swing">Swing</option>
              <option value="Bossa">Bossa Nova</option>
              <option value="Latin">Latin</option>
              <option value="Ballad">Ballad</option>
              <option value="Funk">Funk</option>
              <option value="Rock">Rock</option>
            </select>
          </div>

          {/* Reusing existing Mixer Component */}
          <ProjectBandMixer
            bandSettings={bandSettings}
            onSettingsChange={onSettingsChange}
            style={style}
            onStyleChange={onStyleChange}
            instruments={instruments}
          />
        </div>
      )}
    </div>
  );
};

export default BandConsole;
