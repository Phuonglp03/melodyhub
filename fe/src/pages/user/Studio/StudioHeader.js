import React, { useState } from 'react';
import { useStudio } from '../../../store/StudioContext';
import { Play, Pause, Save, Settings, ChevronDown } from 'lucide-react';

const STYLES = ['Swing', 'Bossa', 'Latin', 'Ballad', 'Funk', 'Rock'];
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'Am', 'Bm', 'Cm', 'Dm', 'Em', 'Fm', 'Gm'];

export default function StudioHeader({ onSave, projectName }) {
  const { state, actions } = useStudio();
  const { song, isPlaying } = state;
  const [showBandSettings, setShowBandSettings] = useState(false);

  return (
    <div className="h-14 px-4 flex items-center justify-between bg-gray-900 border-b border-gray-800">
      {/* Left: Project Name & Controls */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-white truncate max-w-[200px]">
          {projectName || 'Untitled Project'}
        </h1>

        {/* Play/Pause */}
        <button
          onClick={() => actions.setPlaying(!isPlaying)}
          className={`p-2 rounded-full transition-colors ${
            isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
      </div>

      {/* Center: Song Settings */}
      <div className="flex items-center gap-3">
        {/* Key */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Key</span>
          <select
            value={song.key}
            onChange={(e) => actions.setKey(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm"
          >
            {KEYS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>

        {/* BPM */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">BPM</span>
          <input
            type="number"
            value={song.bpm}
            onChange={(e) => actions.setBpm(parseInt(e.target.value) || 120)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm w-16"
            min={40}
            max={240}
          />
        </div>

        {/* Style */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Style</span>
          <select
            value={song.style}
            onChange={(e) => actions.setStyle(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm"
          >
            {STYLES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Band Settings */}
        <div className="relative">
          <button
            onClick={() => setShowBandSettings(!showBandSettings)}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm"
          >
            <Settings size={16} />
            Band
            <ChevronDown size={14} />
          </button>

          {showBandSettings && (
            <BandSettingsPopover onClose={() => setShowBandSettings(false)} />
          )}
        </div>

        {/* Save */}
        <button
          onClick={onSave}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm"
        >
          <Save size={16} />
          Save
        </button>
      </div>
    </div>
  );
}

function BandSettingsPopover({ onClose }) {
  const { state, actions } = useStudio();
  const { bandSettings } = state;

  const instruments = [
    { key: 'drums', label: 'Drums' },
    { key: 'bass', label: 'Bass' },
    { key: 'piano', label: 'Piano' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 p-4">
        <h3 className="text-white font-medium mb-3">Band Settings</h3>
        
        {instruments.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3 mb-3">
            <button
              onClick={() => actions.toggleMute(key)}
              className={`w-8 h-8 rounded text-xs font-bold ${
                bandSettings.mutes[key]
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              {bandSettings.mutes[key] ? 'M' : key[0].toUpperCase()}
            </button>
            <span className="text-gray-300 text-sm w-12">{label}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={bandSettings.volumes[key]}
              onChange={(e) => actions.setBandVolume(key, parseFloat(e.target.value))}
              className="flex-1"
            />
          </div>
        ))}
      </div>
    </>
  );
}

