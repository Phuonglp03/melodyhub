// fe/src/components/ProjectBandMixer.js
// Band mixer for ProjectDetailPage (inspired by Studio's BandSettings)
import React from "react";
import { FaDrum, FaMusic, FaGuitar } from "react-icons/fa";

const STYLES = ["Swing", "Bossa", "Latin", "Ballad", "Funk", "Rock"];

export default function ProjectBandMixer({
  bandSettings,
  onSettingsChange,
  style,
  onStyleChange,
}) {
  const handleVolumeChange = (instrument, value) => {
    onSettingsChange({
      ...bandSettings,
      volumes: {
        ...bandSettings.volumes,
        [instrument]: value,
      },
    });
  };

  const handleMuteToggle = (instrument) => {
    onSettingsChange({
      ...bandSettings,
      mutes: {
        ...bandSettings.mutes,
        [instrument]: !bandSettings.mutes[instrument],
      },
    });
  };

  return (
    <div className="h-32 bg-gray-900 border-t border-gray-800 px-4 py-3">
      <div className="h-full flex flex-col gap-3">
        {/* Style Selector */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs w-16">Style:</span>
          <select
            value={style}
            onChange={(e) => onStyleChange(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-orange-500"
          >
            {STYLES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Instrument Controls */}
        <div className="flex items-center gap-4">
          {/* Drums */}
          <div className="flex-1 flex items-center gap-2">
            <button
              onClick={() => handleMuteToggle("drums")}
              className={`w-8 h-8 flex items-center justify-center rounded border transition-colors ${
                bandSettings.mutes.drums
                  ? "bg-red-600 border-red-500 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
              }`}
              title="Mute/Unmute Drums"
            >
              <FaDrum size={12} />
            </button>
            <div className="flex-1">
              <div className="text-[10px] text-gray-500 mb-1">Drums</div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={bandSettings.volumes.drums}
                onChange={(e) =>
                  handleVolumeChange("drums", parseFloat(e.target.value))
                }
                disabled={bandSettings.mutes.drums}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Bass */}
          <div className="flex-1 flex items-center gap-2">
            <button
              onClick={() => handleMuteToggle("bass")}
              className={`w-8 h-8 flex items-center justify-center rounded border transition-colors ${
                bandSettings.mutes.bass
                  ? "bg-red-600 border-red-500 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
              }`}
              title="Mute/Unmute Bass"
            >
              <FaGuitar size={12} />
            </button>
            <div className="flex-1">
              <div className="text-[10px] text-gray-500 mb-1">Bass</div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={bandSettings.volumes.bass}
                onChange={(e) =>
                  handleVolumeChange("bass", parseFloat(e.target.value))
                }
                disabled={bandSettings.mutes.bass}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Piano */}
          <div className="flex-1 flex items-center gap-2">
            <button
              onClick={() => handleMuteToggle("piano")}
              className={`w-8 h-8 flex items-center justify-center rounded border transition-colors ${
                bandSettings.mutes.piano
                  ? "bg-red-600 border-red-500 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
              }`}
              title="Mute/Unmute Piano"
            >
              <FaMusic size={12} />
            </button>
            <div className="flex-1">
              <div className="text-[10px] text-gray-500 mb-1">Piano</div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={bandSettings.volumes.piano}
                onChange={(e) =>
                  handleVolumeChange("piano", parseFloat(e.target.value))
                }
                disabled={bandSettings.mutes.piano}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500 disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
